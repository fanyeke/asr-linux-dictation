"""Platform detection and factory for platform-specific components.

Provides runtime platform detection and factory functions that return
the appropriate implementation for the current operating system.

Usage::

    from backend import platform
    recorder = platform.get_recorder()
    injector = platform.get_injector()
    secret_store = platform.get_secret_store()
"""

from __future__ import annotations

import sys
from typing import Any

from backend.logging_config import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Platform identification
# ---------------------------------------------------------------------------


def current_platform() -> str:
    """Return the current platform name: ``\"linux\"``, ``\"macos\"``, or ``\"windows\"``."""
    if sys.platform == "linux":
        return "linux"
    if sys.platform == "darwin":
        return "macos"
    if sys.platform in ("win32", "cygwin"):
        return "windows"
    return sys.platform  # fallback: return the raw name


def is_linux() -> bool:
    """Whether the current platform is Linux."""
    return current_platform() == "linux"


def is_macos() -> bool:
    """Whether the current platform is macOS."""
    return current_platform() == "macos"


# ---------------------------------------------------------------------------
# Abstract imports (avoid circulars / missing deps)
# ---------------------------------------------------------------------------

_IMPORTS_CACHED: dict[str, Any] = {}


def _import_backend(module: str) -> Any:
    """Lazily import and cache a backend platform module."""
    if module not in _IMPORTS_CACHED:
        from importlib import import_module

        try:
            _IMPORTS_CACHED[module] = import_module(module)
        except ImportError as exc:
            logger.warning(
                "platform_module_import_failed",
                module=module,
                platform=current_platform(),
                error=str(exc),
            )
            _IMPORTS_CACHED[module] = None
    return _IMPORTS_CACHED[module]


def clear_import_cache() -> None:
    """Clear the lazy import cache (useful in tests)."""
    _IMPORTS_CACHED.clear()


# ---------------------------------------------------------------------------
# Recorder
# ---------------------------------------------------------------------------


def get_recorder(*args: Any, **kwargs: Any):
    """Return the appropriate :class:`BaseAudioRecorder` for this platform.

    On Linux this wraps the existing :class:`backend.audio_recorder.AudioRecorder`.
    On macOS this returns a stub (requires macOS-specific implementation).
    """
    plat = current_platform()

    if plat == "linux":
        from backend.audio_recorder import AudioRecorder

        return AudioRecorder(*args, **kwargs)

    if plat == "macos":
        from backend.platform_stubs import MacOSAudioRecorder

        return MacOSAudioRecorder(*args, **kwargs)

    raise RuntimeError(f"Unsupported platform: {plat}")


# ---------------------------------------------------------------------------
# Injector
# ---------------------------------------------------------------------------


def get_injector(*args: Any, **kwargs: Any):
    """Return the appropriate :class:`BaseTextInjector` for this platform.

    On Linux this wraps the existing :class:`backend.text_injector.TextInjector`.
    On macOS this returns a stub (requires macOS-specific implementation).
    """
    plat = current_platform()

    if plat == "linux":
        from backend.text_injector import TextInjector

        return TextInjector(*args, **kwargs)

    if plat == "macos":
        from backend.platform_stubs import MacOSTextInjector

        return MacOSTextInjector(*args, **kwargs)

    raise RuntimeError(f"Unsupported platform: {plat}")


# ---------------------------------------------------------------------------
# Secret Store
# ---------------------------------------------------------------------------


def get_secret_store():
    """Return the appropriate :class:`BaseSecretStore` for this platform.

    On Linux this wraps the existing secret service backend.
    On macOS this returns a stub (requires Keychain implementation).
    """
    plat = current_platform()

    if plat == "linux":
        from backend.platform_stubs import LinuxSecretServiceStore

        return LinuxSecretServiceStore()

    if plat == "macos":
        from backend.platform_stubs import MacOSKeychainStore

        return MacOSKeychainStore()

    raise RuntimeError(f"Unsupported platform: {plat}")
