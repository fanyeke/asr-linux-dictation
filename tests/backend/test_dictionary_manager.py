"""Tests for dictionary manager."""

from pathlib import Path

import pytest

from backend.database import init_database
from backend.dictionary_manager import (
    _get_pinyin,
    _pinyin_sequence_match,
    count_matches_in_text,
    create_entry,
    delete_entry,
    find_relevant_entries,
    get_entry,
    list_entries,
    update_entry,
)


class TestDictionaryCRUD:
    """Test dictionary CRUD operations."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_create_entry(self) -> None:
        """Can create a new dictionary entry."""
        entry = await create_entry(
            canonical_term="ASR Linux",
            aliases="asr, speech recognition",
            notes="The project name",
            category="tech",
        )
        assert entry["id"] == 1
        assert entry["canonical_term"] == "ASR Linux"
        assert entry["pronunciation"] == "ASR Linux"
        assert entry["aliases"] == "asr, speech recognition"
        assert entry["notes"] == "The project name"
        assert entry["category"] == "tech"
        assert entry["enforcement_level"] == "suggested"

    @pytest.mark.asyncio
    async def test_create_entry_with_custom_pronunciation(self) -> None:
        """Can create an entry with explicit pronunciation."""
        entry = await create_entry(
            canonical_term="规则",
            pronunciation="gui ze",
        )
        assert entry["pronunciation"] == "gui ze"

    @pytest.mark.asyncio
    async def test_get_entry(self) -> None:
        """Can retrieve an entry by id."""
        created = await create_entry(canonical_term="Test")
        entry = await get_entry(created["id"])
        assert entry is not None
        assert entry["canonical_term"] == "Test"

    @pytest.mark.asyncio
    async def test_get_entry_not_found(self) -> None:
        """Returns None for non-existent entry."""
        entry = await get_entry(999)
        assert entry is None

    @pytest.mark.asyncio
    async def test_list_entries(self) -> None:
        """Can list all entries."""
        await create_entry(canonical_term="A")
        await create_entry(canonical_term="B")
        entries = await list_entries()
        assert len(entries) == 2

    @pytest.mark.asyncio
    async def test_list_entries_filtered_by_category(self) -> None:
        """Can filter entries by category."""
        await create_entry(canonical_term="A", category="tech")
        await create_entry(canonical_term="B", category="business")
        await create_entry(canonical_term="C", category="tech")
        tech_entries = await list_entries(category="tech")
        assert len(tech_entries) == 2
        for e in tech_entries:
            assert e["category"] == "tech"
        business_entries = await list_entries(category="business")
        assert len(business_entries) == 1
        assert business_entries[0]["canonical_term"] == "B"

    @pytest.mark.asyncio
    async def test_update_entry(self) -> None:
        """Can update an existing entry."""
        created = await create_entry(canonical_term="Old", aliases="old")
        updated = await update_entry(
            created["id"],
            canonical_term="New",
            aliases="new",
            notes="Updated notes",
        )
        assert updated["canonical_term"] == "New"
        assert updated["aliases"] == "new"
        assert updated["notes"] == "Updated notes"

    @pytest.mark.asyncio
    async def test_update_entry_auto_pronunciation(self) -> None:
        """Pronunciation is auto-regenerated when canonical_term changes."""
        created = await create_entry(canonical_term="规则")
        assert created["pronunciation"] == "gui ze"
        updated = await update_entry(created["id"], canonical_term="归则")
        assert updated["pronunciation"] == "gui ze"

    @pytest.mark.asyncio
    async def test_delete_entry(self) -> None:
        """Can delete an entry."""
        created = await create_entry(canonical_term="ToDelete")
        result = await delete_entry(created["id"])
        assert result is True
        entry = await get_entry(created["id"])
        assert entry is None

    @pytest.mark.asyncio
    async def test_delete_entry_not_found(self) -> None:
        """Returns False for non-existent entry."""
        result = await delete_entry(999)
        assert result is False


class TestDictionaryRelevance:
    """Test relevance selection for dictionary entries."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_find_relevant_by_canonical_term(self) -> None:
        """Matches entries where canonical_term appears in transcript."""
        await create_entry(canonical_term="ASR Linux")
        relevant = await find_relevant_entries("I use ASR Linux for dictation")
        assert len(relevant) == 1
        assert relevant[0]["canonical_term"] == "ASR Linux"

    @pytest.mark.asyncio
    async def test_find_relevant_by_alias(self) -> None:
        """Matches entries where alias appears in transcript."""
        await create_entry(canonical_term="ASR Linux", aliases="speech recognition")
        relevant = await find_relevant_entries("I love speech recognition")
        assert len(relevant) == 1
        assert relevant[0]["canonical_term"] == "ASR Linux"

    @pytest.mark.asyncio
    async def test_find_relevant_case_insensitive(self) -> None:
        """Matching is case-insensitive."""
        await create_entry(canonical_term="ASR Linux")
        relevant = await find_relevant_entries("asr linux is great")
        assert len(relevant) == 1
        assert relevant[0]["canonical_term"] == "ASR Linux"

    @pytest.mark.asyncio
    async def test_find_relevant_no_match(self) -> None:
        """Returns empty list when no entries match."""
        await create_entry(canonical_term="ASR Linux")
        relevant = await find_relevant_entries("nothing matches here")
        assert len(relevant) == 0

    @pytest.mark.asyncio
    async def test_find_relevant_multiple_matches(self) -> None:
        """Returns multiple entries when several match."""
        await create_entry(canonical_term="ASR", category="tech")
        await create_entry(canonical_term="Linux", category="tech")
        relevant = await find_relevant_entries("ASR Linux is awesome")
        assert len(relevant) == 2


class TestDictionaryPinyinMatching:
    """Test pronunciation-based fuzzy matching (音近匹配)."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_find_relevant_by_exact_pinyin(self) -> None:
        """Matches entries whose pronunciation exactly matches transcript pinyin."""
        await create_entry(canonical_term="规则", pronunciation="gui ze")
        # transcript contains "归则" which has same pinyin as "规则"
        relevant = await find_relevant_entries("我觉得归则很好")
        assert len(relevant) == 1
        assert relevant[0]["canonical_term"] == "规则"

    @pytest.mark.asyncio
    async def test_find_relevant_by_near_pinyin(self) -> None:
        """Matches entries with one syllable difference (音近)."""
        await create_entry(canonical_term="规则", pronunciation="gui ze")
        # "贵贼" -> gui zei (one syllable different from gui ze)
        relevant = await find_relevant_entries("我觉得贵贼很好")
        assert len(relevant) == 1
        assert relevant[0]["canonical_term"] == "规则"

    @pytest.mark.asyncio
    async def test_find_relevant_pinyin_no_false_match(self) -> None:
        """Does not match when pinyin is too different."""
        await create_entry(canonical_term="规则", pronunciation="gui ze")
        # "苹果" -> ping guo (completely different)
        relevant = await find_relevant_entries("我喜欢苹果")
        assert len(relevant) == 0

    @pytest.mark.asyncio
    async def test_find_relevant_by_alias_pinyin(self) -> None:
        """Matches entries where alias pronunciation is similar."""
        await create_entry(canonical_term="ASR", aliases="automatic speech")
        # "automatic speech" pinyin should match... but this is English,
        # so it falls back to text matching. Test Chinese alias instead.
        await create_entry(canonical_term="自然语言处理", aliases="nlp")
        relevant = await find_relevant_entries("nlp 是人工智能的分支")
        assert len(relevant) == 1
        assert relevant[0]["canonical_term"] == "自然语言处理"


class TestDictionaryEnforcement:
    """Test enforcement level behavior."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_default_enforcement_level(self) -> None:
        """Defaults to 'suggested'."""
        entry = await create_entry(canonical_term="Test")
        assert entry["enforcement_level"] == "suggested"

    @pytest.mark.asyncio
    async def test_forced_enforcement_level(self) -> None:
        """Accepts 'forced' enforcement level."""
        entry = await create_entry(canonical_term="Test", enforcement_level="forced")
        assert entry["enforcement_level"] == "forced"


class TestPinyinHelpers:
    """Test pinyin utility functions."""

    def test_get_pinyin_chinese(self) -> None:
        """Convert Chinese text to pinyin list."""
        result = _get_pinyin("规则")
        assert result == ["gui", "ze"]

    def test_get_pinyin_mixed(self) -> None:
        """Handle mixed Chinese and English."""
        result = _get_pinyin("ASR规则")
        assert result == ["ASR", "gui", "ze"]

    def test_get_pinyin_empty(self) -> None:
        """Return empty list for empty string."""
        assert _get_pinyin("") == []

    def test_pinyin_sequence_match_exact(self) -> None:
        """Exact pinyin sequence match."""
        assert _pinyin_sequence_match(["wo", "jue", "de", "gui", "ze"], ["gui", "ze"]) is True

    def test_pinyin_sequence_match_one_off(self) -> None:
        """Match with one syllable difference."""
        assert _pinyin_sequence_match(["wo", "gui", "zei"], ["gui", "ze"]) is True

    def test_pinyin_sequence_match_too_different(self) -> None:
        """No match when too different."""
        assert _pinyin_sequence_match(["ping", "guo"], ["gui", "ze"]) is False

    def test_pinyin_sequence_match_subsequence(self) -> None:
        """Match at any position in the transcript."""
        assert (
            _pinyin_sequence_match(["wo", "jue", "de", "gui", "ze", "hen", "hao"], ["gui", "ze"])
            is True
        )


class TestDictionaryStats:
    """Test dictionary match frequency tracking."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    def test_count_matches_basic(self) -> None:
        """Counts occurrences of dictionary terms in text."""
        entries = [
            {"id": 1, "canonical_term": "ASR"},
            {"id": 2, "canonical_term": "Linux"},
        ]
        result = count_matches_in_text(entries, "ASR Linux is great. I use ASR every day.")
        assert len(result) == 2
        asr_match = next(r for r in result if r["entry_id"] == 1)
        assert asr_match["count"] == 2
        linux_match = next(r for r in result if r["entry_id"] == 2)
        assert linux_match["count"] == 1

    def test_count_matches_empty_text(self) -> None:
        """Returns empty list for empty text."""
        entries = [{"id": 1, "canonical_term": "ASR"}]
        result = count_matches_in_text(entries, "")
        assert result == []

    def test_count_matches_no_match(self) -> None:
        """Returns empty list when no terms appear."""
        entries = [{"id": 1, "canonical_term": "ASR"}]
        result = count_matches_in_text(entries, "hello world")
        assert result == []

    def test_count_matches_case_insensitive(self) -> None:
        """Matching is case-insensitive."""
        entries = [{"id": 1, "canonical_term": "asr"}]
        result = count_matches_in_text(entries, "ASR is great. Asr works well.")
        assert len(result) == 1
        assert result[0]["count"] == 2

    @pytest.mark.asyncio
    async def test_record_and_retrieve_stats(self) -> None:
        """Stats can be recorded and retrieved via get_dictionary_stats_summary."""
        from backend.dictionary_manager import (
            get_dictionary_stats_summary,
            record_dictionary_stats,
        )

        # Create a dictionary entry first so the JOIN works
        entry = await create_entry(canonical_term="ASR")

        await record_dictionary_stats("session-1", [
            {"entry_id": entry["id"], "canonical_term": "ASR", "count": 2},
        ])
        await record_dictionary_stats("session-2", [
            {"entry_id": entry["id"], "canonical_term": "ASR", "count": 1},
        ])

        summary = await get_dictionary_stats_summary(limit_sessions=10)
        assert len(summary) >= 1
        asr_stats = next(s for s in summary if s["entry_id"] == entry["id"])
        assert asr_stats["total_matches"] == 3
        assert asr_stats["session_count"] == 2
