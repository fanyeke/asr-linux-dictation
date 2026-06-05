"""Tests for configuration loading and validation."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.config import Settings


class TestConfigDefaults:
    """Test default configuration values."""

    def test_default_log_level(self) -> None:
        """Default log level is 'info'."""
        settings = Settings()
        assert settings.log_level == "info"

    def test_default_host(self) -> None:
        """Default host is '127.0.0.1'."""
        settings = Settings()
        assert settings.host == "127.0.0.1"

    def test_default_port(self) -> None:
        """Default port is 0 (ephemeral)."""
        settings = Settings()
        assert settings.port == 0

    def test_default_data_dir(self) -> None:
        """Default data dir uses XDG path."""
        settings = Settings()
        assert settings.data_dir is not None
        assert "asr-linux" in str(settings.data_dir)


class TestConfigEnvVars:
    """Test configuration from environment variables."""

    def test_env_prefix_applied(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """ASR_LINUX_ prefix is required for env vars."""
        monkeypatch.setenv("ASR_LINUX_LOG_LEVEL", "debug")
        settings = Settings()
        assert settings.log_level == "debug"

    def test_port_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Port can be overridden via env var."""
        monkeypatch.setenv("ASR_LINUX_PORT", "8080")
        settings = Settings()
        assert settings.port == 8080

    def test_host_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Host can be overridden via env var."""
        monkeypatch.setenv("ASR_LINUX_HOST", "0.0.0.0")
        settings = Settings()
        assert settings.host == "0.0.0.0"

    def test_secret_token_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Secret token can be set via env var."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "test-token-123")
        settings = Settings()
        assert settings.secret_token == "test-token-123"


class TestConfigEnvFile:
    """Test configuration from .env file."""

    def test_env_file_loading(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Settings can be loaded from a .env file."""
        env_file = tmp_path / ".env"
        env_file.write_text("ASR_LINUX_LOG_LEVEL=debug\nASR_LINUX_PORT=9000\n")
        monkeypatch.setenv("ASR_LINUX_ENV_FILE", str(env_file))

        settings = Settings(_env_file=str(env_file))
        assert settings.log_level == "debug"
        assert settings.port == 9000


class TestConfigValidation:
    """Test configuration validation."""

    def test_invalid_log_level_rejected(self) -> None:
        """Invalid log level values are rejected."""
        with pytest.raises(ValidationError):
            Settings(log_level="invalid")

    def test_negative_port_rejected(self) -> None:
        """Negative port values are rejected."""
        with pytest.raises(ValidationError):
            Settings(port=-1)

    def test_port_too_high_rejected(self) -> None:
        """Port values above 65535 are rejected."""
        with pytest.raises(ValidationError):
            Settings(port=70000)


class TestConfigDataDir:
    """Test data directory configuration."""

    def test_data_dir_from_env(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        """Data dir can be overridden via env var."""
        custom_dir = tmp_path / "custom-data"
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(custom_dir))
        settings = Settings()
        assert settings.data_dir == custom_dir

    def test_data_dir_creates_parent(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Data dir parent is created if it doesn't exist."""
        nested_dir = tmp_path / "nested" / "asr-linux"
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(nested_dir))
        settings = Settings()
        assert settings.data_dir == nested_dir
