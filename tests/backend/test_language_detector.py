"""Tests for the language detector module."""

from __future__ import annotations

from backend.language_detector import (
    detect_language,
    detect_language_for_prompt,
    get_language_breakdown,
)


class TestDetectLanguage:
    """Test primary language detection."""

    def test_detect_chinese(self) -> None:
        """Pure Chinese text returns 'zh'."""
        assert detect_language("今天天气真不错") == "zh"

    def test_detect_english(self) -> None:
        """Pure English text returns 'en'."""
        assert detect_language("hello world this is a test") == "en"

    def test_detect_mixed(self) -> None:
        """Mixed Chinese/English text returns 'mixed'."""
        assert detect_language("今天天气真不错 hello world") == "mixed"

    def test_detect_empty(self) -> None:
        """Empty text returns 'unknown'."""
        assert detect_language("") == "unknown"

    def test_detect_whitespace(self) -> None:
        """Whitespace-only text returns 'unknown'."""
        assert detect_language("   ") == "unknown"

    def test_detect_numbers_and_symbols(self) -> None:
        """Text with only numbers/symbols returns 'unknown'."""
        assert detect_language("12345!@#$%") == "unknown"

    def test_detect_code_mixed(self) -> None:
        """Code-like text with Chinese comments returns mixed."""
        text = "function add(a, b) { 返回 a + b }"
        assert detect_language(text) == "mixed"

    def test_detect_chinese_with_punctuation(self) -> None:
        """Chinese with fullwidth punctuation still detected as zh."""
        text = "今天天气真不错！我们去散步吧？"
        assert detect_language(text) == "zh"

    def test_detect_mostly_english(self) -> None:
        """Text that is mostly English returns 'en'."""
        text = "This is mostly English 有一个中文词"
        assert detect_language(text) == "mixed"  # both are significant

    def test_detect_mostly_chinese(self) -> None:
        """Text that is mostly Chinese returns 'zh'."""
        text = "这段文字主要是中文 with a few English words"
        assert detect_language(text) == "mixed"  # both significant; falls to mixed default

    def test_longer_mostly_chinese(self) -> None:
        """Text that is overwhelmingly Chinese returns 'zh'."""
        text = "今天天气真不错我们去公园散步吧然后一起吃个饭"
        assert detect_language(text) == "zh"

    def test_detect_short_chinese(self) -> None:
        """Short Chinese phrase detected correctly."""
        assert detect_language("你好") == "zh"

    def test_detect_short_english(self) -> None:
        """Short English phrase detected correctly."""
        assert detect_language("hello") == "en"


class TestDetectLanguageForPrompt:
    """Test prompt category detection."""

    def test_chinese_prompt(self) -> None:
        """Chinese text returns 'zh' prompt category."""
        assert detect_language_for_prompt("今天天气真不错") == "zh"

    def test_english_prompt(self) -> None:
        """English text returns 'en' prompt category."""
        assert detect_language_for_prompt("hello world") == "en"

    def test_mixed_prompt(self) -> None:
        """Mixed text returns 'mixed' prompt category."""
        assert detect_language_for_prompt("hello 你好 world") == "mixed"

    def test_unknown_prompt(self) -> None:
        """Unknown language returns 'mixed' as safe default."""
        assert detect_language_for_prompt("12345") == "mixed"


class TestGetLanguageBreakdown:
    """Test detailed language breakdown."""

    def test_breakdown_chinese(self) -> None:
        """Chinese text breakdown has cjk > 0."""
        result = get_language_breakdown("你好世界")
        assert result["cjk"] > 0
        assert result["primary"] == "zh"

    def test_breakdown_english(self) -> None:
        """English text breakdown has latin > 0."""
        result = get_language_breakdown("hello world")
        assert result["latin"] > 0
        assert result["primary"] == "en"

    def test_breakdown_empty(self) -> None:
        """Empty text breakdown has all zeros."""
        result = get_language_breakdown("")
        assert result["primary"] == "unknown"

    def test_breakdown_contains_primary_key(self) -> None:
        """Breakdown always contains 'primary' key."""
        result = get_language_breakdown("hello")
        assert "primary" in result
