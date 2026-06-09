"""Merge partial ASR transcripts with overlap detection.

Provides the :class:`TranscriptMerger` class which takes a list of partial
transcripts (from overlapping audio slices) and merges them into a single
coherent transcript by detecting and removing overlapping text.
"""

from __future__ import annotations


class TranscriptMerger:
    """Merge overlapping partial ASR transcripts.

    Uses longest-suffix matching to detect where consecutive chunks
    overlap, then merges them by keeping only the new suffix from each
    subsequent chunk.

    Usage::

        merger = TranscriptMerger()
        merged = merger.merge([
            "今天天气真",
            "天气真不错",
        ])
        # Result: "今天天气真不错"
    """

    def __init__(self, min_overlap_chars: int = 2) -> None:
        """Initialize the merger.

        Args:
            min_overlap_chars: Minimum number of characters that must
                match to consider it an overlap. Lower values detect
                shorter overlaps but may cause false positives.
        """
        self._min_overlap = min_overlap_chars

    def merge(self, chunks: list[str]) -> str:
        """Merge a list of partial transcript chunks.

        Processes chunks sequentially, detecting overlap between each
        consecutive pair using longest-suffix matching. Returns the
        merged full transcript.

        Args:
            chunks: List of partial transcript strings, in order.

        Returns:
            The merged transcript with overlap removed.
        """
        if not chunks:
            return ""

        # Filter out empty/whitespace-only chunks
        valid = [c for c in chunks if c and c.strip()]
        if not valid:
            return ""

        result = valid[0]
        for chunk in valid[1:]:
            result = self._merge_pair(result, chunk)

        return result

    def _merge_pair(self, prev: str, next_: str) -> str:
        """Merge two consecutive transcript chunks.

        Detects the longest suffix of *prev* that matches a prefix of
        *next_* and returns the combined text with overlap removed.

        Args:
            prev: The earlier transcript chunk.
            next_: The later transcript chunk.

        Returns:
            Merged text with overlap removed.
        """
        # Quick check: if next_ is entirely contained in prev, skip it
        if next_ in prev:
            return prev

        max_overlap = min(len(prev), len(next_))
        best_overlap = 0

        # Try to find the longest suffix of prev that is a prefix of next_
        for i in range(self._min_overlap, max_overlap + 1):
            suffix = prev[-i:]
            if next_.startswith(suffix):
                best_overlap = i

        if best_overlap >= self._min_overlap:
            return prev + next_[best_overlap:]

        # No sufficient overlap found — add a space between chunks when
        # neither ends/begins with whitespace. Skip for CJK adjacency to
        # avoid corrupting Chinese text.
        if prev and next_ and prev[-1] != " " and next_[0] != " ":
            if _is_cjk(prev[-1]) and _is_cjk(next_[0]):
                return prev + next_
            return prev + " " + next_
        return prev + next_


def _is_cjk(ch: str) -> bool:
    """Check if a character is in a CJK Unicode range."""
    cp = ord(ch)
    return (
        (0x4E00 <= cp <= 0x9FFF)  # CJK Unified Ideographs
        or (0x3400 <= cp <= 0x4DBF)  # CJK Extension A
        or (0x2E80 <= cp <= 0x2EFF)  # CJK Radicals
        or (0x3000 <= cp <= 0x303F)  # CJK Symbols and Punctuation
        or (0xFF00 <= cp <= 0xFFEF)  # Fullwidth Forms
    )
