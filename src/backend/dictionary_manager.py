"""Dictionary manager for storing and retrieving canonical terms and aliases.

Stores canonical terms, aliases, notes, category, enforcement level, and
pronunciation. Supports pronunciation-based fuzzy matching so that terms
with similar pronunciation can be matched even when the ASR transcript
contains homophones or near-homophones.
"""

from backend import sqlite_async
from backend.database import get_db_path


def _row_to_dict(row: sqlite_async.Row) -> dict:
    """Convert a sqlite Row to a plain dict with the expected fields."""
    return {
        "id": row["id"],
        "canonical_term": row["canonical_term"],
        "pronunciation": row["pronunciation"],
        "aliases": row["aliases"],
        "notes": row["notes"],
        "category": row["category"],
        "enforcement_level": row["enforcement_level"],
    }


# ---------------------------------------------------------------------------
# Pinyin helpers for pronunciation matching
# ---------------------------------------------------------------------------

def _get_pinyin(text: str) -> list[str]:
    """Convert Chinese text to a list of pinyin syllables.

    Non-Chinese characters are preserved as individual tokens.
    """
    if not text:
        return []
    try:
        from pypinyin import lazy_pinyin

        return lazy_pinyin(text)
    except ImportError:  # pragma: no cover
        return list(text.lower())


def _pinyin_sequence_match(
    transcript_pinyin: list[str],
    term_pinyin: list[str],
    max_mismatches: int = 1,
) -> bool:
    """Check if ``term_pinyin`` appears as a contiguous subsequence in
    ``transcript_pinyin``, allowing up to ``max_mismatches`` syllable
    differences (音近匹配).

    Single-syllable terms require an exact match to avoid overly broad
    matching.
    """
    if not term_pinyin:
        return False
    n = len(term_pinyin)
    t_len = len(transcript_pinyin)
    if t_len < n:
        return False
    # Single-syllable terms must match exactly; longer terms may differ
    # by up to one syllable.
    allowed = 0 if n == 1 else max_mismatches
    for i in range(t_len - n + 1):
        window = transcript_pinyin[i : i + n]
        mismatches = sum(1 for a, b in zip(window, term_pinyin, strict=False) if a != b)
        if mismatches <= allowed:
            return True
    return False


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

async def create_entry(
    canonical_term: str,
    aliases: str | None = None,
    notes: str | None = None,
    category: str | None = None,
    enforcement_level: str = "suggested",
    pronunciation: str | None = None,
) -> dict:
    """Create a new dictionary entry.

    Args:
        canonical_term: The canonical spelling/name for the term.
        aliases: Comma-separated alternative spellings or phrases.
        notes: Optional notes about the term.
        category: Optional category grouping.
        enforcement_level: 'suggested' (default) or 'forced'.
        pronunciation: Optional pinyin representation. Auto-generated from
            ``canonical_term`` when not provided.

    Returns:
        The created entry as a dict.
    """
    db_path = get_db_path()
    auto_pinyin = " ".join(_get_pinyin(canonical_term)) if pronunciation is None else pronunciation
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            """
            INSERT INTO dictionary (canonical_term, pronunciation, aliases, notes, category, enforcement_level)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (canonical_term, auto_pinyin, aliases, notes, category, enforcement_level),
        )
        await db.commit()
        entry_id = cursor.lastrowid
        cursor = await db.execute(
            "SELECT * FROM dictionary WHERE id = ?", (entry_id,)
        )
        row = await cursor.fetchone()
        assert row is not None
        return _row_to_dict(row)


async def get_entry(entry_id: int) -> dict | None:
    """Retrieve a dictionary entry by id.

    Args:
        entry_id: The entry id.

    Returns:
        The entry dict, or None if not found.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            "SELECT * FROM dictionary WHERE id = ?", (entry_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return _row_to_dict(row)


async def list_entries(category: str | None = None) -> list[dict]:
    """List all dictionary entries, optionally filtered by category.

    Args:
        category: If set, only return entries in this category.

    Returns:
        List of entry dicts.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        if category is not None:
            cursor = await db.execute(
                "SELECT * FROM dictionary WHERE category = ? ORDER BY id",
                (category,),
            )
        else:
            cursor = await db.execute("SELECT * FROM dictionary ORDER BY id")
        rows = await cursor.fetchall()
        return [_row_to_dict(row) for row in rows]


async def update_entry(entry_id: int, **kwargs) -> dict:
    """Update an existing dictionary entry.

    Only the fields ``canonical_term``, ``pronunciation``, ``aliases``,
    ``notes``, ``category``, and ``enforcement_level`` are accepted.
    ``None`` values are skipped.

    When ``canonical_term`` is updated and ``pronunciation`` is not
    explicitly provided, the pronunciation is auto-regenerated.

    Args:
        entry_id: The entry id.
        **kwargs: Fields to update.

    Returns:
        The updated entry dict.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row

        allowed_fields = {
            "canonical_term",
            "pronunciation",
            "aliases",
            "notes",
            "category",
            "enforcement_level",
        }
        updates = {k: v for k, v in kwargs.items() if k in allowed_fields and v is not None}

        # Auto-regenerate pronunciation when canonical_term changes and
        # pronunciation is not explicitly provided.
        if "canonical_term" in updates and "pronunciation" not in kwargs:
            updates["pronunciation"] = " ".join(_get_pinyin(updates["canonical_term"]))

        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values())
            values.append(entry_id)
            await db.execute(
                f"UPDATE dictionary SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                values,
            )
            await db.commit()

        cursor = await db.execute(
            "SELECT * FROM dictionary WHERE id = ?", (entry_id,)
        )
        row = await cursor.fetchone()
        assert row is not None
        return _row_to_dict(row)


async def delete_entry(entry_id: int) -> bool:
    """Delete a dictionary entry by id.

    Args:
        entry_id: The entry id.

    Returns:
        True if a row was deleted, False otherwise.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "DELETE FROM dictionary WHERE id = ?", (entry_id,)
        )
        await db.commit()
        return cursor.rowcount > 0


# ---------------------------------------------------------------------------
# Relevance selection (text + pronunciation fuzzy match)
# ---------------------------------------------------------------------------

async def find_relevant_entries(transcript: str) -> list[dict]:
    """Find dictionary entries relevant to a given transcript.

    An entry is relevant when:

    1. The **canonical_term** or any of its comma-separated **aliases**
       appears as a case-insensitive substring of *transcript*.
    2. **OR** the pinyin of the canonical_term / aliases matches the
       pinyin of any contiguous phrase in the transcript, allowing up
       to one syllable difference (音近匹配).

    Args:
        transcript: The raw transcript text.

    Returns:
        List of matching entry dicts.
    """
    transcript_lower = transcript.lower()
    transcript_pinyin = _get_pinyin(transcript)

    all_entries = await list_entries()
    relevant: list[dict] = []
    seen_ids: set[int] = set()

    for entry in all_entries:
        entry_id = entry["id"]
        if entry_id in seen_ids:
            continue

        # --- Layer 1: exact text match ---
        matched = False
        if entry["canonical_term"].lower() in transcript_lower:
            matched = True
        elif entry["aliases"]:
            for alias in entry["aliases"].split(","):
                if alias.strip().lower() in transcript_lower:
                    matched = True
                    break

        # --- Layer 2: pronunciation fuzzy match ---
        if not matched and entry.get("pronunciation"):
            term_pinyin = entry["pronunciation"].split()
            if _pinyin_sequence_match(transcript_pinyin, term_pinyin, max_mismatches=1):
                matched = True

        # Also check aliases pronunciation if no direct match
        if not matched and entry.get("aliases"):
            for alias in entry["aliases"].split(","):
                alias_pinyin = _get_pinyin(alias.strip())
                if _pinyin_sequence_match(transcript_pinyin, alias_pinyin, max_mismatches=1):
                    matched = True
                    break

        if matched:
            relevant.append(entry)
            seen_ids.add(entry_id)

    return relevant


# ---------------------------------------------------------------------------
# Match frequency tracking
# ---------------------------------------------------------------------------

def count_matches_in_text(
    dictionary_entries: list[dict],
    text: str,
) -> list[dict]:
    """Count how many times each dictionary entry appears in *text*.

    Args:
        dictionary_entries: List of entry dicts with at least ``id`` and
            ``canonical_term`` keys.
        text: The text to scan (typically the polished transcript).

    Returns:
        List of ``{"entry_id": int, "canonical_term": str, "count": int}``
        for entries that appear at least once in *text*.
    """
    if not text:
        return []

    text_lower = text.lower()
    results: list[dict] = []
    for entry in dictionary_entries:
        term = entry.get("canonical_term", "")
        if term and term.lower() in text_lower:
            count = text_lower.count(term.lower())
            results.append({
                "entry_id": entry["id"],
                "canonical_term": term,
                "count": count,
            })
    return results


async def record_dictionary_stats(
    session_id: str,
    match_counts: list[dict],
) -> None:
    """Write dictionary match stats for a session.

    Args:
        session_id: The dictation session id.
        match_counts: List of ``{"entry_id": ..., "count": ...}`` from
            :func:`count_matches_in_text`.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        for mc in match_counts:
            await db.execute(
                "INSERT INTO dictionary_stats (entry_id, session_id, matched_count) VALUES (?, ?, ?)",
                (mc["entry_id"], session_id, mc["count"]),
            )
        await db.commit()


async def get_dictionary_stats_summary(
    limit_sessions: int = 10,
) -> list[dict]:
    """Get per-entry match frequency summary for the last N sessions.

    Returns a list of dicts with ``entry_id``, ``canonical_term``,
    ``total_matches``, ``session_count``.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            """
            SELECT
                ds.entry_id,
                d.canonical_term,
                SUM(ds.matched_count) AS total_matches,
                COUNT(DISTINCT ds.session_id) AS session_count
            FROM dictionary_stats ds
            JOIN dictionary d ON d.id = ds.entry_id
            WHERE ds.session_id IN (
                SELECT DISTINCT session_id FROM dictionary_stats
                ORDER BY created_at DESC
                LIMIT ?
            )
            GROUP BY ds.entry_id
            ORDER BY total_matches DESC
            """,
            (limit_sessions,),
        )
        rows = await cursor.fetchall()
        return [
            {
                "entry_id": row["entry_id"],
                "canonical_term": row["canonical_term"],
                "total_matches": row["total_matches"],
                "session_count": row["session_count"],
            }
            for row in rows
        ]
