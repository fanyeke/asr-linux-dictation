"""Tests for RingBuffer — PCM audio ring buffer for streaming ASR."""

from __future__ import annotations

from backend.ring_buffer import RingBuffer, pcm_to_wav


class TestRingBuffer:
    """Test the RingBuffer class."""

    # ------------------------------------------------------------------
    # Basic write/read
    # ------------------------------------------------------------------

    def test_write_and_total_bytes(self) -> None:
        """Writing PCM data updates total_bytes."""
        buf = RingBuffer(sample_rate=16000)
        buf.write(b"\x00\x01" * 100)  # 200 bytes = 100 samples
        assert buf.total_bytes == 200

    def test_write_multiple_chunks(self) -> None:
        """Multiple writes accumulate correctly."""
        buf = RingBuffer(sample_rate=16000)
        buf.write(b"\x00\x00" * 50)
        buf.write(b"\xff\xff" * 50)
        assert buf.total_bytes == 200

    def test_duration_seconds(self) -> None:
        """duration_seconds reflects total written bytes."""
        buf = RingBuffer(sample_rate=16000)
        # 16000 samples/s * 2 bytes/sample = 32000 bytes/s
        buf.write(b"\x00\x00" * 16000)  # 1 second at 16kHz 16-bit
        assert buf.duration_seconds == 1.0

    # ------------------------------------------------------------------
    # read_slice
    # ------------------------------------------------------------------

    def test_read_slice_simple(self) -> None:
        """read_slice returns the requested number of seconds from the end."""
        buf = RingBuffer(sample_rate=16000)
        # Write 5 seconds of data
        data = b"\x00\x01" * (16000 * 5)  # 5 seconds
        buf.write(data)

        # Read 3-second slice from end with 1-second overlap
        slice_data = buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        assert slice_data is not None
        # Should be 3 seconds: 16000 samples/s * 2 bytes/sample * 3s = 96000 bytes
        assert len(slice_data) == 96000

    def test_read_slice_overlap(self) -> None:
        """read_slice uses overlap to start before the end."""
        buf = RingBuffer(sample_rate=16000)
        # Write 10 seconds of data
        data = b"\x00\x01" * (16000 * 10)  # 10 seconds
        buf.write(data)

        # First read: 3s from end (no prior read, so no overlap applied)
        slice1 = buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        assert slice1 is not None
        assert len(slice1) == 96000  # 3 seconds

        # Write 3 more seconds (simulating continued recording)
        buf.write(b"\x00\x01" * (16000 * 3))

        # Second read: with overlap, should start (last_read_end - 1s) = 10s - 1s = 9s
        # But total is now 13s, so natural_start = 13 - 3 = 10s
        # overlap_start = 10 - 1 = 9s, so slice_start = min(10, 9) = 9s
        # slice = 9s to 13s = 4s → but we cap at 3s of NEW data...
        slice2 = buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        assert slice2 is not None
        # reads from 9s to 13s (4s) - the read returns whatever is in that range
        assert len(slice2) >= 96000 - 32000  # at least 2s of new data

    def test_read_slice_returns_none_when_not_enough_data(self) -> None:
        """read_slice returns None if buffer has less than requested duration."""
        buf = RingBuffer(sample_rate=16000)
        buf.write(b"\x00\x01" * 8000)  # 0.5 seconds
        slice_data = buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        assert slice_data is None

    def test_read_slice_no_double_count(self) -> None:
        """Consecutive reads with new data in between advance correctly."""
        buf = RingBuffer(sample_rate=16000)
        # Write 5 seconds initially
        buf.write(b"\xaa\xbb" * (16000 * 5))

        # Read 3s from end
        slice1 = buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        assert slice1 is not None
        pos1 = buf.last_read_end
        assert pos1 == buf.total_bytes  # read to end

        # Write 2 more seconds (simulating continued recording)
        buf.write(b"\xaa\xbb" * (16000 * 2))

        # Second read: with overlap back from last_read_end
        slice2 = buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        assert slice2 is not None
        pos2 = buf.last_read_end

        # Position advanced
        assert pos2 > pos1

    def test_read_slice_respects_processed_position(self) -> None:
        """After a read, last_read_end is updated to where we read up to."""
        buf = RingBuffer(sample_rate=16000)
        buf.write(b"\x00\x00" * (16000 * 5))  # 5 seconds
        assert buf.last_read_end == 0

        slice_data = buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        assert slice_data is not None

        # last_read_end should be the end byte position of this read
        # With overlap, we read from (total - 3s) and overlap is within that
        # First read: start = total - duration, end = total
        assert buf.last_read_end == buf.total_bytes

    # ------------------------------------------------------------------
    # Edge cases
    # ------------------------------------------------------------------

    def test_read_from_empty_buffer(self) -> None:
        """Reading from an empty buffer returns None."""
        buf = RingBuffer(sample_rate=16000)
        assert buf.read_slice(duration_seconds=3.0) is None

    def test_clear(self) -> None:
        """clear resets the buffer."""
        buf = RingBuffer(sample_rate=16000)
        buf.write(b"\x00\x00" * 100)
        assert buf.total_bytes > 0
        buf.clear()
        assert buf.total_bytes == 0
        assert buf.last_read_end == 0
        assert buf.read_slice(duration_seconds=1.0) is None

    def test_read_slice_exact_available(self) -> None:
        """read_slice reads all data when duration equals available."""
        buf = RingBuffer(sample_rate=16000)
        buf.write(b"\x00\x01" * (16000 * 3))  # exactly 3s
        slice_data = buf.read_slice(duration_seconds=3.0, overlap_seconds=0)
        assert slice_data is not None
        assert len(slice_data) == 96000

    def test_overlap_greater_than_slice_length(self) -> None:
        """Overlap > duration uses all available as overlap (reads from 0)."""
        buf = RingBuffer(sample_rate=16000)
        buf.write(b"\x00\x01" * (16000 * 10))
        slice_data = buf.read_slice(duration_seconds=3.0, overlap_seconds=5.0)
        assert slice_data is not None
        # Overlap clamped to slice length - 0.5s minimum
        assert len(slice_data) <= 96000
        assert len(slice_data) > 0

    def test_track_processed_position(self) -> None:
        """last_read_end tracks the end of each read."""
        buf = RingBuffer(sample_rate=16000)
        buf.write(b"\xaa\xbb" * (16000 * 8))  # 8 seconds

        s1 = buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        assert s1 is not None
        assert buf.last_read_end == buf.total_bytes

        # Add more data
        buf.write(b"\xcc\xdd" * (16000 * 2))  # 2 more seconds = 10 total

        s2 = buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        assert s2 is not None
        # Should read from (total - 3s) = 7s, with overlap back to 8s - 1s = 7s
        # But last_read_end was at 8s, so we read from 8s - 1s overlap = 7s to 10s
        assert buf.last_read_end == buf.total_bytes

    def test_no_data_since_last_read(self) -> None:
        """When no new data since last read, returns None."""
        buf = RingBuffer(sample_rate=16000)
        buf.write(b"\x00\x00" * (16000 * 5))
        buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        # Nothing new written
        result = buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        assert result is None

    def test_small_new_data_after_read(self) -> None:
        """Small amount of new data after read is still returned as a slice."""
        buf = RingBuffer(sample_rate=16000)
        buf.write(b"\x00\x00" * (16000 * 5))
        buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        # Add 0.5 seconds
        buf.write(b"\x00\x00" * (16000 // 2))
        result = buf.read_slice(duration_seconds=3.0, overlap_seconds=1.0)
        assert result is not None
        assert len(result) > 0


# ---------------------------------------------------------------------------
# pcm_to_wav
# ---------------------------------------------------------------------------


class TestPcmToWav:
    """Tests for the pcm_to_wav helper function."""

    def test_pcm_to_wav_has_riff_header(self) -> None:
        """WAV output starts with RIFF header."""
        pcm = b"\x00\x00" * 16000  # 1 second of silence
        wav = pcm_to_wav(pcm)
        assert wav[:4] == b"RIFF"
        assert wav[8:12] == b"WAVE"

    def test_pcm_to_wav_correct_size(self) -> None:
        """WAV file size includes 44-byte header + PCM data."""
        pcm = b"\x00\x01" * 8000  # 0.5 seconds
        wav = pcm_to_wav(pcm)
        assert len(wav) == 44 + len(pcm)

    def test_pcm_to_wav_format_chunk(self) -> None:
        """WAV fmt chunk has PCM format, 1 channel, 16-bit."""
        pcm = b"\x00\x00" * 16000
        wav = pcm_to_wav(pcm)
        # fmt chunk: 16 bytes starting at offset 12 (after "fmt ")
        fmt_chunk = wav[20:36]
        import struct

        audio_format, channels, sample_rate, _, _, bits = struct.unpack("<HHIIHH", fmt_chunk)
        assert audio_format == 1  # PCM
        assert channels == 1
        assert sample_rate == 16000
        assert bits == 16

    def test_pcm_to_wav_data_chunk(self) -> None:
        """WAV data chunk contains the original PCM bytes."""
        pcm = b"\xab\xcd" * 1000
        wav = pcm_to_wav(pcm)
        data_size = len(wav) - 44
        assert data_size == len(pcm)
        # PCM data starts at offset 44
        assert wav[44:] == pcm

    def test_pcm_to_wav_empty_pcm(self) -> None:
        """Empty PCM data produces a WAV with just the header."""
        wav = pcm_to_wav(b"")
        assert len(wav) == 44
        assert wav[:4] == b"RIFF"

    def test_pcm_to_wav_custom_sample_rate(self) -> None:
        """Custom sample rate appears in the WAV header."""
        pcm = b"\x00\x00" * 32000  # 1 second at 32000 Hz
        wav = pcm_to_wav(pcm, sample_rate=32000)
        import struct

        fmt_chunk = wav[20:36]
        _, _, sample_rate, _, _, _ = struct.unpack("<HHIIHH", fmt_chunk)
        assert sample_rate == 32000
