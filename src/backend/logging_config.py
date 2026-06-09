"""Structured logging configuration."""

import logging
import logging.handlers
import sys
from pathlib import Path

import structlog

# Sensitive keys that should be redacted
_SENSITIVE_KEYS = {
    "api_key",
    "asr_api_key",
    "llm_api_key",
    "authorization",
    "token",
    "secret",
    "password",
}


def _uppercase_level(
    _logger: structlog.types.WrappedLogger,
    _method_name: str,
    event_dict: dict,
) -> dict:
    """Convert log level to uppercase."""
    if "level" in event_dict:
        event_dict["level"] = event_dict["level"].upper()
    return event_dict


def _redact_sensitive(
    _logger: structlog.types.WrappedLogger,
    _method_name: str,
    event_dict: dict,
) -> dict:
    """Redact sensitive values from log events."""
    for key in event_dict:
        if key.lower() in _SENSITIVE_KEYS:
            event_dict[key] = "***"
    return event_dict


def configure_logging(
    log_level: str = "info",
    log_file: Path | None = None,
    max_bytes: int = 10 * 1024 * 1024,  # 10 MB
    backup_count: int = 5,
) -> None:
    """Configure structured JSON Lines logging.

    Args:
        log_level: One of 'info', 'debug', 'trace'.
        log_file: Path to log file. If None, logs to stdout only.
        max_bytes: Maximum size of a single log file before rotation.
        backup_count: Number of rotated log files to keep.
    """
    level_map = {"info": logging.INFO, "debug": logging.DEBUG, "trace": logging.DEBUG}
    level = level_map.get(log_level.lower(), logging.INFO)

    # Reset existing handlers
    root = logging.getLogger()
    root.handlers = []
    root.setLevel(level)

    # Configure structlog processors
    shared_processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso", key="ts"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        _uppercase_level,
        _redact_sensitive,
    ]

    structlog.configure(
        processors=shared_processors + [structlog.processors.JSONRenderer(ensure_ascii=False)],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # File handler with rotation
    if log_file is not None:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8",
        )
        file_handler.setLevel(level)
        formatter = logging.Formatter("%(message)s")
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_formatter = logging.Formatter("%(message)s")
    console_handler.setFormatter(console_formatter)
    root.addHandler(console_handler)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a structured logger by name."""
    return structlog.get_logger(name)


def _get_log_file() -> Path | None:
    """Return default log file path."""
    return None
