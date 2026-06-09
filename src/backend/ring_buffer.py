"""Ring buffer for PCM audio data used in streaming ASR.

Provides the :class:`RingBuffer` class which stores PCM audio data in memory
and supports reading slices with overlap for progressive ASR processing.
"""

from __future__ import annotations

import logging
import struct

logger = logging.getLogger(__name__)

_BYTES_PER_SAMPLE = 2  # 16-bit PCM
_WAV_CHANNELS = 1
_WAV_BITS_PER_SAMPLE = 16


def pcm_to_wav(pcm_data: bytes, sample_rate: int = 16000) -> bytes:
    """Wrap raw PCM data in a RIFF/WAV container.

    Args:
        pcm_data: Raw PCM audio bytes (16-bit signed little-endian, mono).
        sample_rate: Sample rate in Hz.

    Returns:
        Complete WAV file bytes with a 44-byte header followed by PCM data.
    """
    channels = _WAV_CHANNELS
    bits_per_sample = _WAV_BITS_PER_SAMPLE
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8
    data_size = len(pcm_data)

    header = bytearray()
    header.extend(b"RIFF")
    header.extend(struct.pack("<I", 36 + data_size))
    header.extend(b"WAVE")
    header.extend(b"fmt ")
    header.extend(struct.pack("<I", 16))  # chunk size
    header.extend(struct.pack("<H", 1))  # PCM format
    header.extend(struct.pack("<H", channels))
    header.extend(struct.pack("<I", sample_rate))
    header.extend(struct.pack("<I", byte_rate))
    header.extend(struct.pack("<H", block_align))
    header.extend(struct.pack("<H", bits_per_sample))
    header.extend(b"data")
    header.extend(struct.pack("<I", data_size))

    return bytes(header) + pcm_data


class RingBuffer:
    """In-memory buffer for PCM audio data with slice-based reading.

    Stores audio data written incrementally and supports reading slices
    of a specified duration with configurable overlap for streaming ASR
    use cases.

    Usage::

        buf = RingBuffer(sample_rate=16000)
        buf.write(pcm_data)          # add PCM bytes
        slice = buf.read_slice(3.0)  # read 3s from end (with 1s overlap)
    """

    def __init__(self, sample_rate: int = 16000) -> None:
        """Initialize the ring buffer.

        Args:
            sample_rate: Audio sample rate in Hz (default 16000).
        """
        self._sample_rate = sample_rate
        self._bytes_per_second = sample_rate * _BYTES_PER_SAMPLE
        self._chunks: list[bytes] = []
        self._total_bytes = 0
        self._last_read_end: int = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def write(self, data: bytes) -> None:
        """Append PCM data to the buffer.

        Args:
            data: Raw PCM bytes to append.
        """
        if data:
            self._chunks.append(data)
            self._total_bytes += len(data)

    def read_slice(
        self,
        duration_seconds: float = 3.0,
        overlap_seconds: float = 1.0,
    ) -> bytes | None:
        """Read a slice from the buffer, starting before *last_read_end*.

        The slice will be *duration_seconds* long and will start
        *overlap_seconds* before the most recent read position to
        ensure continuity between consecutive reads.

        On the first read (when *last_read_end* is 0) the slice starts
        at ``total_bytes - duration`` so it covers only the newest data.

        Args:
            duration_seconds: Length of the slice in seconds.
            overlap_seconds: How far back from current position to start
                (creates overlap with previous slice).

        Returns:
            PCM bytes for the slice, or ``None`` if there isn't enough
            data yet or no new data since last read.
        """
        needed_bytes = int(duration_seconds * self._bytes_per_second)
        overlap_bytes = int(overlap_seconds * self._bytes_per_second)

        # Not enough data yet
        if self._total_bytes < needed_bytes:
            return None

        # No new data since last read (excludes first read)
        if self._last_read_end > 0 and self._total_bytes <= self._last_read_end:
            return None

        # Calculate slice boundaries
        if self._last_read_end == 0:
            # First read: take the most recent duration_seconds of data
            slice_start = self._total_bytes - needed_bytes
        else:
            # Subsequent reads: overlap with previous read
            natural_start = self._total_bytes - needed_bytes
            overlap_start = self._last_read_end - overlap_bytes
            # Pick the later start (read less data, not more)
            slice_start = min(natural_start, overlap_start)

        # Clamp to valid range
        slice_start = max(0, slice_start)
        slice_end = self._total_bytes

        result = self._read_bytes(slice_start, slice_end)
        self._last_read_end = slice_end
        return result

    def clear(self) -> None:
        """Reset the buffer, discarding all data."""
        self._chunks.clear()
        self._total_bytes = 0
        self._last_read_end = 0

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def total_bytes(self) -> int:
        """Total bytes written to the buffer."""
        return self._total_bytes

    @property
    def duration_seconds(self) -> float:
        """Duration of audio currently in the buffer in seconds."""
        return self._total_bytes / self._bytes_per_second

    @property
    def last_read_end(self) -> int:
        """Byte position where the last read ended (0 if no reads)."""
        return self._last_read_end

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _read_bytes(self, start: int, end: int) -> bytes:
        """Read bytes from *start* to *end* from the chunk list.

        Args:
            start: Byte position to start reading from.
            end: Byte position to stop reading at (exclusive).

        Returns:
            The requested byte range as a single bytes object.
        """
        if start >= end:
            return b""

        # Walk chunks to find the byte range
        chunks_to_read: list[bytes] = []
        offset = 0
        end - start

        for chunk in self._chunks:
            chunk_end = offset + len(chunk)

            if chunk_end <= start:
                # Chunk is entirely before start
                offset = chunk_end
                continue

            if offset >= end:
                break

            # This chunk overlaps with the range
            chunk_start = max(0, start - offset)
            chunk_end_in_chunk = min(len(chunk), end - offset)
            chunks_to_read.append(chunk[chunk_start:chunk_end_in_chunk])

            offset = chunk_end

        return b"".join(chunks_to_read)
