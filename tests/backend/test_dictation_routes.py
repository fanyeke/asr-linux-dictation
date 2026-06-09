"""Tests for /dictation/start and /dictation/stop routes."""

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from backend.audio_recorder import AudioRecorder
from backend.dictation_orchestrator import DictationOrchestrator


class TestDictationRoutes:
    """Test dictation API endpoints."""

    @pytest.fixture(autouse=True)
    def _setup_mocks(
        self,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        """Set up mocks for AudioRecorder and DictationOrchestrator."""
        # Mock recorder
        self.mock_recorder = AsyncMock(spec=AudioRecorder)
        self.mock_recorder.start = AsyncMock(return_value="test-session-id")
        audio_file = tmp_path / "test.wav"
        audio_file.write_bytes(b"fake-audio-data")
        self.mock_recorder.stop = AsyncMock(return_value=audio_file)
        self.mock_recorder.is_recording = False
        self.mock_recorder.get_level = AsyncMock(return_value=0.5)
        monkeypatch.setattr("backend.main._recorder", self.mock_recorder)
        monkeypatch.setattr("backend.main._dictation_processing_lock", asyncio.Lock())

        # Mock orchestrator
        self.mock_orchestrator = AsyncMock(spec=DictationOrchestrator)
        self.mock_orchestrator.process = AsyncMock(
            return_value={
                "status": "completed",
                "session_id": "test-session-id",
                "raw_text": "hello world",
                "polished_text": "Hello world.",
                "error_type": None,
            }
        )
        # Override get_orchestrator so tests never recreate the real one
        monkeypatch.setattr(
            "backend.main.get_orchestrator",
            lambda: self.mock_orchestrator,
        )

        # Add warmup mocks to the orchestrator clients
        self.mock_orchestrator.asr_client = AsyncMock()
        self.mock_orchestrator.asr_client.warmup = AsyncMock()
        self.mock_orchestrator.polish_client = AsyncMock()
        self.mock_orchestrator.polish_client.warmup = AsyncMock()

    @pytest.mark.asyncio
    async def test_start_dictation(self, client: AsyncClient) -> None:
        """POST /dictation/start returns session_id and status."""
        response = await client.post("/dictation/start")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "started"
        assert data["session_id"] == "test-session-id"
        self.mock_recorder.start.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_start_dictation_calls_warmup(self, client: AsyncClient) -> None:
        """POST /dictation/start triggers ASR and LLM connection warmup."""
        response = await client.post("/dictation/start")
        assert response.status_code == 200
        # Yield to allow background asyncio.create_task to execute
        await asyncio.sleep(0)
        self.mock_orchestrator.asr_client.warmup.assert_awaited_once()
        self.mock_orchestrator.polish_client.warmup.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_stop_dictation(self, client: AsyncClient) -> None:
        """POST /dictation/stop processes audio and returns result."""
        response = await client.post("/dictation/stop")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["session_id"] == "test-session-id"
        assert data["raw_text"] == "hello world"
        assert data["polished_text"] == "Hello world."
        self.mock_recorder.stop.assert_awaited_once()
        self.mock_orchestrator.process.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_start_without_token_fails(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """POST /dictation/start returns 401 without a valid token."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "test-secret-123")
        response = await client.post("/dictation/start")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_stop_without_token_fails(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """POST /dictation/stop returns 401 without a valid token."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "test-secret-123")
        response = await client.post("/dictation/stop")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_double_start_is_idempotent(
        self,
        client: AsyncClient,
    ) -> None:
        """Second /dictation/start while recording returns existing session (idempotent)."""
        self.mock_recorder.start = AsyncMock(return_value="existing-session-id")
        response = await client.post("/dictation/start")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "started"
        assert data["session_id"] == "existing-session-id"

    @pytest.mark.asyncio
    async def test_stop_without_recording_returns_idle(
        self,
        client: AsyncClient,
    ) -> None:
        """POST /dictation/stop when not recording returns idle (idempotent)."""
        self.mock_recorder.stop = AsyncMock(return_value=None)
        response = await client.post("/dictation/stop")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "idle"

    @pytest.mark.asyncio
    async def test_start_during_stop_processing_returns_conflict(
        self,
        client: AsyncClient,
    ) -> None:
        """A new recording cannot start while the previous text injection is pending."""
        processing_started = asyncio.Event()
        release_processing = asyncio.Event()

        async def slow_process(_audio_bytes: bytes) -> dict:
            processing_started.set()
            await release_processing.wait()
            return {
                "status": "completed",
                "session_id": "test-session-id",
                "raw_text": "first",
                "polished_text": "First.",
                "error_type": None,
            }

        self.mock_orchestrator.process = AsyncMock(side_effect=slow_process)

        stop_task = asyncio.create_task(client.post("/dictation/stop"))
        await asyncio.wait_for(processing_started.wait(), timeout=1.0)

        start_response = await client.post("/dictation/start")

        assert start_response.status_code == 409
        assert "processing" in start_response.text.lower()

        release_processing.set()
        stop_response = await stop_task
        assert stop_response.status_code == 200

    @pytest.mark.asyncio
    async def test_dictation_level(self, client: AsyncClient) -> None:
        """GET /dictation/level returns current audio level."""
        self.mock_recorder.is_recording = True
        response = await client.get("/dictation/level")
        assert response.status_code == 200
        data = response.json()
        assert data["level"] == 0.5
        assert data["recording"] is True
        self.mock_recorder.get_level.assert_awaited_once()
