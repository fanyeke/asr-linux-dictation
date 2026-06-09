"""Focused window detection for context-aware dictation.

Uses X11 tools (``xdotool``, ``xprop``) to detect the currently focused
window's application class, title, and process name.  This information
is used by the profile system to auto-switch dictation strategies based
on which application the user is typing into.

On Wayland the same tools may work depending on the compositor, but
results are less reliable.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from backend.logging_config import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Known terminal emulator WM_CLASS patterns
# ---------------------------------------------------------------------------

TERMINAL_WM_CLASSES: frozenset[str] = frozenset(
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
        "wezterm",
        "foot",
        "ghostty",
        "contour",
        "tabby",
    }
)

# ---------------------------------------------------------------------------
# Known code-editor WM_CLASS patterns
# ---------------------------------------------------------------------------

CODE_EDITOR_WM_CLASSES: frozenset[str] = frozenset(
    {
        "code",
        "code-oss",
        "vscodium",
        "jetbrains-idea",
        "jetbrains-pycharm",
        "jetbrains-webstorm",
        "jetbrains-clion",
        "jetbrains-goland",
        "jetbrains-rider",
        "jetbrains-datagrip",
        "jetbrains-rustrover",
        "sublime_text",
        "sublime_merge",
        "neovide",
        "vim",
        "nvim",
        "emacs",
        "emacs24",
        "emacs25",
        "emacs26",
        "emacs27",
        "emacs28",
        "emacs29",
    }
)

_WM_CLASS_RE = re.compile(r'"([^"]+)"')


@dataclass
class WindowInfo:
    """Information about a focused window.

    Attributes:
        wm_class: The window class name (lowercase), e.g. ``\"code\"``, ``\"gnome-terminal\"``.
        wm_name: The window title, e.g. ``\"README.md - my-project - Visual Studio Code\"``.
        process_name: The executable name, e.g. ``\"code\"``, ``\"gnome-terminal\"``.
            This is only available on X11 via ``xprop`` ``_NET_WM_PID``.
    """

    wm_class: str = ""
    wm_name: str = ""
    process_name: str = ""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def detect_focused_window() -> WindowInfo | None:
    """Detect and return the currently focused window's information.

    Uses ``xdotool`` and ``xprop`` on X11.  Returns ``None`` if the
    required tools are unavailable or the detection fails.

    Returns:
        A :class:`WindowInfo` with the available fields populated, or
        ``None`` if detection failed.
    """
    session_type = os.environ.get("XDG_SESSION_TYPE", "x11").lower()

    if session_type == "wayland":
        # Wayland has limited cross-compositor window detection.
        # Try ydottool or wlrctl if available.
        info = await _detect_wayland()
        if info is not None:
            return info
        # Fall through to xdotool-based detection (works with XWayland)
        logger.debug("Wayland window detection failed, trying XWayland fallback")

    # X11 / XWayland detection
    return await _detect_x11()


async def detect_profile_for_focused_window(profiles: list[dict]) -> dict | None:
    """Find the profile that best matches the currently focused window.

    Iterates through *profiles* and returns the first one whose
    ``window_match`` pattern matches the focused window.  Profiles
    without a ``window_match`` are skipped.

    Args:
        profiles: List of profile dicts (as returned by
            :func:`profile_manager.list_profiles`).

    Returns:
        The matching profile dict, or ``None`` if no match.
    """
    import fnmatch

    window = await detect_focused_window()
    if window is None:
        return None

    for profile in profiles:
        raw = profile.get("window_match", "") or ""
        if not raw:
            continue

        match_field = profile.get("window_match_field", "wm_class")
        value = getattr(window, match_field, "")
        patterns = [p.strip() for p in raw.split(",") if p.strip()]
        if any(fnmatch.fnmatch(value.lower(), p.lower()) for p in patterns):
            logger.info(
                "window_profile_match",
                profile=profile["name"],
                patterns=patterns,
                field=match_field,
                value=value,
            )
            return profile

    return None


async def is_terminal(window: WindowInfo | None = None) -> bool:
    """Check if the focused window is a terminal emulator.

    Args:
        window: Optional :class:`WindowInfo`.  If not provided, the
            focused window is detected automatically.

    Returns:
        ``True`` if the window class matches a known terminal emulator.
    """
    if window is None:
        window = await detect_focused_window()
    if window is None:
        return False
    return window.wm_class.lower() in TERMINAL_WM_CLASSES


async def is_code_editor(window: WindowInfo | None = None) -> bool:
    """Check if the focused window is a code editor.

    Args:
        window: Optional :class:`WindowInfo`.  If not provided, the
            focused window is detected automatically.

    Returns:
        ``True`` if the window class matches a known code editor.
    """
    if window is None:
        window = await detect_focused_window()
    if window is None:
        return False
    return window.wm_class.lower() in CODE_EDITOR_WM_CLASSES


# ---------------------------------------------------------------------------
# X11 detection
# ---------------------------------------------------------------------------


async def _detect_x11() -> WindowInfo | None:
    """Detect the focused window using X11 tools (``xdotool`` + ``xprop``)."""
    import asyncio

    # Step 1: Get the active window ID
    try:
        proc = await asyncio.create_subprocess_exec(
            "xdotool",
            "getactivewindow",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=3.0)
        if proc.returncode != 0:
            return None
        window_id = stdout.decode().strip()
        if not window_id:
            return None
    except (FileNotFoundError, TimeoutError, OSError) as exc:
        logger.debug("xdotool detection failed", error=str(exc))
        return None

    info = WindowInfo()

    # Step 2: Get WM_CLASS via xprop
    try:
        class_proc = await asyncio.create_subprocess_exec(
            "xprop",
            "-id",
            window_id,
            "WM_CLASS",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(class_proc.communicate(), timeout=3.0)
        if class_proc.returncode == 0:
            classes = _WM_CLASS_RE.findall(stdout.decode())
            if len(classes) >= 2:
                info.wm_class = classes[1].lower()
            elif len(classes) == 1:
                info.wm_class = classes[0].lower()
    except (FileNotFoundError, TimeoutError, OSError) as exc:
        logger.debug("xprop WM_CLASS failed", error=str(exc))

    # Step 3: Get WM_NAME (window title) via xprop
    try:
        name_proc = await asyncio.create_subprocess_exec(
            "xprop",
            "-id",
            window_id,
            "_NET_WM_NAME",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(name_proc.communicate(), timeout=3.0)
        if name_proc.returncode == 0:
            # Format: _NET_WM_NAME(UTF8_STRING) = "My Window Title"
            title_match = re.search(r'=\s*"(.+)"', stdout.decode())
            if title_match:
                info.wm_name = title_match.group(1)
    except (FileNotFoundError, TimeoutError, OSError) as exc:
        logger.debug("xprop _NET_WM_NAME failed", error=str(exc))

    # Step 4: Try to get process name from _NET_WM_PID
    try:
        pid_proc = await asyncio.create_subprocess_exec(
            "xprop",
            "-id",
            window_id,
            "_NET_WM_PID",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(pid_proc.communicate(), timeout=3.0)
        if pid_proc.returncode == 0:
            pid_match = re.search(r"=\s*(\d+)", stdout.decode())
            if pid_match:
                pid = int(pid_match.group(1))
                try:
                    proc = await asyncio.create_subprocess_exec(
                        "ps",
                        "-p",
                        str(pid),
                        "-o",
                        "comm=",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=3.0)
                    if proc.returncode == 0:
                        info.process_name = stdout.decode().strip()
                except (FileNotFoundError, TimeoutError, OSError):
                    pass
    except (FileNotFoundError, TimeoutError, OSError):
        pass

    return info


# ---------------------------------------------------------------------------
# Wayland detection
# ---------------------------------------------------------------------------


async def _detect_wayland() -> WindowInfo | None:
    """Attempt window detection on Wayland using available tools."""
    import asyncio

    info = WindowInfo()

    # Try ydottool
    import shutil

    if shutil.which("ydotool"):
        try:
            proc = await asyncio.create_subprocess_exec(
                "ydotool",
                "getactivewindow",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=3.0)
            if proc.returncode == 0 and stdout.decode().strip():
                # ydotool returns a window handle but no app info
                # We can't determine app type from handle alone
                return None
        except (FileNotFoundError, TimeoutError, OSError):
            pass

    # wlrctl is another option
    if shutil.which("wlrctl"):
        try:
            # wlrctl toplevel list gives active window info
            proc = await asyncio.create_subprocess_exec(
                "wlrctl",
                "toplevel",
                "list",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=3.0)
            if proc.returncode == 0:
                # Format depends on compositor — best effort parse
                output = stdout.decode().strip()
                if output:
                    info.wm_name = output.split("\n")[0]
        except (FileNotFoundError, TimeoutError, OSError):
            pass

    return None if not info.wm_class and not info.wm_name else info
