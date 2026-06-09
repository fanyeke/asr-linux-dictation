"""Tests for the autostart module."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from backend import autostart


class TestAutostart:
    """Test autostart module functions."""

    def test_install_creates_desktop_file(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """install() creates a valid .desktop file."""
        autostart_dir = tmp_path / "autostart"
        monkeypatch.setattr(autostart, "_autostart_dir", lambda: autostart_dir)
        monkeypatch.setattr(autostart, "_detect_exec_path", lambda: "/usr/bin/asr-linux")

        result = autostart.install()
        assert result is True

        desktop_file = autostart_dir / "asr-linux.desktop"
        assert desktop_file.exists()
        content = desktop_file.read_text()
        assert "Name=ASR Linux" in content
        assert "Exec=/usr/bin/asr-linux" in content
        assert "Type=Application" in content

    def test_is_enabled_returns_true_after_install(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """is_enabled() returns True after install()."""
        autostart_dir = tmp_path / "autostart"
        monkeypatch.setattr(autostart, "_autostart_dir", lambda: autostart_dir)
        monkeypatch.setattr(autostart, "_detect_exec_path", lambda: "/usr/bin/asr-linux")

        assert autostart.is_enabled() is False
        autostart.install()
        assert autostart.is_enabled() is True

    def test_remove_deletes_desktop_file(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """remove() deletes the .desktop file."""
        autostart_dir = tmp_path / "autostart"
        monkeypatch.setattr(autostart, "_autostart_dir", lambda: autostart_dir)
        monkeypatch.setattr(autostart, "_detect_exec_path", lambda: "/usr/bin/asr-linux")

        autostart.install()
        assert autostart.is_enabled() is True

        result = autostart.remove()
        assert result is True
        assert autostart.is_enabled() is False

    def test_remove_when_not_installed(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """remove() returns True even if no .desktop file exists."""
        autostart_dir = tmp_path / "autostart"
        monkeypatch.setattr(autostart, "_autostart_dir", lambda: autostart_dir)

        result = autostart.remove()
        assert result is True

    def test_detect_appimage(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """_detect_exec_path returns APPIMAGE path when set."""
        monkeypatch.setenv("APPIMAGE", "/home/user/ASR-Linux.AppImage")
        monkeypatch.delenv("XDG_CONFIG_HOME", raising=False)

        path = autostart._detect_exec_path()
        assert path == "/home/user/ASR-Linux.AppImage"

    def test_detect_no_appimage(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """_detect_exec_path returns default when APPIMAGE is not set."""
        monkeypatch.delenv("APPIMAGE", raising=False)
        monkeypatch.delenv("XDG_CONFIG_HOME", raising=False)

        path = autostart._detect_exec_path()
        assert isinstance(path, str)
        assert path  # non-empty string

    def test_xdg_config_home_respected(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """_autostart_dir uses XDG_CONFIG_HOME when set."""
        monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
        expected = tmp_path / "autostart"
        assert autostart._autostart_dir() == expected

    def test_default_autostart_dir(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """_autostart_dir falls back to ~/.config/autostart."""
        monkeypatch.delenv("XDG_CONFIG_HOME", raising=False)
        expected = Path.home() / ".config" / "autostart"
        assert autostart._autostart_dir() == expected


class TestAutostartAPI:
    """Test autostart API endpoints."""

    @pytest.mark.asyncio
    async def test_get_autostart_disabled(self, client: Any, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        """GET /autostart returns enabled=false when not installed."""
        monkeypatch.setattr("backend.autostart._autostart_dir", lambda: tmp_path / "autostart")
        response = await client.get("/autostart")
        assert response.status_code == 200
        assert response.json()["enabled"] is False

    @pytest.mark.asyncio
    async def test_post_autostart_enable(self, client: Any, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        """POST /autostart with enabled=true creates the .desktop file."""
        autostart_dir = tmp_path / "autostart"
        monkeypatch.setattr("backend.autostart._autostart_dir", lambda: autostart_dir)
        monkeypatch.setattr("backend.autostart._detect_exec_path", lambda: "/usr/bin/asr-linux")

        response = await client.post("/autostart", json={"enabled": True})
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is True
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_post_autostart_disable(self, client: Any, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        """POST /autostart with enabled=false removes the .desktop file."""
        autostart_dir = tmp_path / "autostart"
        monkeypatch.setattr("backend.autostart._autostart_dir", lambda: autostart_dir)
        monkeypatch.setattr("backend.autostart._detect_exec_path", lambda: "/usr/bin/asr-linux")

        # Enable first
        autostart.install()
        assert autostart.is_enabled() is True

        # Then disable
        response = await client.post("/autostart", json={"enabled": False})
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False
        assert data["success"] is True
