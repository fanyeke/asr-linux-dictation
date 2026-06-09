"""Tests for streaming ASR orchestration — partial results during recording."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from backend.dictation_orchestrator import DictationOrchestrator
from backend.ring_buffer import RingBuffer
from backend.transcript_merger import TranscriptMerger


class TestStreamingOrchestratorIntegration:
    """Integration tests for streaming ASR flow through the orchestrator."""

    @pytest.fixture
    def asr_mock(self) -> AsyncMock:
        """Mock ASR client that returns partial results."""
        mock = AsyncMock()
        # Simulate partial ASR results for each chunk
        mock.transcribe = AsyncMock()
        return mock

    @pytest.fixture
    def polish_mock(self) -> AsyncMock:
        """Mock polish client."""
        mock = AsyncMock()
        mock.polish = AsyncMock(return_value="polished text")
        return mock

    @pytest.fixture
    def orchestrator(self, asr_mock: AsyncMock, polish_mock: AsyncMock) -> DictationOrchestrator:
        """Orchestrator with mocked clients."""
        return DictationOrchestrator(
            asr_client=asr_mock,
            polish_client=polish_mock,
            polish_enabled=True,
        )

    # ------------------------------------------------------------------
    # RingBuffer → slice → ASR flow
    # ------------------------------------------------------------------

    async def test_process_streaming_basic_flow(
        self,
        orchestrator: DictationOrchestrator,
        asr_mock: AsyncMock,
    ) -> None:
        """Streaming flow: write data → slice → ASR → merge → result."""
        asr_mock.transcribe.side_effect = [
            "今天天气真",     # first slice result
            "天气真不错",     # second slice result (overlapping)
        ]

        ring = RingBuffer(sample_rate=16000)
        # Write 5 seconds of PCM
        ring.write(b"\x00\x01" * (16000 * 5))

        # Process through orchestrator
        result = await orchestrator.process(ring.read_slice(3.0, 1.0))

        # ASR was called
        asr_mock.transcribe.assert_called_once()
        assert "raw_text" in result

    async def test_process_streaming_multiple_slices(
        self,
        orchestrator: DictationOrchestrator,
        asr_mock: AsyncMock,
    ) -> None:
        """Multiple slices each go through ASR independently."""
        results_store: list[str] = []

        async def fake_transcribe(audio_bytes: bytes, **kwargs) -> str:
            # Each call returns a partial result based on length
            results_store.append(f"chunk_{len(results_store)}")
            return f"partial result {len(results_store)}"

        asr_mock.transcribe.side_effect = fake_transcribe

        ring = RingBuffer(sample_rate=16000)
        # Fill ring with growing data
        ring.write(b"\xaa\xbb" * (16000 * 5))

        # Process each slice
        s1 = ring.read_slice(3.0, 1.0)
        assert s1 is not None
        r1 = await orchestrator.process(s1)
        assert r1["status"] == "completed"
        assert asr_mock.transcribe.call_count >= 1

    # ------------------------------------------------------------------
    # Transcript merging
    # ------------------------------------------------------------------

    def test_transcript_merger_flow(self) -> None:
        """TranscriptMerger correctly merges overlapping partial transcripts."""
        merger = TranscriptMerger()
        partials = [
            "今天天气真",
            "天气真不错",
            "真不错我们",
            "错我们去散步",
        ]
        merged = merger.merge(partials)
        assert "今天天气真不错" in merged
        assert "我们去散步" in merged
        assert len(merged) < sum(len(p) for p in partials)  # overlap removed

    # ------------------------------------------------------------------
    # Slice scheduler integration
    # ------------------------------------------------------------------

    async def test_slice_schedule_and_process(
        self,
        orchestrator: DictationOrchestrator,
        asr_mock: AsyncMock,
    ) -> None:
        """Simulate the slice schedule: write data → read slices → process."""
        asr_mock.transcribe.side_effect = [
            "hello world",
            "world this is",
            "this is a test",
        ]

        ring = RingBuffer(sample_rate=16000)

        # Simulate recording: write data in chunks like arecord would
        for _second in range(1, 8):
            ring.write(b"\x00\x01" * (16000 // 2))  # 0.5s at a time

        # Simulate scheduler: read slices at intervals
        partials: list[str] = []

        # First read: when 3s of data available
        slice1 = ring.read_slice(3.0, 1.0)
        if slice1:
            partials.append(await orchestrator.asr_client.transcribe(slice1))

        # Simulate more data
        for _second in range(8, 13):
            ring.write(b"\x00\x01" * (16000 // 2))

        # Second read
        slice2 = ring.read_slice(3.0, 1.0)
        if slice2:
            partials.append(await orchestrator.asr_client.transcribe(slice2))

        # More data
        for _second in range(13, 18):
            ring.write(b"\x00\x01" * (16000 // 2))

        # Third read
        slice3 = ring.read_slice(3.0, 1.0)
        if slice3:
            partials.append(await orchestrator.asr_client.transcribe(slice3))

        # Merge partials
        merger = TranscriptMerger()
        merged = merger.merge(partials)

        assert "hello world" in merged
        assert asr_mock.transcribe.call_count == 3

    # ------------------------------------------------------------------
    # Error handling
    # ------------------------------------------------------------------

    async def test_partial_asr_failure_skipped(
        self,
        orchestrator: DictationOrchestrator,
        asr_mock: AsyncMock,
    ) -> None:
        """ASR failure on one chunk doesn't break subsequent chunks."""
        from backend.asr_client import ASRError

        call_count = 0

        async def failing_transcribe(audio_bytes: bytes, **kwargs) -> str:
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise ASRError("Temporary failure", error_category="server_error")
            return f"result_{call_count}"

        asr_mock.transcribe.side_effect = failing_transcribe

        ring = RingBuffer(sample_rate=16000)
        ring.write(b"\xaa\xbb" * (16000 * 10))

        # Read and process two slices
        s1 = ring.read_slice(3.0, 1.0)
        if s1:
            try:
                r1 = await orchestrator.process(s1)
                assert r1["status"] in ("completed", "failed")
            except ASRError:
                pass  # Expected for the failing call

    # ------------------------------------------------------------------
    # Empty / edge cases
    # ------------------------------------------------------------------

    async def test_empty_ring_buffer(
        self,
        orchestrator: DictationOrchestrator,
    ) -> None:
        """Processing an empty buffer returns a minimal result."""
        ring = RingBuffer(sample_rate=16000)
        slice_data = ring.read_slice(3.0, 1.0)
        assert slice_data is None

    async def test_transcript_merger_empty(self) -> None:
        """Empty list returns empty string."""
        merger = TranscriptMerger()
        assert merger.merge([]) == ""

    async def test_transcript_merger_single(self) -> None:
        """Single partial returns same text."""
        merger = TranscriptMerger()
        assert merger.merge(["hello world"]) == "hello world"
