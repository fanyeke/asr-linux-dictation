"""Platform-specific implementations and stubs.

Linux implementations wrap the existing modules for backward compatibility.
macOS and Windows stubs raise clear ``NotImplementedError`` messages with
pointers on how to implement them.
"""

from __future__ import annotations

from typing import Any

from backend.logging_config import get_logger
from backend.platform_interfaces import BaseAudioRecorder, BaseSecretStore, BaseTextInjector

logger = get_logger(__name__)

# ======================================================================
# Linux Implementations
# ======================================================================


class LinuxSecretServiceStore(BaseSecretStore):
    """Linux Secret Service keyring via ``secret-tool``."""

    def is_available(self) -> bool:
        from backend.secret_store import is_secret_service_available

        return is_secret_service_available()

    async def load_secret(self, name: str) -> str | None:
        from backend.secret_store import load_secret as _load

        return await _load(name)

    async def save_secret(self, name: str, value: str | None) -> bool:
        from backend.secret_store import save_secret as _save

        return await _save(name, value)


# ======================================================================
# macOS Stubs
# ======================================================================


class UnsupportedPlatformError(NotImplementedError):
    """Raised when a platform-specific implementation is missing."""

    def __init__(self, component: str, platform: str = "macOS") -> None:
        super().__init__(
            f"{component} is not yet implemented for {platform}. "
            f"Contributions welcome! See "
            f"https://github.com/fanyeke/asr-linux-dictation/issues/16"
        )


class MacOSAudioRecorder(BaseAudioRecorder):
    """macOS audio recorder stub.

    Requires an implementation using ``AVFoundation`` via ``PyAudio``
    or ``CoreAudio`` directly.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        logger.warning(
            "platform_stub_used",
            component="MacOSAudioRecorder",
            platform="macOS",
        )

    async def start(self) -> str:
        raise UnsupportedPlatformError("MacOSAudioRecorder.start")

    async def stop(self) -> str | None:
        raise UnsupportedPlatformError("MacOSAudioRecorder.stop")

    async def get_level(self) -> float:
        raise UnsupportedPlatformError("MacOSAudioRecorder.get_level")

    @property
    def is_recording(self) -> bool:
        raise UnsupportedPlatformError("MacOSAudioRecorder.is_recording")


class MacOSTextInjector(BaseTextInjector):
    """macOS text injector stub.

    Requires an implementation using the Accessibility API
    (``CGEventPostKeyboard`` via PyObjC or similar).
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        logger.warning(
            "platform_stub_used",
            component="MacOSTextInjector",
            platform="macOS",
        )

    async def inject(self, text: str) -> Any:
        raise UnsupportedPlatformError("MacOSTextInjector.inject")


class MacOSKeychainStore(BaseSecretStore):
    """macOS Keychain stub.

    Requires an implementation using the ``keyring`` library
    or ``security`` CLI tool.
    """

    def __init__(self) -> None:
        logger.warning(
            "platform_stub_used",
            component="MacOSKeychainStore",
            platform="macOS",
        )

    def is_available(self) -> bool:
        return False

    async def load_secret(self, name: str) -> str | None:
        raise UnsupportedPlatformError("MacOSKeychainStore.load_secret")

    async def save_secret(self, name: str, value: str | None) -> bool:
        raise UnsupportedPlatformError("MacOSKeychainStore.save_secret")
