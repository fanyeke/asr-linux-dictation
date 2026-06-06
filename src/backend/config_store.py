"""Persistent user configuration storage backed by SQLite."""

from __future__ import annotations

from dataclasses import dataclass

from backend import sqlite_async
from backend.config import Settings
from backend.secret_store import load_secret, save_secret

ASR_SECRET_NAME = "asr_api_key"
LLM_SECRET_NAME = "llm_api_key"


@dataclass
class UserConfig:
    """User-configurable settings persisted across restarts."""

    asr_api_key: str | None = None
    asr_base_url: str = "https://token-plan-cn.xiaomimimo.com/v1"
    asr_model: str = "mimo-v2.5-asr"
    llm_api_key: str | None = None
    llm_enabled: bool = True
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    hotkey: str = "Alt+="
    ui_language: str = "zh"
    asr_language: str = "auto"

    def to_dict(self) -> dict:
        return {
            "asr_api_key": self.asr_api_key,
            "asr_base_url": self.asr_base_url,
            "asr_model": self.asr_model,
            "llm_api_key": self.llm_api_key,
            "llm_enabled": self.llm_enabled,
            "llm_base_url": self.llm_base_url,
            "llm_model": self.llm_model,
            "hotkey": self.hotkey,
            "ui_language": self.ui_language,
            "asr_language": self.asr_language,
        }

    @classmethod
    def from_dict(cls, data: dict) -> UserConfig:
        legacy_key = data.get("api_key") or None
        return cls(
            asr_api_key=data.get("asr_api_key") or legacy_key,
            asr_base_url=data.get("asr_base_url", cls.asr_base_url),
            asr_model=data.get("asr_model", cls.asr_model),
            llm_api_key=data.get("llm_api_key") or None,
            llm_enabled=data.get("llm_enabled", cls.llm_enabled),
            llm_base_url=data.get("llm_base_url", cls.llm_base_url),
            llm_model=data.get("llm_model", cls.llm_model),
            hotkey=data.get("hotkey", cls.hotkey),
            ui_language=data.get("ui_language", cls.ui_language),
            asr_language=data.get("asr_language", cls.asr_language),
        )


def _db_path() -> str:
    settings = Settings()
    return str(settings.data_dir / "asr-linux.db")


async def load_user_config() -> UserConfig:
    """Load user config from the database."""
    async with sqlite_async.connect(_db_path()) as db:
        cursor = await db.execute(
            "SELECT api_key, asr_api_key, asr_base_url, asr_model, "
            "llm_api_key, llm_enabled, llm_base_url, llm_model, hotkey, ui_language, asr_language "
            "FROM user_config WHERE id = 1"
        )
        row = await cursor.fetchone()
        if not row or all(v is None for v in row):
            config = UserConfig()
        else:
            legacy_key = row[0]
            config = UserConfig(
                asr_api_key=row[1] or legacy_key,
                asr_base_url=row[2] or UserConfig.asr_base_url,
                asr_model=row[3] or UserConfig.asr_model,
                llm_api_key=row[4],
                llm_enabled=bool(row[5]) if row[5] is not None else UserConfig.llm_enabled,
                llm_base_url=row[6] or UserConfig.llm_base_url,
                llm_model=row[7] or UserConfig.llm_model,
                hotkey=row[8] or UserConfig.hotkey,
                ui_language=row[9] or UserConfig.ui_language,
                asr_language=row[10] or UserConfig.asr_language,
            )

        asr_secret = await load_secret(ASR_SECRET_NAME)
        llm_secret = await load_secret(LLM_SECRET_NAME)
        if asr_secret:
            config.asr_api_key = asr_secret
        if llm_secret:
            config.llm_api_key = llm_secret
        return config


async def save_user_config(config: UserConfig) -> None:
    """Save user config to the database."""
    asr_stored_in_secret_service = await save_secret(
        ASR_SECRET_NAME,
        config.asr_api_key,
    )
    llm_stored_in_secret_service = await save_secret(
        LLM_SECRET_NAME,
        config.llm_api_key,
    )

    async with sqlite_async.connect(_db_path()) as db:
        await db.execute(
            """
            UPDATE user_config SET
                api_key = ?,
                asr_api_key = ?,
                asr_base_url = ?,
                asr_model = ?,
                llm_api_key = ?,
                llm_enabled = ?,
                llm_base_url = ?,
                llm_model = ?,
                hotkey = ?,
                ui_language = ?,
                asr_language = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
            """,
            (
                None,
                None if asr_stored_in_secret_service else config.asr_api_key,
                config.asr_base_url,
                config.asr_model,
                None if llm_stored_in_secret_service else config.llm_api_key,
                1 if config.llm_enabled else 0,
                config.llm_base_url,
                config.llm_model,
                config.hotkey,
                config.ui_language,
                config.asr_language,
            ),
        )
        await db.commit()
