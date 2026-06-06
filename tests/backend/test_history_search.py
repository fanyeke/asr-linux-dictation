"""Tests for history search endpoint."""

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
    """Initialize DB and disable auth."""
    monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "")
    monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
    from backend.database import init_database

    import asyncio

    asyncio.run(init_database())
    monkeypatch.setattr(main, "_user_config", UserConfig())


class TestHistorySearch:
    """Test GET /history/search endpoint."""

    @pytest.mark.asyncio
    async def test_search_by_text(self, client: AsyncClient) -> None:
        """Search returns sessions matching text in raw_text or polished_text."""
        await create_session("s1")
        await update_session("s1", status="completed", raw_text="hello world", polished_text="Hello world.")
        await create_session("s2")
        await update_session("s2", status="completed", raw_text="goodbye world", polished_text="Goodbye world.")

        response = await client.get("/history/search?q=hello")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["session_id"] == "s1"

    @pytest.mark.asyncio
    async def test_search_by_polished_text(self, client: AsyncClient) -> None:
        """Search matches against polished_text."""
        await create_session("s1")
        await update_session("s1", status="completed", raw_text="raw1", polished_text="Polished result one.")
        await create_session("s2")
        await update_session("s2", status="completed", raw_text="raw2", polished_text="Second result here.")

        response = await client.get("/history/search?q=result")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    @pytest.mark.asyncio
    async def test_search_by_status(self, client: AsyncClient) -> None:
        """Search filters by status when provided."""
        await create_session("s1")
        await update_session("s1", status="completed", raw_text="done")
        await create_session("s2")
        await update_session("s2", status="failed", raw_text="failed", error_type="asr:timeout")

        response = await client.get("/history/search?status=completed")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_search_combined(self, client: AsyncClient) -> None:
        """Search combines text query and status filter."""
        await create_session("s1")
        await update_session("s1", status="completed", raw_text="hello world")
        await create_session("s2")
        await update_session("s2", status="failed", raw_text="hello again", error_type="asr:timeout")

        response = await client.get("/history/search?q=hello&status=completed")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["session_id"] == "s1"

    @pytest.mark.asyncio
    async def test_search_no_results(self, client: AsyncClient) -> None:
        """Search returns empty list when nothing matches."""
        await create_session("s1")
        await update_session("s1", status="completed", raw_text="hello")

        response = await client.get("/history/search?q=nonexistent")
        assert response.status_code == 200
        data = response.json()
        assert data == []

    @pytest.mark.asyncio
    async def test_search_empty_query_returns_all(self, client: AsyncClient) -> None:
        """Empty or missing q returns all sessions (like GET /history)."""
        await create_session("s1")
        await update_session("s1", status="completed", raw_text="hello")
        await create_session("s2")
        await update_session("s2", status="failed", raw_text="world")

        response = await client.get("/history/search")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
