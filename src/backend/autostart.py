"""Manage XDG autostart for ASR Linux.

Provides functions to install, remove, and check the status of the
XDG autostart .desktop entry so the app starts automatically on login.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_AUTOSTART_FILENAME = "asr-linux.desktop"

_DESKTOP_ENTRY_TEMPLATE = """\
[Desktop Entry]
Type=Application
Name=ASR Linux
Comment=AI-powered voice dictation
Exec={exec_path}
Terminal=false
Categories=AudioVideo;Utility;
X-GNOME-Autostart-enabled=true
"""


def _autostart_dir() -> Path:
    """Return the XDG autostart directory."""
    xdg_config = os.environ.get("XDG_CONFIG_HOME")
    if xdg_config:
        return Path(xdg_config) / "autostart"
    return Path.home() / ".config" / "autostart"


def _autostart_path() -> Path:
    """Return the full path to the autostart .desktop file."""
    return _autostart_dir() / _AUTOSTART_FILENAME


def install(exec_path: str | None = None) -> bool:
    """Install the autostart .desktop entry.

    Args:
        exec_path: Path to the app executable. If None, tries to detect
            the running AppImage or falls back to a reasonable default.

    Returns:
        True if the entry was created successfully.
    """
    desktop_dir = _autostart_dir()
    desktop_dir.mkdir(parents=True, exist_ok=True)

    if exec_path is None:
        exec_path = _detect_exec_path()

    content = _DESKTOP_ENTRY_TEMPLATE.format(exec_path=exec_path)

    try:
        _autostart_path().write_text(content)
        logger.info("autostart_installed", exec_path=exec_path)
        return True
    except OSError as exc:
        logger.error("autostart_install_failed", error=str(exc))
        return False


def remove() -> bool:
    """Remove the autostart .desktop entry.

    Returns:
        True if the entry was removed or didn't exist.
    """
    path = _autostart_path()
    if not path.exists():
        return True
    try:
        path.unlink()
        logger.info("autostart_removed")
        return True
    except OSError as exc:
        logger.error("autostart_remove_failed", error=str(exc))
        return False


def is_enabled() -> bool:
    """Check whether autostart is currently enabled.

    Returns:
        True if the autostart .desktop file exists.
    """
    return _autostart_path().exists()


def _detect_exec_path() -> str:
    """Detect the executable path for the autostart entry.

    Checks (in order):
    1. The running AppImage path via ``APPIMAGE`` env var.
    2. A packaged install at ``/usr/bin/asr-linux``.
    3. The development entry point as a fallback.

    Returns:
        A string path to the executable.
    """
    appimage = os.environ.get("APPIMAGE")
    if appimage:
        return appimage
    if Path("/usr/bin/asr-linux").exists():
        return "/usr/bin/asr-linux"
    return "/usr/bin/asr-linux"
