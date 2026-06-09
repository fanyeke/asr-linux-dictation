"""Tests for TranscriptMerger — merge partial ASR results with overlap detection."""

from __future__ import annotations

from backend.transcript_merger import TranscriptMerger


class TestTranscriptMerger:
    """Test the TranscriptMerger class."""

    # ------------------------------------------------------------------
    # Basic merge
    # ------------------------------------------------------------------

    def test_merge_simple(self) -> None:
        """Simple non-overlapping texts are concatenated."""
        merger = TranscriptMerger()
        result = merger.merge(["hello ", "world"])
        assert result == "hello world"

    def test_merge_single_item(self) -> None:
        """Single item returns unchanged."""
        merger = TranscriptMerger()
        result = merger.merge(["hello world"])
        assert result == "hello world"

    def test_merge_empty_list(self) -> None:
        """Empty list returns empty string."""
        merger = TranscriptMerger()
        assert merger.merge([]) == ""

    # ------------------------------------------------------------------
    # Overlap detection
    # ------------------------------------------------------------------

    def test_merge_with_overlap(self) -> None:
        """Overlapping suffix/prefix is detected and merged."""
        merger = TranscriptMerger()
        result = merger.merge(
            [
                "今天天气真",
                "天气真不错",
            ]
        )
        assert result == "今天天气真不错"

    def test_merge_with_overlap_english(self) -> None:
        """English text with overlapping words."""
        merger = TranscriptMerger()
        result = merger.merge(
            [
                "hello world this is",
                "world this is a test",
            ]
        )
        assert result == "hello world this is a test"

    def test_merge_no_overlap(self) -> None:
        """Texts with no overlap are directly concatenated."""
        merger = TranscriptMerger()
        result = merger.merge(
            [
                "first sentence",
                "second sentence",
            ]
        )
        # With no overlap found, join with space
        assert result == "first sentence second sentence"

    def test_merge_full_overlap(self) -> None:
        """A later chunk that is entirely contained in the earlier one is skipped."""
        merger = TranscriptMerger()
        result = merger.merge(
            [
                "今天天气真不错",
                "天气真不错",
            ]
        )
        # "天气真不错" is a suffix of "今天天气真不错"
        assert result == "今天天气真不错"

    # ------------------------------------------------------------------
    # Chinese text overlap
    # ------------------------------------------------------------------

    def test_merge_chinese_partial(self) -> None:
        """Chinese character-level overlap detection."""
        merger = TranscriptMerger()
        result = merger.merge(
            [
                "我觉得这个方案挺好的",
                "这个方案挺好的我们可",
            ]
        )
        # "这个方案挺好的" is the overlap
        assert result == "我觉得这个方案挺好的我们可"

    def test_merge_chinese_no_overlap_space(self) -> None:
        """Chinese texts without overlap are joined without space (CJK adjacent)."""
        merger = TranscriptMerger()
        result = merger.merge(
            [
                "今天天气",
                "我们去散步",
            ]
        )
        assert result == "今天天气我们去散步"

    # ------------------------------------------------------------------
    # Partial transcription artifacts
    # ------------------------------------------------------------------

    def test_merge_multiple_chunks(self) -> None:
        """Multiple overlapping chunks are merged sequentially."""
        merger = TranscriptMerger()
        result = merger.merge(
            [
                "今天",
                "今天天气",
                "今天天气真",
                "今天天气真不错",
            ]
        )
        assert result == "今天天气真不错"

    def test_merge_with_punctuation_overlap(self) -> None:
        """Overlap detection works with punctuation."""
        merger = TranscriptMerger()
        result = merger.merge(
            [
                "Hello, world. This",
                "world. This is great!",
            ]
        )
        assert result == "Hello, world. This is great!"

    # ------------------------------------------------------------------
    # Edge cases
    # ------------------------------------------------------------------

    def test_empty_chunks(self) -> None:
        """Empty chunks are ignored during merge."""
        merger = TranscriptMerger()
        result = merger.merge(["", "hello", "", "world", ""])
        assert result == "hello world"

    def test_all_empty(self) -> None:
        """All-empty chunks return empty."""
        merger = TranscriptMerger()
        assert merger.merge(["", ""]) == ""

    def test_whitespace_only(self) -> None:
        """Whitespace-only chunks are ignored."""
        merger = TranscriptMerger()
        result = merger.merge(["  ", "hello", "   "])
        assert result == "hello"

    def test_identical_chunks(self) -> None:
        """Identical consecutive chunks don't duplicate."""
        merger = TranscriptMerger()
        result = merger.merge(["hello world", "hello world"])
        assert result == "hello world"

    def test_one_char_overlap_with_min_overlap_1(self) -> None:
        """Single-character overlap detected with min_overlap=1."""
        merger = TranscriptMerger(min_overlap_chars=1)
        result = merger.merge(["hello", "o world"])
        assert result == "hello world"

    # ------------------------------------------------------------------
    # Minimum overlap length
    # ------------------------------------------------------------------

    def test_min_overlap_length(self) -> None:
        """Overlap below minimum threshold is not considered overlap."""
        merger = TranscriptMerger(min_overlap_chars=3)
        # "ab" is only 2 chars, below threshold
        result = merger.merge(["ab", "bc"])
        # With no overlap detected, combined
        assert "ab" in result
        assert "bc" in result

    def test_custom_min_overlap(self) -> None:
        """Custom minimum overlap length."""
        merger = TranscriptMerger(min_overlap_chars=4)
        result = merger.merge(
            [
                "hello world this",
                "world this is a test",
            ]
        )
        # "world this" is 11 chars, will be found as overlap
        assert result == "hello world this is a test"

    # ------------------------------------------------------------------
    # Longest suffix matching
    # ------------------------------------------------------------------

    def test_longest_suffix_used(self) -> None:
        """When multiple overlap lengths are possible, longest wins."""
        merger = TranscriptMerger()
        result = merger.merge(
            [
                "ababc",
                "abcde",
            ]
        )
        assert result == "ababcde"

        # "abc" is the longest overlap (3 chars); also verify we don't
        # truncate to a shorter overlap
        result2 = merger.merge(
            [
                "abc123",
                "123xyz",
            ]
        )
        assert result2 == "abc123xyz"

    def test_overlap_suffix_longer_than_half(self) -> None:
        """When overlap is more than half the new text length."""
        merger = TranscriptMerger()
        result = merger.merge(
            [
                "这是一个比较长的句子用于测试重叠",
                "长的句子用于测试重叠检测功能",
            ]
        )
        # Should detect the overlap and merge cleanly
        assert "长的句子用于测试重叠" in result
        assert len(result) < len("这是一个比较长的句子用于测试重叠") + len("长的句子用于测试重叠检测功能")
