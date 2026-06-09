"""Tests for the polish_sanitizer module."""

from __future__ import annotations

from backend.polish_sanitizer import sanitize_polish_output


class TestSanitizePolishOutput:
    """Test suite for sanitize_polish_output()."""

    # ------------------------------------------------------------------
    # Text with greeting prefix -> removed
    # ------------------------------------------------------------------

    def test_removes_ni_hao_prefix(self) -> None:
        """Strips leading Chinese greeting '你好'."""
        result = sanitize_polish_output("你好这是一段润色后的文本。")
        assert result == "这是一段润色后的文本。"

    def test_removes_nin_hao_prefix(self) -> None:
        """Strips leading Chinese greeting '您好'."""
        result = sanitize_polish_output("您好这是润色结果。")
        assert result == "这是润色结果。"

    def test_removes_sure_prefix(self) -> None:
        """Strips leading English greeting 'Sure,'."""
        result = sanitize_polish_output("Sure, here is the polished text.")
        assert result == "here is the polished text."

    def test_removes_here_is_prefix(self) -> None:
        """Strips leading phrase 'Here is'."""
        result = sanitize_polish_output("Here is the corrected version.")
        assert result == "the corrected version."

    def test_removes_of_course_prefix(self) -> None:
        """Strips leading phrase 'Of course'."""
        result = sanitize_polish_output("Of course I can help with that.")
        assert result == "I can help with that."

    def test_removes_prefix_with_trailing_whitespace(self) -> None:
        """Handles greeting followed by varied whitespace."""
        result = sanitize_polish_output("你好   text after spaces")
        assert result == "text after spaces"

    # ------------------------------------------------------------------
    # Text with markdown fences -> removed
    # ------------------------------------------------------------------

    def test_removes_markdown_fence_backticks(self) -> None:
        """Strips triple-backtick code fences."""
        result = sanitize_polish_output("```\npolished text\n```")
        assert result == "polished text"

    def test_removes_markdown_fence_with_language(self) -> None:
        """Strips triple-backtick fences with a language specifier."""
        result = sanitize_polish_output("```text\nsome content\n```")
        assert result == "some content"

    def test_removes_markdown_fence_no_newline(self) -> None:
        """Strips fences even when content is on the same line."""
        result = sanitize_polish_output("```inline```")
        assert result == "inline"

    # ------------------------------------------------------------------
    # Text with trailing explanation -> removed
    # ------------------------------------------------------------------

    def test_removes_explanation_english(self) -> None:
        """Strips text after 'Explanation:' marker."""
        result = sanitize_polish_output("This is the polished text. Explanation: I corrected the grammar.")
        assert result == "This is the polished text."

    def test_removes_explanation_chinese(self) -> None:
        """Strips text after '解释：' marker."""
        result = sanitize_polish_output("这是润色后的文本。解释：修正了语法错误。")
        assert result == "这是润色后的文本。"

    def test_explanation_without_colon(self) -> None:
        """Handles 'Explanation' prefix variants."""
        result = sanitize_polish_output("Polished text. Explanation corrected grammar.")
        assert result == "Polished text. Explanation corrected grammar."  # unchanged

    # ------------------------------------------------------------------
    # Whitespace stripping
    # ------------------------------------------------------------------

    def test_strips_leading_trailing_whitespace(self) -> None:
        """Removes extra whitespace from both ends."""
        result = sanitize_polish_output("  \n  hello world  \n  ")
        assert result == "hello world"

    # ------------------------------------------------------------------
    # Clean text -> unchanged
    # ------------------------------------------------------------------

    def test_clean_text_unchanged(self) -> None:
        """Returns the same string when no sanitization is needed."""
        text = "这是一段正常的润色文本。"
        result = sanitize_polish_output(text)
        assert result is text  # same object if no change needed

    def test_clean_english_text_unchanged(self) -> None:
        """Returns the same English string when no sanitization is needed."""
        text = "This is a normal polished text."
        result = sanitize_polish_output(text)
        assert result is text

    # ------------------------------------------------------------------
    # Mixed issues -> all fixed
    # ------------------------------------------------------------------

    def test_mixed_greeting_fence_and_explanation(self) -> None:
        """Handles greeting + fences + explanation in one pass."""
        text = "你好```\n这是润色结果\n```解释：修正了语法"
        result = sanitize_polish_output(text)
        assert result == "这是润色结果"

    def test_mixed_sure_fence_and_explanation(self) -> None:
        """Handles English greeting + fences + explanation."""
        text = "Sure, ```\nhere is the fixed text\n``` Explanation: I fixed typos."
        result = sanitize_polish_output(text)
        assert result == "here is the fixed text"
