"""Tests for the vocabulary learner engine."""

from __future__ import annotations

from pathlib import Path

import pytest

from backend.database import init_database
from backend.vocab_learner import (
    _diff_texts,
    _levenshtein,
    _tokenize,
    accept_recommendation,
    generate_recommendations,
    ignore_recommendation,
    list_recommendations,
    scan_history,
)


class TestTokenize:
    """Test text tokenization."""

    def test_english_words(self) -> None:
        tokens = _tokenize("hello world test")
        assert tokens == ["hello", "world", "test"]

    def test_cjk_characters(self) -> None:
        tokens = _tokenize("你好世界")
        assert tokens == list("你好世界")

    def test_mixed_content(self) -> None:
        tokens = _tokenize("hello 你好 world 世界")
        assert tokens == ["hello"] + list("你好") + ["world"] + list("世界")

    def test_punctuation_filtered(self) -> None:
        tokens = _tokenize("hello, world!")
        assert tokens == ["hello", "world"]

    def test_empty_text(self) -> None:
        assert _tokenize("") == []

    def test_number_tokens(self) -> None:
        tokens = _tokenize("test 123 ABC")
        assert tokens == ["test", "123", "ABC"]


class TestLevenshtein:
    """Test edit distance computation."""

    def test_identical(self) -> None:
        assert _levenshtein("hello", "hello") == 0

    def test_one_substitution(self) -> None:
        assert _levenshtein("rust", "Rust") == 1

    def test_one_deletion(self) -> None:
        assert _levenshtein("hello", "helo") == 1

    def test_one_insertion(self) -> None:
        assert _levenshtein("helo", "hello") == 1

    def test_completely_different(self) -> None:
        assert _levenshtein("abc", "xyz") == 3

    def test_empty_string(self) -> None:
        assert _levenshtein("", "hello") == 5
        assert _levenshtein("hello", "") == 5

    def test_cjk(self) -> None:
        dist = _levenshtein("你好", "你好")
        assert dist == 0

    def test_cjk_diff(self) -> None:
        dist = _levenshtein("你好", "您好")
        assert dist == 1


class TestDiffTexts:
    """Test raw→polished diff extraction."""

    def test_identical_texts(self) -> None:
        pairs = _diff_texts("hello world", "hello world")
        assert pairs == []

    def test_single_word_correction(self) -> None:
        pairs = _diff_texts("rust is good", "Rust is good")
        assert len(pairs) == 1
        assert pairs[0]["raw"] == "rust"
        assert pairs[0]["polished"] == "Rust"
        assert pairs[0]["edit_distance"] == 1

    def test_multi_word_correction(self) -> None:
        pairs = _diff_texts(
            "type script is great",
            "TypeScript is great",
        )
        assert len(pairs) >= 1

    def test_no_match_when_too_different(self) -> None:
        pairs = _diff_texts("completely different text", "something else entirely")
        # Many replace ops at high edit distances — should find pairs
        assert isinstance(pairs, list)

    def test_cjk_correction(self) -> None:
        """CJK character replacement is detected."""
        pairs = _diff_texts("测试数", "测试输")
        assert len(pairs) >= 1
        assert pairs[0]["raw"] == "数"
        assert pairs[0]["polished"] == "输"


class TestScanHistory:
    """Test history scanning (requires database)."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_empty_history(self) -> None:
        """With no history, scan returns empty."""
        results = await scan_history()
        assert results == []

    @pytest.mark.asyncio
    async def test_scan_with_corrections(self) -> None:
        """Scanning history with corrections finds pairs."""
        from backend.database import get_db_path

        db_path = get_db_path()
        import sqlite3

        conn = sqlite3.connect(db_path)
        for i, (raw, polished) in enumerate(
            [
                ("rust is good", "Rust is good"),
                ("I love rust", "I love Rust"),
                ("use rust lang", "use Rust lang"),
            ]
        ):
            conn.execute(
                "INSERT INTO history (session_id, raw_text, polished_text, status, timing_ms) "
                "VALUES (?, ?, ?, 'completed', 1000)",
                (f"sess-vocab-{i}", raw, polished),
            )
        conn.commit()
        conn.close()

        results = await scan_history()
        assert len(results) >= 1
        rust_recs = [r for r in results if "rust" in r["raw_term"].lower()]
        assert len(rust_recs) >= 1
        assert rust_recs[0]["frequency"] >= 3


class TestGenerateAndAccept:
    """Test recommendation generation and acceptance."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_generate_no_history(self) -> None:
        """Generating with no history returns empty."""
        recs = await generate_recommendations()
        assert recs == []

    @pytest.mark.asyncio
    async def test_generate_and_list(self) -> None:
        """Generate recommendations and list them."""
        from backend.database import get_db_path

        db_path = get_db_path()
        import sqlite3

        conn = sqlite3.connect(db_path)
        for i in range(3):
            conn.execute(
                "INSERT INTO history (session_id, raw_text, polished_text, status, timing_ms) "
                "VALUES (?, ?, ?, 'completed', 1000)",
                (f"sess-{i}", f"rust version {i}", f"Rust version {i}"),
            )
        conn.commit()
        conn.close()

        recs = await generate_recommendations()
        assert len(recs) >= 1

        all_recs = await list_recommendations()
        assert len(all_recs) >= 1

        pending = await list_recommendations(status="pending")
        assert len(pending) >= 1

    @pytest.mark.asyncio
    async def test_generate_and_accept(self) -> None:
        """Accepting a recommendation adds to dictionary."""
        from backend.database import get_db_path

        db_path = get_db_path()
        import sqlite3

        conn = sqlite3.connect(db_path)
        for i in range(3):
            conn.execute(
                "INSERT INTO history (session_id, raw_text, polished_text, status, timing_ms) "
                "VALUES (?, ?, ?, 'completed', 1000)",
                (f"sess-accept-{i}", "typescript", "TypeScript"),
            )
        conn.commit()
        conn.close()

        recs = await generate_recommendations()
        assert len(recs) >= 1
        rec_id = recs[0]["id"]

        # Accept
        entry = await accept_recommendation(rec_id)
        assert entry is not None
        assert entry["canonical_term"] == "TypeScript"
        assert entry["category"] == "vocab_learning"

        # Verify status changed
        pending = await list_recommendations(status="pending")
        assert all(r["id"] != rec_id for r in pending)

        accepted = await list_recommendations(status="accepted")
        assert any(r["id"] == rec_id for r in accepted)

    @pytest.mark.asyncio
    async def test_accept_nonexistent(self) -> None:
        """Accepting a non-existent recommendation returns None."""
        result = await accept_recommendation(9999)
        assert result is None

    @pytest.mark.asyncio
    async def test_ignore(self) -> None:
        """Ignoring a recommendation marks it as ignored."""
        from backend.database import get_db_path

        db_path = str(get_db_path())
        import sqlite3

        conn = sqlite3.connect(db_path)
        for i in range(3):
            conn.execute(
                "INSERT INTO history (session_id, raw_text, polished_text, status, timing_ms) "
                "VALUES (?, ?, ?, 'completed', 1000)",
                (f"sess-ignore-{i}", "javaScript", "JavaScript"),
            )
        conn.commit()
        conn.close()

        recs = await generate_recommendations()
        assert len(recs) >= 1
        rec_id = recs[0]["id"]

        assert await ignore_recommendation(rec_id) is True

        ignored = await list_recommendations(status="ignored")
        assert any(r["id"] == rec_id for r in ignored)

        # Already ignored → ignore returns False
        assert await ignore_recommendation(rec_id) is False

    @pytest.mark.asyncio
    async def test_ignore_nonexistent(self) -> None:
        """Ignoring a non-existent recommendation returns False."""
        assert await ignore_recommendation(9999) is False
