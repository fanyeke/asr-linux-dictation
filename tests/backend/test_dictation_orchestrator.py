"""Tests for dictation orchestrator."""

from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from backend.asr_client import ASRClient, ASRError
from backend.database import init_database
from backend.dictation_orchestrator import DictationOrchestrator
from backend.dictionary_manager import create_entry
from backend.polish_client import PolishClient


class TestDictationOrchestrator:
    """Test the dictation orchestration pipeline."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.fixture
    def mock_asr(self):
        """Create an ASRClient with a mocked transcribe method."""
        client = ASRClient(api_key="test")
        client.transcribe = AsyncMock(return_value="hello world")
        return client

    @pytest.fixture
    def mock_polish(self):
        """Create a PolishClient with a mocked polish method."""
        client = PolishClient(api_key="test")
        client.polish = AsyncMock(return_value="Hello world.")
        return client

    # ----------------------------------------------------------------
    # Success path
    # ----------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_success_path(self, mock_asr, mock_polish):
        """Full pipeline succeeds and returns a completed session."""
        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
        )
        result = await orchestrator.process(audio_bytes=b"fake-audio")

        assert result["status"] == "completed"
        assert result["raw_text"] == "hello world"
        assert result["polished_text"] == "Hello world."
        assert result["session_id"] is not None
        assert result["error_type"] is None

        # Verify persistence
        from backend.history_store import get_session

        session = await get_session(result["session_id"])
        assert session["status"] == "completed"
        assert session["raw_text"] == "hello world"
        assert session["polished_text"] == "Hello world."

    # ----------------------------------------------------------------
    # ASR failure
    # ----------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_asr_failure(self, mock_asr, mock_polish):
        """ASR failure marks the session as failed and returns the session."""
        mock_asr.transcribe = AsyncMock(
            side_effect=ASRError("ASR failed", error_category="timeout"),
        )

        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
        )

        result = await orchestrator.process(audio_bytes=b"fake-audio")

        assert result["status"] == "failed"
        assert result["error_type"] == "asr:timeout"

        from backend.history_store import list_sessions

        sessions = await list_sessions()
        assert len(sessions) == 1

        session = sessions[0]
        assert session["status"] == "failed"
        assert session["error_type"] == "asr:timeout"

    # ----------------------------------------------------------------
    # Polish fallback
    # ----------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_polish_api_failure_fallback(self, mock_asr, mock_polish):
        """Polish returning raw_text (fallback) still completes the session."""
        mock_polish.polish = AsyncMock(side_effect=lambda text, *a, **kw: text)

        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
        )
        result = await orchestrator.process(audio_bytes=b"fake-audio")

        assert result["status"] == "completed"
        # polished_text equals raw_text because polish returned the raw input
        assert result["polished_text"] == "hello world"
        assert result["raw_text"] == "hello world"

    @pytest.mark.asyncio
    async def test_polish_disabled_uses_raw_transcript(self, mock_asr, mock_polish):
        """When LLM polish is disabled, raw ASR text is injected directly."""
        injected: list[str] = []

        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
            injector=lambda text: injected.append(text),
            polish_enabled=False,
        )
        result = await orchestrator.process(audio_bytes=b"fake-audio")

        assert result["status"] == "completed"
        assert result["raw_text"] == "hello world"
        assert result["polished_text"] == "hello world"
        assert injected == ["hello world"]
        mock_polish.polish.assert_not_called()

    # ----------------------------------------------------------------
    # No active prompt → default template
    # ----------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_no_active_prompt_uses_default(self, mock_asr, mock_polish):
        """When no active prompt exists, the default template is used."""
        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
        )
        result = await orchestrator.process(audio_bytes=b"fake-audio")

        assert result["status"] == "completed"

        mock_polish.polish.assert_called_once_with(
            "hello world",
            "{text}",
            dictionary_entries=[],
            detected_language="en",
        )

    # ----------------------------------------------------------------
    # Dictionary entry mapping
    # ----------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_dictionary_entries_mapped(self, mock_asr, mock_polish):
        """Dictionary entries are fetched and mapped to {term, definition}."""
        # Arrange: seed dictionary entries
        await create_entry(
            canonical_term="ASR Linux",
            aliases="asr-linux",
            notes="A Linux voice input app",
            category="product",
        )
        await create_entry(
            canonical_term="Mimo",
            aliases=None,
            notes=None,
            category="product",
        )

        mock_asr.transcribe = AsyncMock(
            return_value="ASR Linux is built with Mimo",
        )

        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
        )
        result = await orchestrator.process(audio_bytes=b"fake-audio")

        assert result["status"] == "completed"

        # Verify polish received correctly mapped entries
        mock_polish.polish.assert_called_once()
        _args, kwargs = mock_polish.polish.call_args
        dict_entries = kwargs.get("dictionary_entries", [])

        assert len(dict_entries) == 2

        entry_map = {e["term"]: e["definition"] for e in dict_entries}
        assert entry_map["ASR Linux"] == "A Linux voice input app"
        assert entry_map["Mimo"] == ""  # notes=None → ""

    # ----------------------------------------------------------------
    # Injector failure
    # ----------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_injector_failure(self, mock_asr, mock_polish):
        """Injector failure marks session as failed and returns the session."""

        def failing_injector(text: str) -> None:
            raise ValueError("Injector failed")

        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
            injector=failing_injector,
        )

        result = await orchestrator.process(audio_bytes=b"fake-audio")

        assert result["status"] == "failed"
        assert result["error_type"] == "inject:ValueError"
        assert result["raw_text"] == "hello world"
        assert result["polished_text"] == "Hello world."

        from backend.history_store import list_sessions

        sessions = await list_sessions()
        assert len(sessions) == 1

        session = sessions[0]
        assert session["status"] == "failed"
        assert session["error_type"] == "inject:ValueError"
        # polished_text should still be set
        assert session["polished_text"] == "Hello world."

    # ----------------------------------------------------------------
    # Returned dict structure
    # ----------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_session_returned(self, mock_asr, mock_polish):
        """Returned dict contains expected fields."""
        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
        )
        result = await orchestrator.process(audio_bytes=b"fake-audio")

        assert "session_id" in result
        assert "raw_text" in result
        assert "polished_text" in result
        assert "status" in result
        assert result["status"] == "completed"

    # ----------------------------------------------------------------
    # get_status
    # ----------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_get_status(self, mock_asr, mock_polish):
        """get_status retrieves a session by session_id."""
        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
        )
        result = await orchestrator.process(audio_bytes=b"fake-audio")
        session_id = result["session_id"]

        status = await orchestrator.get_status(session_id)
        assert status is not None
        assert status["session_id"] == session_id
        assert status["status"] == "completed"

    @pytest.mark.asyncio
    async def test_get_status_not_found(self, mock_asr, mock_polish):
        """get_status returns None for a non-existent session."""
        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
        )
        status = await orchestrator.get_status("nonexistent-session")
        assert status is None

    # ----------------------------------------------------------------
    # ASR language parameter
    # ----------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_asr_language_passed_to_transcribe(self, mock_asr, mock_polish):
        """Orchestrator passes configured asr_language to the ASR client."""
        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
            asr_language="zh",
        )
        await orchestrator.process(audio_bytes=b"fake-audio")

        mock_asr.transcribe.assert_called_once()
        _args, kwargs = mock_asr.transcribe.call_args
        assert kwargs.get("language") == "zh"

    @pytest.mark.asyncio
    async def test_asr_language_defaults_to_auto(self, mock_asr, mock_polish):
        """Default asr_language is 'auto' when not specified."""
        orchestrator = DictationOrchestrator(
            asr_client=mock_asr,
            polish_client=mock_polish,
        )

        assert orchestrator.asr_language == "auto"
