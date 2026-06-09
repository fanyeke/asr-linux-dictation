"""Tests for platform detection and platform-specific components."""

from __future__ import annotations

from pathlib import Path

import pytest

from backend.platform import (
    current_platform,
    get_injector,
    get_recorder,
    get_secret_store,
    is_linux,
    is_macos,
)
from backend.platform_interfaces import (
    BaseAudioRecorder,
    BaseSecretStore,
    BaseTextInjector,
)
from backend.platform_stubs import (
    LinuxSecretServiceStore,
    MacOSAudioRecorder,
    MacOSKeychainStore,
    MacOSTextInjector,
    UnsupportedPlatformError,
)


class TestPlatformDetection:
    """Test platform identification."""

    def test_current_platform_is_expected(self) -> None:
        """current_platform() returns a known value."""
        plat = current_platform()
        assert plat in ("linux", "macos", "windows")

    def test_is_linux_or_macos(self) -> None:
        """is_linux() and is_macos() don't both return True."""
        assert is_linux() != is_macos()  # XOR for the two common platforms


class TestFactoryFunctions:
    """Test platform factory functions return the right types."""

    def test_get_recorder_returns_base_type(self) -> None:
        """get_recorder() returns something that implements BaseAudioRecorder."""
        recorder = get_recorder()
        assert isinstance(recorder, BaseAudioRecorder)

    def test_get_injector_returns_base_type(self) -> None:
        """get_injector() returns something that implements BaseTextInjector."""
        injector = get_injector()
        assert isinstance(injector, BaseTextInjector)

    def test_get_secret_store_returns_base_type(self) -> None:
        """get_secret_store() returns something that implements BaseSecretStore."""
        store = get_secret_store()
        assert isinstance(store, BaseSecretStore)


class TestLinuxSecretServiceStore:
    """Test Linux Secret Service wrapper."""

    def test_implements_interface(self) -> None:
        """LinuxSecretServiceStore conforms to BaseSecretStore."""
        store = LinuxSecretServiceStore()
        assert isinstance(store, BaseSecretStore)

    @pytest.mark.asyncio
    async def test_is_available_returns_bool(self) -> None:
        """is_available() returns a boolean (might be False without secret-tool)."""
        store = LinuxSecretServiceStore()
        available = store.is_available()
        assert isinstance(available, bool)

    @pytest.mark.asyncio
    async def test_save_load_cycle(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test save/load cycle with a mocked secret-tool."""
        call_log: list[list[str]] = []

        async def mock_save(name: str, value: str | None) -> bool:
            call_log.append(["save", name, str(value)])
            return True

        async def mock_load(name: str) -> str | None:
            call_log.append(["load", name])
            return "mocked-secret-value"

        monkeypatch.setattr("backend.secret_store.save_secret", mock_save)
        monkeypatch.setattr("backend.secret_store.load_secret", mock_load)

        store = LinuxSecretServiceStore()
        assert await store.save_secret("test_key", "test_value") is True
        assert await store.load_secret("test_key") == "mocked-secret-value"
        assert len(call_log) == 2


class TestMacOSStubs:
    """Test macOS stubs raise proper errors."""

    def test_recorder_raises_on_start(self) -> None:
        """MacOSAudioRecorder.start() raises UnsupportedPlatformError."""
        recorder = MacOSAudioRecorder()
        with pytest.raises(UnsupportedPlatformError):
            import asyncio

            asyncio.run(recorder.start())

    def test_recorder_raises_on_stop(self) -> None:
        """MacOSAudioRecorder.stop() raises UnsupportedPlatformError."""
        recorder = MacOSAudioRecorder()
        with pytest.raises(UnsupportedPlatformError):
            import asyncio

            asyncio.run(recorder.stop())

    def test_injector_raises_on_inject(self) -> None:
        """MacOSTextInjector.inject() raises UnsupportedPlatformError."""
        injector = MacOSTextInjector()
        with pytest.raises(UnsupportedPlatformError):
            import asyncio

            asyncio.run(injector.inject("test"))

    def test_keychain_is_not_available(self) -> None:
        """MacOSKeychainStore.is_available() returns False."""
        store = MacOSKeychainStore()
        assert store.is_available() is False

    def test_keychain_raises_on_load(self) -> None:
        """MacOSKeychainStore.load() raises UnsupportedPlatformError."""
        store = MacOSKeychainStore()
        with pytest.raises(UnsupportedPlatformError):
            import asyncio

            asyncio.run(store.load_secret("test"))
