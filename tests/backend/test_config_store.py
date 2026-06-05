"""Tests for persistent user configuration storage."""

from pathlib import Path

import pytest

from backend import sqlite_async
from backend.config_store import UserConfig, load_user_config, save_user_config
from backend.database import get_db_path, init_database


@pytest.fixture(autouse=True)
def disable_secret_service(monkeypatch: pytest.MonkeyPatch) -> None:
    """Default tests to the SQLite fallback path unless they opt in."""

    async def fake_save_secret(_name: str, _value: str | None) -> bool:
        return False

    async def fake_load_secret(_name: str) -> str | None:
        return None

    monkeypatch.setattr("backend.config_store.save_secret", fake_save_secret)
    monkeypatch.setattr("backend.config_store.load_secret", fake_load_secret)


@pytest.mark.asyncio
async def test_save_load_split_api_keys_and_llm_toggle(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """User config stores ASR and LLM credentials independently."""
    monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
    await init_database()

    await save_user_config(
        UserConfig(
            asr_api_key="asr-secret",
            llm_api_key="llm-secret",
            asr_base_url="https://asr.example.com/v1",
            asr_model="asr-model",
            llm_enabled=False,
            llm_base_url="https://openai.example.com/v1",
            llm_model="gpt-test",
            hotkey="Ctrl+Alt+Space",
        )
    )

    loaded = await load_user_config()

    assert loaded.asr_api_key == "asr-secret"
    assert loaded.llm_api_key == "llm-secret"
    assert loaded.asr_base_url == "https://asr.example.com/v1"
    assert loaded.asr_model == "asr-model"
    assert loaded.llm_enabled is False
    assert loaded.llm_base_url == "https://openai.example.com/v1"
    assert loaded.llm_model == "gpt-test"
    assert loaded.hotkey == "Ctrl+Alt+Space"


@pytest.mark.asyncio
async def test_secret_service_success_keeps_api_keys_out_of_database(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When Secret Service stores keys, SQLite stores only non-secret config."""
    monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
    stored: dict[str, str | None] = {}

    async def fake_save_secret(name: str, value: str | None) -> bool:
        stored[name] = value
        return True

    async def fake_load_secret(name: str) -> str | None:
        return stored.get(name)

    monkeypatch.setattr("backend.config_store.save_secret", fake_save_secret)
    monkeypatch.setattr("backend.config_store.load_secret", fake_load_secret)
    await init_database()

    await save_user_config(
        UserConfig(
            asr_api_key="asr-secret",
            llm_api_key="llm-secret",
            asr_base_url="https://asr.example.com/v1",
            llm_base_url="https://llm.example.com/v1",
        )
    )

    async with sqlite_async.connect(get_db_path()) as db:
        cursor = await db.execute(
            "SELECT asr_api_key, llm_api_key FROM user_config WHERE id = 1"
        )
        row = await cursor.fetchone()

    assert row == (None, None)
    assert stored == {
        "asr_api_key": "asr-secret",
        "llm_api_key": "llm-secret",
    }
    loaded = await load_user_config()
    assert loaded.asr_api_key == "asr-secret"
    assert loaded.llm_api_key == "llm-secret"


@pytest.mark.asyncio
async def test_secret_service_values_override_legacy_database_keys(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Keyring values take precedence over legacy plaintext database keys."""
    monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))

    async def fake_load_secret(name: str) -> str | None:
        return {
            "asr_api_key": "keyring-asr",
            "llm_api_key": "keyring-llm",
        }.get(name)

    monkeypatch.setattr("backend.config_store.load_secret", fake_load_secret)
    await init_database()

    async with sqlite_async.connect(get_db_path()) as db:
        await db.execute(
            """
            UPDATE user_config
            SET asr_api_key = ?, llm_api_key = ?
            WHERE id = 1
            """,
            ("db-asr", "db-llm"),
        )
        await db.commit()

    loaded = await load_user_config()

    assert loaded.asr_api_key == "keyring-asr"
    assert loaded.llm_api_key == "keyring-llm"


def test_legacy_api_key_maps_to_asr_key() -> None:
    """Old config payloads use the single api_key as the ASR key only."""
    config = UserConfig.from_dict({"api_key": "legacy-secret"})

    assert config.asr_api_key == "legacy-secret"
    assert config.llm_api_key is None
