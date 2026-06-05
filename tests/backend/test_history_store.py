"""Tests for history store."""

from pathlib import Path

import pytest

from backend.database import init_database
from backend.history_store import (
    create_session,
    get_failed_sessions,
    get_session,
    list_sessions,
    mark_retry,
    update_session,
)


class TestHistoryStore:
    """Test history store CRUD operations."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_create_session(self) -> None:
        """create_session stores a new session with defaults."""
        session = await create_session(
            session_id="session-1",
            prompt_id=1,
        )
        assert session["session_id"] == "session-1"
        assert session["prompt_id"] == 1
        assert session["status"] == "recording"
        assert session["raw_text"] is None
        assert session["polished_text"] is None
        assert session["timing_ms"] is None
        assert session["error_type"] is None
        assert session["failed_audio_path"] is None
        assert session["id"] == 1
        assert "created_at" in session

    @pytest.mark.asyncio
    async def test_create_session_without_prompt(self) -> None:
        """create_session works without prompt_id."""
        session = await create_session(session_id="session-no-prompt")
        assert session["session_id"] == "session-no-prompt"
        assert session["prompt_id"] is None

    @pytest.mark.asyncio
    async def test_get_session(self) -> None:
        """get_session retrieves a session by session_id."""
        await create_session(session_id="session-get-1")
        session = await get_session("session-get-1")
        assert session is not None
        assert session["session_id"] == "session-get-1"
        assert session["status"] == "recording"

    @pytest.mark.asyncio
    async def test_get_session_not_found(self) -> None:
        """get_session returns None for non-existent session."""
        session = await get_session("session-nonexistent")
        assert session is None

    @pytest.mark.asyncio
    async def test_list_sessions(self) -> None:
        """list_sessions returns all sessions ordered by id desc."""
        await create_session(session_id="session-list-1")
        await create_session(session_id="session-list-2")
        await create_session(session_id="session-list-3")

        sessions = await list_sessions()
        assert len(sessions) == 3
        # Most recent first
        assert sessions[0]["session_id"] == "session-list-3"
        assert sessions[2]["session_id"] == "session-list-1"

    @pytest.mark.asyncio
    async def test_list_sessions_empty(self) -> None:
        """list_sessions returns empty list when no sessions exist."""
        sessions = await list_sessions()
        assert sessions == []

    @pytest.mark.asyncio
    async def test_list_sessions_pagination(self) -> None:
        """list_sessions supports limit/offset pagination."""
        for i in range(10):
            await create_session(session_id=f"session-pag-{i}")

        # Default limit
        all_sessions = await list_sessions()
        assert len(all_sessions) == 10

        # First page of 3
        first_page = await list_sessions(limit=3, offset=0)
        assert len(first_page) == 3
        assert first_page[0]["session_id"] == "session-pag-9"

        # Second page of 3
        second_page = await list_sessions(limit=3, offset=3)
        assert len(second_page) == 3
        assert second_page[0]["session_id"] == "session-pag-6"

        # Offset beyond results
        empty_page = await list_sessions(limit=3, offset=20)
        assert empty_page == []

    @pytest.mark.asyncio
    async def test_update_session_status(self) -> None:
        """update_session can change status."""
        await create_session(session_id="session-upd-1")
        updated = await update_session(
            "session-upd-1",
            status="completed",
            raw_text="hello world",
            polished_text="Hello world.",
            timing_ms=1500,
        )
        assert updated["status"] == "completed"
        assert updated["raw_text"] == "hello world"
        assert updated["polished_text"] == "Hello world."
        assert updated["timing_ms"] == 1500

    @pytest.mark.asyncio
    async def test_update_session_partial(self) -> None:
        """update_session with partial fields only changes specified fields."""
        await create_session(session_id="session-upd-2", prompt_id=5)
        updated = await update_session("session-upd-2", status="transcribing")
        assert updated["status"] == "transcribing"
        assert updated["prompt_id"] == 5  # unchanged
        assert updated["raw_text"] is None  # unchanged

    @pytest.mark.asyncio
    async def test_update_session_error_info(self) -> None:
        """update_session can store error_type and failed_audio_path."""
        await create_session(session_id="session-upd-err")
        updated = await update_session(
            "session-upd-err",
            status="failed",
            error_type="asr_timeout",
            failed_audio_path="/tmp/audio/test.wav",
        )
        assert updated["status"] == "failed"
        assert updated["error_type"] == "asr_timeout"
        assert updated["failed_audio_path"] == "/tmp/audio/test.wav"

    @pytest.mark.asyncio
    async def test_update_session_not_found(self) -> None:
        """update_session raises ValueError for non-existent session."""
        with pytest.raises(ValueError, match="not found"):
            await update_session("session-nonexistent", status="completed")

    @pytest.mark.asyncio
    async def test_get_failed_sessions(self) -> None:
        """get_failed_sessions returns only status='failed'."""
        await create_session(session_id="session-fail-ok-1")
        await create_session(session_id="session-fail-fail-1", prompt_id=1)
        await create_session(session_id="session-fail-ok-2")
        await create_session(session_id="session-fail-fail-2", prompt_id=2)

        await update_session("session-fail-fail-1", status="failed", error_type="asr_error")
        await update_session("session-fail-fail-2", status="failed", error_type="llm_error")
        await update_session("session-fail-ok-1", status="completed")
        await update_session("session-fail-ok-2", status="completed")

        failed = await get_failed_sessions()
        assert len(failed) == 2
        session_ids = {s["session_id"] for s in failed}
        assert session_ids == {"session-fail-fail-1", "session-fail-fail-2"}

        # Verify error info is preserved
        for session in failed:
            if session["session_id"] == "session-fail-fail-1":
                assert session["error_type"] == "asr_error"
            else:
                assert session["error_type"] == "llm_error"

    @pytest.mark.asyncio
    async def test_get_failed_sessions_empty(self) -> None:
        """get_failed_sessions returns empty list when no failed sessions."""
        await create_session(session_id="session-ok-1")
        await update_session("session-ok-1", status="completed")
        failed = await get_failed_sessions()
        assert failed == []

    @pytest.mark.asyncio
    async def test_mark_retry(self) -> None:
        """mark_retry links old failed session to new retry session."""
        await create_session(session_id="session-old-retry")
        await create_session(session_id="session-new-retry")

        # Mark old as failed first
        await update_session("session-old-retry", status="failed", error_type="asr_error")

        result = await mark_retry(
            session_id="session-old-retry",
            new_session_id="session-new-retry",
        )

        # Should return the updated old session
        assert result["session_id"] == "session-old-retry"
        assert "session-new-retry" in result["error_type"]

        # Verify persistence
        old_session = await get_session("session-old-retry")
        assert "session-new-retry" in old_session["error_type"]

    @pytest.mark.asyncio
    async def test_mark_retry_not_found(self) -> None:
        """mark_retry raises ValueError for non-existent session."""
        with pytest.raises(ValueError, match="not found"):
            await mark_retry(session_id="session-nonexistent", new_session_id="session-new")
