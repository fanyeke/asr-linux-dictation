"""Text injection using X11 tools (xsel/xclip, xdotool).

Provides the :class:`TextInjector` class that can insert text into the
currently focused X11 window by saving/restoring the clipboard and
simulating paste keystrokes.
"""

import asyncio
import os
import re
import subprocess
from dataclasses import dataclass

from backend.clipboard_manager import ClipboardManager, FocusLostError

# ---------------------------------------------------------------------------
# Desktop session detection
# ---------------------------------------------------------------------------


def _detect_desktop_session() -> str:
    """Detect the current desktop session type from environment."""
    return os.environ.get("XDG_SESSION_TYPE", "x11").lower()


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TEXT_INJECTOR_TERMINALS: frozenset[str] = frozenset(
    {
        "gnome-terminal",
        "konsole",
        "xterm",
        "rxvt",
        "alacritty",
        "kitty",
        "terminator",
        "tilix",
        "st",
        "lxterminal",
        "qterminal",
        "mate-terminal",
        "xfce4-terminal",
        "deepin-terminal",
        "hyper",
    }
)

_WM_CLASS_RE = re.compile(r'"([^"]+)"')
CLIPBOARD_READY_DELAY_SECONDS: float = 0.15
DESKTOP_COMMAND_TIMEOUT_SECONDS: float = 2.0


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class InjectionResult:
    """Result of a text injection attempt.

    Attributes:
        success: Whether the injection completed successfully.
        method: The strategy used (``"paste"``, ``"clipboard_fallback"``,
            or ``"failed"``).
        clipboard_saved: Whether the original clipboard was preserved.
        error: A human-readable error message, if applicable.
    """

    success: bool
    method: str  # "paste", "clipboard_fallback", "failed"
    clipboard_saved: bool
    error: str | None = None


# ---------------------------------------------------------------------------
# Low-level command runner (testable via monkeypatching)
# ---------------------------------------------------------------------------


async def _run_command(
    *args: str,
    input_data: bytes | None = None,
) -> subprocess.CompletedProcess:
    """Run an external command asynchronously.

    Args:
        *args: Command and its arguments (e.g. ``"xdotool",
            "getactivewindow"``).
        input_data: Optional bytes to send to the process's stdin.

    Returns:
        A :class:`subprocess.CompletedProcess` with the captured output.

    Raises:
        RuntimeError: If the command executable is not found, with a clear
            installation hint.
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.PIPE if input_data is not None else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        cmd = args[0] if args else "unknown"
        raise RuntimeError(
            f"Required tool '{cmd}' is not installed. Install it with: sudo apt-get install -y {cmd}"
        ) from exc
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=input_data),
            timeout=DESKTOP_COMMAND_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        proc.kill()
        stdout, stderr = await proc.communicate()
        return subprocess.CompletedProcess(
            args,
            124,
            stdout,
            stderr or b"desktop command timed out",
        )
    return subprocess.CompletedProcess(
        args,
        proc.returncode or 0,
        stdout,
        stderr,
    )


# ---------------------------------------------------------------------------
# Injector
# ---------------------------------------------------------------------------


class TextInjector:
    """Inject text into the focused X11 window using clipboard and paste.

    Uses ``xsel`` or ``xclip`` to manipulate the X11 clipboard and ``xdotool`` to
    simulate paste keystrokes (``ctrl+v`` / ``ctrl+shift+v``) into the
    currently focused window.
    """

    def __init__(
        self,
        clipboard_manager: ClipboardManager | None = None,
    ) -> None:
        """Initialize the injector.

        Args:
            clipboard_manager: Optional :class:`ClipboardManager` instance.
                If not provided a new one is created.
        """
        self._clipboard_manager = clipboard_manager or ClipboardManager()
        self._session_type = _detect_desktop_session()

    async def inject(self, text: str) -> InjectionResult:
        """Inject *text* into the currently focused window.

        Routes to Wayland or X11 injection depending on the detected
        desktop session type.
        """
        if self._session_type == "wayland":
            return await self._inject_wayland(text)
        return await self._inject_x11(text)

    async def _inject_x11(self, text: str) -> InjectionResult:
        """X11 injection: clipboard paste via xdotool, xsel/xclip.

        Uses :meth:`ClipboardManager.inject_with_fallback` to save the
        current clipboard content before injection, set the new text,
        simulate paste, and restore the original clipboard on success.
        On failure (paste error or focus change) the clipboard is **not**
        restored — the injected text remains as a user fallback.

        Uses clipboard paste as the only automatic insertion method. Direct
        ``xdotool type`` is intentionally avoided because it can drop
        characters for IME/Chinese and long text.

        Args:
            text: The text to inject.

        Returns:
            An :class:`InjectionResult` describing what happened.
        """
        # 1. Get active window
        window_id = await self._get_active_window()
        if window_id is None:
            return InjectionResult(
                success=False,
                method="failed",
                clipboard_saved=False,
                error="No active window found",
            )

        # 2. Detect terminal type
        is_terminal = await self._is_terminal(window_id)

        # 3. Delegate clipboard save/restore and paste to inject_with_fallback
        async def _do_paste(t: str) -> None:
            """Inner function: set clipboard, check focus, paste.

            Passed to :meth:`ClipboardManager.inject_with_fallback` which
            wraps it with clipboard save/restore.
            """
            clipboard_set = await self._clipboard_manager.set_clipboard_for_paste(t)
            if not clipboard_set:
                raise RuntimeError("Clipboard could not be set")
            await asyncio.sleep(CLIPBOARD_READY_DELAY_SECONDS)

            # Re-check focus after clipboard operations
            current_window = await self._get_active_window()
            if current_window != window_id:
                raise FocusLostError("Focus changed during injection")

            paste_ok = await self._paste(window_id, is_terminal)
            if not paste_ok:
                raise RuntimeError("Paste command failed")

        result = await self._clipboard_manager.inject_with_fallback(
            text,
            _do_paste,
        )

        # Translate inject_with_fallback result dict to InjectionResult.
        success = bool(result["success"])
        method = str(result["method"])
        if not success:
            error_msg = (
                "Paste failed — text left in clipboard for manual paste"
                if method == "clipboard_fallback"
                else "Text injection failed"
            )
        else:
            error_msg = None

        return InjectionResult(
            success=success,
            method=method,
            clipboard_saved=bool(result["clipboard_saved"]),
            error=error_msg,
        )

    # ------------------------------------------------------------------
    # X11 helpers
    # ------------------------------------------------------------------

    async def _get_active_window(self) -> str | None:
        """Return the ID of the currently focused window.

        Uses ``xdotool getactivewindow``.

        Returns:
            A numeric window ID string, or ``None`` if the command failed.
        """
        result = await _run_command("xdotool", "getactivewindow")
        if result.returncode != 0:
            return None
        window_id = result.stdout.decode().strip()
        return window_id if window_id else None

    async def _is_terminal(self, window_id: str) -> bool:
        """Check whether the window identified by *window_id* is a terminal.

        Uses ``xprop -id <id> WM_CLASS`` and compares the quoted class
        names against :const:`TEXT_INJECTOR_TERMINALS`.

        Args:
            window_id: The X11 window ID.

        Returns:
            ``True`` if the window class matches a known terminal.
        """
        result = await _run_command("xprop", "-id", window_id, "WM_CLASS")
        if result.returncode != 0:
            return False

        output = result.stdout.decode()
        # xprop output format:
        #   WM_CLASS(STRING) = "instance", "class"
        matches = _WM_CLASS_RE.findall(output)
        return any(cls.lower() in TEXT_INJECTOR_TERMINALS for cls in matches)

    async def _type(self, window_id: str, text: str) -> bool:
        """Type *text* directly into the target window using xdotool.

        This avoids clipboard races entirely.  Falls back to ``False``
        for terminals where ``ctrl+shift+v`` is the safer path.

        Args:
            window_id: The target X11 window ID.
            text: The text to type.

        Returns:
            ``True`` if typing was attempted successfully.
        """
        result = await _run_command(
            "xdotool",
            "type",
            "--window",
            window_id,
            "--delay",
            "1",
            text,
        )
        return result.returncode == 0

    async def _paste(self, window_id: str, is_terminal: bool) -> bool:
        """Simulate a paste keystroke into the target window.

        Normal windows: ``xdotool key --window <id> ctrl+v``
        Terminal windows: ``xdotool key --window <id> ctrl+shift+v``

        Args:
            window_id: The target X11 window ID.
            is_terminal: Whether the target is a terminal emulator.

        Returns:
            ``True`` if the command exited successfully.
        """
        key_combo = "ctrl+shift+v" if is_terminal else "ctrl+v"
        result = await _run_command(
            "xdotool",
            "key",
            "--window",
            window_id,
            key_combo,
        )
        return result.returncode == 0

    # ------------------------------------------------------------------
    # Wayland helpers
    # ------------------------------------------------------------------

    async def _inject_wayland(self, text: str) -> InjectionResult:
        """Wayland injection: set clipboard with wl-copy, paste with wtype.

        Falls back to leaving text on clipboard if wtype is unavailable.
        """
        # Set clipboard with wl-copy
        try:
            set_result = await _run_command("wl-copy", input_data=text.encode())
            if set_result.returncode != 0:
                return InjectionResult(
                    success=False,
                    method="clipboard_fallback",
                    clipboard_saved=False,
                    error="wl-copy failed — clipboard may not be available",
                )
        except (RuntimeError, FileNotFoundError):
            return InjectionResult(
                success=False,
                method="failed",
                clipboard_saved=False,
                error="wl-copy not installed. Install with: sudo apt-get install wl-clipboard",
            )

        # Small delay for clipboard to be available to other clients
        await asyncio.sleep(CLIPBOARD_READY_DELAY_SECONDS)

        # Simulate Ctrl+V with wtype
        try:
            paste_result = await _run_command(
                "wtype",
                "-M",
                "ctrl",
                "-P",
                "v",
                "-m",
                "ctrl",
            )
            if paste_result.returncode == 0:
                return InjectionResult(
                    success=True,
                    method="paste",
                    clipboard_saved=False,
                    error=None,
                )
            # wtype ran but paste failed — text is on clipboard as fallback
            return InjectionResult(
                success=False,
                method="clipboard_fallback",
                clipboard_saved=False,
                error="wtype paste failed — text left in Wayland clipboard",
            )
        except (RuntimeError, FileNotFoundError):
            # wtype not installed — text is on clipboard as manual fallback
            return InjectionResult(
                success=False,
                method="clipboard_fallback",
                clipboard_saved=False,
                error=(
                    "wtype not installed. Install with: sudo apt-get install wtype. "
                    "Text left in clipboard for manual paste."
                ),
            )
