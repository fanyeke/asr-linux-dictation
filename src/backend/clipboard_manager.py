"""Clipboard save/restore around text injection using xsel/xclip.

Provides the :class:`ClipboardManager` class and the :class:`FocusLostError`
exception for use during text-injection workflows.

Prefers ``xsel`` for synchronous clipboard writes. Falls back to ``xclip``
using bounded clipboard-owner loops so desktop integration cannot hold the
dictation pipeline open indefinitely.
"""

from __future__ import annotations

import asyncio
import logging
import shutil
import subprocess
import time
from collections.abc import Awaitable, Callable

logger = logging.getLogger(__name__)

CLIPBOARD_COMMAND_TIMEOUT_SECONDS: float = 1.0
CLIPBOARD_VERIFY_TIMEOUT_SECONDS: float = 0.75
CLIPBOARD_VERIFY_POLL_INTERVAL_SECONDS: float = 0.025


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class FocusLostError(Exception):
    """Raised when the target window loses focus during text injection.

    The injection driver can catch this and fall back to copying the text
    to the clipboard directly.
    """


# ---------------------------------------------------------------------------
# Low-level clipboard runner
# ---------------------------------------------------------------------------


def _detect_clipboard_tool() -> str | None:
    """Return the best available clipboard tool, or ``None``."""
    if shutil.which("xsel"):
        return "xsel"
    if shutil.which("xclip"):
        return "xclip"
    return None


async def _run_clipboard(
    tool: str,
    mode: str,
    input_data: bytes | None = None,
) -> subprocess.CompletedProcess:
    """Run a clipboard tool command asynchronously.

    Args:
        tool: ``"xsel"`` or ``"xclip"``.
        mode: ``"read"`` or ``"write"``.
        input_data: Bytes to write (for ``"write"`` mode).

    Returns:
        A :class:`subprocess.CompletedProcess`.

    Raises:
        RuntimeError: If the tool executable is not found.
    """
    if tool == "xsel":
        if mode == "read":
            args = ("xsel", "--output", "--clipboard")
        else:
            args = ("xsel", "--input", "--clipboard")
    else:  # xclip
        if mode == "read":
            args = ("xclip", "-selection", "clipboard", "-o")
        else:
            # xclip is a clipboard owner: in normal operation it remains
            # alive until other clients request the selection. Allow one
            # verification read and one target-app paste, then exit.
            args = ("xclip", "-selection", "clipboard", "-loops", "2")

    if tool == "xclip" and mode == "write":
        try:
            proc = subprocess.Popen(
                args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            try:
                stdout, stderr = proc.communicate(
                    input=input_data,
                    timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired:
                return subprocess.CompletedProcess(args, 0, b"", b"")
        except FileNotFoundError as exc:
            raise RuntimeError(
                f"Required tool '{tool}' is not installed. "
                f"Install it with: sudo apt-get install -y {tool}"
            ) from exc

        return subprocess.CompletedProcess(
            args,
            proc.returncode or 0,
            stdout,
            stderr,
        )

    try:
        return subprocess.run(
            args,
            input=input_data,
            capture_output=True,
            timeout=CLIPBOARD_COMMAND_TIMEOUT_SECONDS,
            check=False,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"Required tool '{tool}' is not installed. "
            f"Install it with: sudo apt-get install -y {tool}"
        ) from exc
    except subprocess.TimeoutExpired as exc:
        return subprocess.CompletedProcess(
            args,
            124,
            exc.stdout or b"",
            exc.stderr or b"clipboard command timed out",
        )


# ---------------------------------------------------------------------------
# ClipboardManager
# ---------------------------------------------------------------------------


class ClipboardManager:
    """Manages clipboard save/restore around text injection.

    Uses ``xsel`` (preferred) or ``xclip`` to manipulate the X11
    selection clipboard. If neither tool is installed all operations
    degrade gracefully (no-ops with a logged warning).

    Typical usage::

        mgr = ClipboardManager()
        await mgr.save()                     # stash current clipboard
        …                                    # set clipboard to new text, paste, etc.
        await mgr.restore()                  # put original back
    """

    def __init__(self) -> None:
        """Initialize the manager and detect the clipboard tool."""
        self._saved_content: str | None = None
        self._tool: str | None = _detect_clipboard_tool()
        if self._tool is None:
            logger.warning(
                "Neither xsel nor xclip found — clipboard save/restore disabled"
            )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def save(self) -> str | None:
        """Save the current X11 clipboard content.

        The result is stored internally and also returned to the caller.

        Returns:
            The clipboard text, or ``None`` if the clipboard was empty,
            the command failed, or no clipboard tool is available.
        """
        if self._tool is None:
            return None

        content_bytes = await self._read_clipboard()
        if content_bytes is None:
            return None

        self._saved_content = content_bytes if content_bytes else None
        return self._saved_content

    async def restore(self) -> None:
        """Restore the previously saved clipboard content.

        This is a no-op if no content was saved or no clipboard tool
        is available.
        """
        if self._tool is None or self._saved_content is None:
            return

        try:
            await _run_clipboard(
                self._tool, "write", input_data=self._saved_content.encode(),
            )
        except RuntimeError:
            logger.warning("Failed to restore clipboard")
            self._tool = None

    async def set_clipboard(self, text: str) -> bool:
        """Set the X11 clipboard to *text*.

        With ``xsel`` the selection is committed synchronously — no
        race condition.  With ``xclip`` there may be a brief delay
        before other clients see the new content.

        This is a no-op if no clipboard tool is available.
        """
        if self._tool is None:
            return False

        try:
            result = await _run_clipboard(self._tool, "write", input_data=text.encode())
        except RuntimeError:
            logger.warning("Failed to set clipboard")
            self._tool = None
            return False

        return result.returncode == 0

    async def set_clipboard_for_paste(
        self,
        text: str,
        *,
        timeout: float = CLIPBOARD_VERIFY_TIMEOUT_SECONDS,
        poll_interval: float = CLIPBOARD_VERIFY_POLL_INTERVAL_SECONDS,
    ) -> bool:
        """Set the clipboard and wait until other clients can read *text*.

        ``xclip`` can return before its background clipboard owner is
        observable by the target application. Pasting before the new
        selection is visible may paste the previous dictation. This method
        writes the text, then polls the clipboard until a read returns the
        same value.
        """
        if not await self.set_clipboard(text):
            return False

        deadline = time.monotonic() + timeout
        while True:
            current = await self._read_clipboard()
            if current == text:
                return True
            if time.monotonic() >= deadline:
                logger.warning("Clipboard did not expose injected text before paste")
                return False
            await asyncio.sleep(poll_interval)

    async def inject_with_fallback(
        self,
        text: str,
        inject_func: Callable[[str], Awaitable[None]],
    ) -> dict[str, bool | str]:
        """Save clipboard, call *inject_func*, then restore on success.

        If *inject_func* raises :class:`FocusLostError`, the text is
        copied directly to the clipboard as a visible fallback for the
        user to paste manually. No restore is performed in this case
        (the fallback text stays in the clipboard).

        Args:
            text: The text to inject.
            inject_func: An async callable accepting the text that
                performs the actual injection (e.g. simulating a paste
                keystroke).

        Returns:
            A dict with keys:

            * ``success`` (bool) — ``True`` if injection completed.
            * ``method`` (str) — ``"paste"`` or ``"clipboard_fallback"``.
            * ``clipboard_saved`` (bool) — whether the original clipboard
              was captured.
        """
        saved_content = await self.save()
        clipboard_saved = saved_content is not None

        try:
            await inject_func(text)
        except FocusLostError:
            await self.set_clipboard(text)
            logger.info(
                "Focus lost during injection — text copied "
                "to clipboard as fallback",
            )
            return {
                "success": False,
                "method": "clipboard_fallback",
                "clipboard_saved": clipboard_saved,
            }

        await self.restore()
        return {
            "success": True,
            "method": "paste",
            "clipboard_saved": clipboard_saved,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _read_clipboard(self) -> str | None:
        """Read current clipboard content.

        Returns:
            The clipboard text, or ``None`` on failure.
        """
        try:
            result = await _run_clipboard(self._tool, "read")  # type: ignore[arg-type]
        except RuntimeError:
            logger.warning("Failed to read clipboard")
            self._tool = None
            return None

        if result.returncode != 0:
            return None

        content = result.stdout.decode()
        return content if content else None
