"""Tests for structured logging configuration."""

import json
import logging
from pathlib import Path

import pytest

from backend.logging_config import configure_logging, get_logger


class TestLoggingConfiguration:
    """Test logging configuration and output format."""

    def test_json_lines_format(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Logs are written as JSON Lines."""
        log_file = tmp_path / "test.log"
        monkeypatch.setattr("backend.logging_config._get_log_file", lambda: log_file)

        configure_logging(log_level="info", log_file=log_file)
        logger = get_logger("test")
        logger.info("test message", key="value")

        # Force flush handlers
        for handler in logging.getLogger().handlers:
            handler.flush()

        lines = log_file.read_text().strip().split("\n")
        assert len(lines) == 1
        record = json.loads(lines[0])
        assert record["event"] == "test message"
        assert record["key"] == "value"
        assert "ts" in record
        assert "level" in record
        assert record["level"] == "INFO"

    def test_log_level_info(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Info level only logs info and above."""
        log_file = tmp_path / "test.log"
        configure_logging(log_level="info", log_file=log_file)
        logger = get_logger("test")
        logger.debug("debug msg")
        logger.info("info msg")

        for handler in logging.getLogger().handlers:
            handler.flush()

        lines = log_file.read_text().strip().split("\n")
        assert len(lines) == 1
        record = json.loads(lines[0])
        assert record["event"] == "info msg"

    def test_log_level_debug(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Debug level logs debug and above."""
        log_file = tmp_path / "test.log"
        configure_logging(log_level="debug", log_file=log_file)
        logger = get_logger("test")
        logger.debug("debug msg")
        logger.info("info msg")

        for handler in logging.getLogger().handlers:
            handler.flush()

        lines = log_file.read_text().strip().split("\n")
        assert len(lines) == 2

    def test_log_level_trace(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Trace level is accepted and maps to DEBUG."""
        log_file = tmp_path / "test.log"
        configure_logging(log_level="trace", log_file=log_file)
        logger = get_logger("test")
        logger.debug("debug msg")

        for handler in logging.getLogger().handlers:
            handler.flush()

        lines = log_file.read_text().strip().split("\n")
        assert len(lines) == 1


class TestLoggingRedaction:
    """Test that sensitive data is redacted from logs."""

    def test_api_key_redacted(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """API keys are not logged in plain text."""
        log_file = tmp_path / "test.log"
        configure_logging(log_level="info", log_file=log_file)
        logger = get_logger("test")
        logger.info(
            "request",
            api_key="secret123",
            asr_api_key="asr-secret",
            llm_api_key="llm-secret",
            authorization="Bearer token",
        )

        for handler in logging.getLogger().handlers:
            handler.flush()

        raw = log_file.read_text()
        assert "secret123" not in raw
        assert "asr-secret" not in raw
        assert "llm-secret" not in raw
        assert "Bearer token" not in raw
        record = json.loads(raw.strip().split("\n")[0])
        assert record["api_key"] == "***"
        assert record["asr_api_key"] == "***"
        assert record["llm_api_key"] == "***"
        assert record["authorization"] == "***"


class TestLoggingRotation:
    """Test log rotation behavior."""

    def test_rotation_by_size(self, tmp_path: Path) -> None:
        """Logs rotate when size limit is exceeded."""
        log_file = tmp_path / "test.log"
        configure_logging(log_level="info", log_file=log_file, max_bytes=100)
        logger = get_logger("test")

        # Write enough data to trigger rotation
        for _ in range(20):
            logger.info("x" * 50)

        for handler in logging.getLogger().handlers:
            handler.flush()

        # Should have rotated file
        rotated = list(tmp_path.glob("test.log.*"))
        assert len(rotated) >= 1

    def test_rotation_backup_count(self, tmp_path: Path) -> None:
        """Only configured number of backup files are kept."""
        log_file = tmp_path / "test.log"
        configure_logging(log_level="info", log_file=log_file, max_bytes=50, backup_count=2)
        logger = get_logger("test")

        for _ in range(100):
            logger.info("x" * 100)

        for handler in logging.getLogger().handlers:
            handler.flush()

        rotated = list(tmp_path.glob("test.log.*"))
        assert len(rotated) <= 2
