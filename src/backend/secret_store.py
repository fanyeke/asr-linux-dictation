"""Optional Linux Secret Service storage via secret-tool."""

from __future__ import annotations

import asyncio
import shutil

from backend.logging_config import get_logger

APP_ATTR = "application"
APP_VALUE = "asr-linux"
KEY_ATTR = "key"
COMMAND_TIMEOUT_SECONDS = 3.0

logger = get_logger(__name__)


def is_secret_service_available() -> bool:
    """Return whether the Secret Service CLI is available."""
    return shutil.which("secret-tool") is not None


async def load_secret(name: str) -> str | None:
    """Load a secret value from Linux Secret Service if available."""
    if not is_secret_service_available():
        return None

    try:
        proc = await asyncio.create_subprocess_exec(
            "secret-tool",
            "lookup",
            APP_ATTR,
            APP_VALUE,
            KEY_ATTR,
            name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=COMMAND_TIMEOUT_SECONDS,
        )
    except (TimeoutError, OSError) as exc:
        logger.warning("secret_load_failed", key_name=name, error_type=type(exc).__name__)
        return None

    if proc.returncode != 0:
        return None
    value = stdout.decode("utf-8").strip()
    return value or None


async def save_secret(name: str, value: str | None) -> bool:
    """Save or clear a secret through Linux Secret Service.

    Returns ``False`` when Secret Service is unavailable or the command fails so
    callers can fall back to SQLite persistence.
    """
    if not is_secret_service_available():
        return False

    if not value:
        return await clear_secret(name)

    try:
        proc = await asyncio.create_subprocess_exec(
            "secret-tool",
            "store",
            f"--label=ASR Linux {name}",
            APP_ATTR,
            APP_VALUE,
            KEY_ATTR,
            name,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(
            proc.communicate(input=value.encode("utf-8")),
            timeout=COMMAND_TIMEOUT_SECONDS,
        )
    except (TimeoutError, OSError) as exc:
        logger.warning("secret_save_failed", key_name=name, error_type=type(exc).__name__)
        return False

    if proc.returncode != 0:
        logger.warning("secret_save_failed", key_name=name, status_code=proc.returncode)
        return False

    logger.info("secret_saved", key_name=name)
    return True


async def clear_secret(name: str) -> bool:
    """Clear a secret value from Linux Secret Service if available."""
    if not is_secret_service_available():
        return False

    try:
        proc = await asyncio.create_subprocess_exec(
            "secret-tool",
            "clear",
            APP_ATTR,
            APP_VALUE,
            KEY_ATTR,
            name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=COMMAND_TIMEOUT_SECONDS)
    except (TimeoutError, OSError) as exc:
        logger.warning("secret_clear_failed", key_name=name, error_type=type(exc).__name__)
        return False

    if proc.returncode not in (0, 1):
        logger.warning("secret_clear_failed", key_name=name, status_code=proc.returncode)
        return False
    return True
