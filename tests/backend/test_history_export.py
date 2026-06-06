"""Tests for history export endpoints."""

from pathlib import Path

import pytest
from httpx import AsyncClient

import backend.main as main
from backend.config_store import UserConfig
from backend.history_store import create_session, update_session


@pytest.fixture(autouse=True)
def setup(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """Initialize DB and disable auth for export tests."""
    monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "")
    monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
    from backend.database import init_database

    import asyncio

    asyncio.run(init_database())
    monkeypatch.setattr(main, "_user_config", UserConfig())


class TestHistoryExport:
    """Test history export in txt and md formats."""

    @pytest.mark.asyncio
    async def test_export_txt_format(
        self,
        client: AsyncClient,
    ) -> None:
        """Export returns txt format with timestamp and text per line."""
        # Seed data
        s1 = await create_session("session-001")
        await update_session(
            "session-001",
            status="completed",
            raw_text="hello world",
            polished_text="Hello world.",
        )
        s2 = await create_session("session-002")
        await update_session(
            "session-002",
            status="failed",
            raw_text="hi there",
            polished_text=None,
            error_type="asr:timeout",
        )

        response = await client.get("/history/export?format=txt")
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/plain; charset=utf-8"
        content = response.text

        # Should contain polished text lines
        assert "Hello world." in content

        # Failed sessions should use raw_text if no polished_text
        assert "hi there" in content

        # Each line should have a timestamp prefix (format: [YYYY-MM-DD or similar])
        assert "[" in content

    @pytest.mark.asyncio
    async def test_export_md_format(
        self,
        client: AsyncClient,
    ) -> None:
        """Export returns md format with structured fields."""
        s1 = await create_session("session-003")
        await update_session(
            "session-003",
            status="completed",
            raw_text="test raw",
            polished_text="Test polished.",
            timing_ms=1500,
        )

        response = await client.get("/history/export?format=md")
        assert response.status_code == 200
        assert "text/markdown" in response.headers["content-type"]
        content = response.text

        # Should be structured markdown
        assert "##" in content or "|" in content  # headers or tables
        assert "Test polished." in content
        assert "test raw" in content
        assert "completed" in content

    @pytest.mark.asyncio
    async def test_export_empty_history(
        self,
        client: AsyncClient,
    ) -> None:
        """Export with no history returns valid empty output."""
        response = await client.get("/history/export?format=txt")
        assert response.status_code == 200
        assert response.text == "" or "No history" in response.text

    @pytest.mark.asyncio
    async def test_export_invalid_format(
        self,
        client: AsyncClient,
    ) -> None:
        """Invalid format parameter returns 400."""
        response = await client.get("/history/export?format=pdf")
        assert response.status_code == 400
