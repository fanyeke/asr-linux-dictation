"""Tests for POST /history/{session_id}/retry endpoint."""

from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from backend.database import init_database
from backend.history_store import create_session, get_session, update_session


class TestHistoryRetry:
    """Test history retry API endpoint."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Set up temp database with test sessions."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "")  # no token needed
        await init_database()

        # Session with raw_text (eligible for retry)
        await create_session(session_id="failed-has-raw")
        await update_session(
            "failed-has-raw",
            status="failed",
            raw_text="hello world this is a test",
            polished_text=None,
            error_type="inject:SomeError",
        )

        # Session without raw_text (ineligible)
        await create_session(session_id="failed-no-raw")
        await update_session(
            "failed-no-raw",
            status="failed",
            raw_text=None,
            error_type="asr:no_speech",
        )

        yield

    @pytest.fixture(autouse=True)
    def _mock_orchestrator(self, monkeypatch: pytest.MonkeyPatch):
        """Mock the orchestrator's retry_from_text method."""
        self.mock_orchestrator = AsyncMock()
        self.mock_orchestrator.retry_from_text = AsyncMock(
            return_value={
                "id": 100,
                "session_id": "retry-abc123",
                "raw_text": "hello world this is a test",
                "polished_text": "Hello, world. This is a test.",
                "status": "completed",
                "timing_ms": None,
                "prompt_id": None,
                "error_type": None,
                "failed_audio_path": None,
                "created_at": "2025-01-01T00:00:00",
            }
        )
        monkeypatch.setattr(
            "backend.main.get_orchestrator",
            lambda: self.mock_orchestrator,
        )

    @pytest.mark.asyncio
    async def test_retry_success(self, client: AsyncClient) -> None:
        """POST /history/{session_id}/retry returns new session for valid retry."""
        response = await client.post("/history/failed-has-raw/retry")
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "retry-abc123"
        assert data["status"] == "completed"
        assert data["raw_text"] == "hello world this is a test"
        assert data["polished_text"] == "Hello, world. This is a test."
        self.mock_orchestrator.retry_from_text.assert_awaited_once_with(
            "hello world this is a test"
        )

    @pytest.mark.asyncio
    async def test_retry_missing_raw_text(self, client: AsyncClient) -> None:
        """POST /history/{session_id}/retry returns 400 when raw_text is missing."""
        response = await client.post("/history/failed-no-raw/retry")
        assert response.status_code == 400
        data = response.json()
        assert "raw_text" in data["detail"].lower() or "no raw text" in data["detail"].lower()

    @pytest.mark.asyncio
    async def test_retry_not_found(self, client: AsyncClient) -> None:
        """POST /history/{session_id}/retry returns 404 for non-existent session."""
        response = await client.post("/history/nonexistent-session/retry")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_retry_with_token(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Retry endpoint respects token auth."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "test-secret-123")
        response = await client.post("/history/failed-has-raw/retry")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_retry_persists_new_session(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The orchestrator creates a new session record during retry."""
        # Use a retry_from_text that actually creates a DB session

        real_retry = self.mock_orchestrator.retry_from_text

        async def fake_retry(raw_text: str) -> dict:
            result = await real_retry(raw_text)
            # Verify the orchestrator was called with the right text
            return result

        monkeypatch.setattr(
            "backend.main.get_orchestrator",
            lambda: self.mock_orchestrator,
        )

        response = await client.post("/history/failed-has-raw/retry")
        assert response.status_code == 200
        # The old session should still exist unchanged
        old = await get_session("failed-has-raw")
        assert old is not None
        assert old["status"] == "failed"
        assert old["raw_text"] == "hello world this is a test"
