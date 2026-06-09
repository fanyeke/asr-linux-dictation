"""Application configuration."""

import os
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_data_dir() -> Path:
    """Return default data directory using XDG paths."""
    xdg_data_home = os.environ.get("XDG_DATA_HOME")
    if xdg_data_home:
        return Path(xdg_data_home) / "asr-linux"
    return Path.home() / ".local" / "share" / "asr-linux"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_prefix="ASR_LINUX_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    log_level: str = Field(default="info", pattern=r"^(info|debug|trace)$")
    host: str = "127.0.0.1"
    port: int = Field(default=0, ge=0, le=65535)
    secret_token: str | None = None
    data_dir: Path = Field(default_factory=_default_data_dir)

    @field_validator("data_dir", mode="before")
    @classmethod
    def _ensure_path(cls, v: str | Path | None) -> Path:
        """Ensure data_dir is a Path and create parent directories."""
        path = _default_data_dir() if v is None else Path(v)
        path.mkdir(parents=True, exist_ok=True)
        return path

    # Audio recording settings
    audio_sample_rate: int = Field(default=16000, ge=8000, le=48000)
    audio_channels: int = Field(default=1, ge=1, le=2)
    audio_device: str | None = None
    audio_format: str = Field(default="S16_LE", pattern=r"^(S16_LE|S24_LE|S32_LE)$")
    silence_threshold: float = Field(default=0.005, ge=0.0, le=1.0)
    silence_duration_ms: int = Field(default=2000, ge=0)

    # ASR language setting (e.g. "zh", "en", "auto")
    asr_language: str = Field(default="auto")

    # MiMo API key (can be set via env var or runtime config API)
    mimo_api_key: str | None = Field(default=None)


settings = Settings()


def has_asr_key() -> bool:
    """Return True if an ASR API key is available from settings or the environment."""
    return settings.mimo_api_key is not None or bool(os.environ.get("ASR_LINUX_MIMO_API_KEY"))


def has_llm_key() -> bool:
    """Return True if an LLM API key is available from the environment."""
    return bool(os.environ.get("ASR_LINUX_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY"))
