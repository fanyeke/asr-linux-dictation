"""Tests for GET /diagnostics/export endpoint."""

import zipfile
from io import BytesIO
from pathlib import Path

import pytest
from httpx import AsyncClient

from backend.config_store import UserConfig, save_user_config
from backend.database import init_database
from backend.history_store import create_session, update_session


class TestDiagnosticsExport:
    """Test diagnostics export API endpoint."""

    @pytest.fixture(autouse=True)
    async def setup(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Set up temp environment with database, log file, and history records."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "")
        await init_database()

        # Create a log file
        log_dir = tmp_path / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / "asr-linux.log"
        log_file.write_text(
            "2025-01-01T00:00:00 INFO test log line 1\n"
            "2025-01-01T00:00:01 ERROR something went wrong\n"
            "2025-01-01T00:00:02 WARN something suspicious\n"
        )

        # Save user config with API keys (should be redacted in output)
        config = UserConfig(
            asr_api_key="asr-test-secret-12345",
            llm_api_key="llm-test-secret-12345",
            asr_base_url="https://asr.example.com/v1",
            asr_model="test-model",
            llm_base_url="https://llm.example.com/v1",
            llm_model="test-llm",
            hotkey="Ctrl+Space",
        )
        await save_user_config(config)

        # Create 25 history records (last 20 should be included)
        for i in range(25):
            await create_session(session_id=f"diag-session-{i}")
            await update_session(
                f"diag-session-{i}",
                status="completed" if i % 2 == 0 else "failed",
                raw_text=f"test transcript {i}",
                polished_text=f"Test transcript {i}." if i % 2 == 0 else None,
                error_type=None if i % 2 == 0 else "asr:no_speech",
            )

        yield

    @pytest.mark.asyncio
    async def test_diagnostics_returns_zip(self, client: AsyncClient) -> None:
        """GET /diagnostics/export returns a zip file."""
        response = await client.get("/diagnostics/export")
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/zip"
        assert "attachment" in response.headers.get("content-disposition", "")
        assert response.headers["content-disposition"].endswith(".zip")

    @pytest.mark.asyncio
    async def test_diagnostics_zip_contents(self, client: AsyncClient) -> None:
        """The zip contains expected files."""
        response = await client.get("/diagnostics/export")
        assert response.status_code == 200

        zf = zipfile.ZipFile(BytesIO(response.content))
        names = zf.namelist()
        assert "history.json" in names
        assert "user_config.json" in names
        assert "asr-linux.log" in names

    @pytest.mark.asyncio
    async def test_diagnostics_user_config_redacted(self, client: AsyncClient) -> None:
        """The user_config.json has API keys redacted."""
        import json

        response = await client.get("/diagnostics/export")
        assert response.status_code == 200

        zf = zipfile.ZipFile(BytesIO(response.content))
        config_data = json.loads(zf.read("user_config.json"))
        assert config_data["asr_api_key"] == "***"
        assert config_data["llm_api_key"] == "***"
        assert config_data["asr_base_url"] == "https://asr.example.com/v1"
        assert config_data["hotkey"] == "Ctrl+Space"

    @pytest.mark.asyncio
    async def test_diagnostics_history_limit(self, client: AsyncClient) -> None:
        """The zip includes last 20 history records."""
        import json

        response = await client.get("/diagnostics/export")
        assert response.status_code == 200

        zf = zipfile.ZipFile(BytesIO(response.content))
        history = json.loads(zf.read("history.json"))
        assert len(history) == 20

    @pytest.mark.asyncio
    async def test_diagnostics_log_content(self, client: AsyncClient) -> None:
        """The zip includes the log file content."""
        response = await client.get("/diagnostics/export")
        assert response.status_code == 200

        zf = zipfile.ZipFile(BytesIO(response.content))
        log_content = zf.read("asr-linux.log").decode("utf-8")
        assert "test log line 1" in log_content
        assert "ERROR" in log_content

    @pytest.mark.asyncio
    async def test_diagnostics_with_token(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Diagnostics endpoint respects token auth."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "test-secret-123")
        response = await client.get("/diagnostics/export")
        assert response.status_code == 401
