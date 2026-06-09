"""Vocabulary learner — discovers ASR correction patterns from history.

Compares ``raw_text`` (ASR output) with ``polished_text`` (LLM or user-edited)
to identify words the ASR consistently gets wrong.  Generates dictionary
recommendations that the user can accept or ignore.
"""

from __future__ import annotations

import difflib
import re

from backend import sqlite_async
from backend.database import get_db_path
from backend.logging_config import get_logger

logger = get_logger(__name__)

# Minimum occurrences before surfacing a recommendation
MIN_FREQUENCY = 3
# Maximum Levenshtein distance for a valid correction pair
MAX_EDIT_DISTANCE = 2
# Minimum confidence score (0.0 - 1.0)
MIN_CONFIDENCE = 0.7

# Tokenizer: matches CJK characters individually, or word tokens
_TOKEN_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+|[a-zA-Z0-9_]+|[^\s]+")

_IGNORED_TOKENS: frozenset[str] = frozenset({".", ",", "!", "?", ":", ";", "，", "。", "、", "！", "？", "：", "；"})


def _tokenize(text: str) -> list[str]:
    """Split text into tokens.

    CJK characters are split individually; Western words are kept whole.
    Punctuation-only tokens are filtered out.
    """
    tokens: list[str] = []
    for match in _TOKEN_RE.finditer(text):
        token = match.group()
        if token in _IGNORED_TOKENS:
            continue
        # Split CJK into individual characters
        if re.match(r"^[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+$", token):
            tokens.extend(list(token))
        else:
            tokens.append(token)
    return tokens


def _levenshtein(a: str, b: str) -> int:
    """Compute the Levenshtein edit distance between *a* and *b*."""
    if len(a) < len(b):
        a, b = b, a
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        curr = [i + 1]
        for j, cb in enumerate(b):
            cost = 0 if ca == cb else 1
            curr.append(min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost))
        prev = curr
    return prev[-1]


def _diff_texts(raw: str, polished: str) -> list[dict]:
    """Extract raw → polished replacement pairs from two texts.

    Returns a list of dicts with ``raw``, ``polished``, and
    ``edit_distance`` keys.
    """
    raw_tokens = _tokenize(raw)
    polished_tokens = _tokenize(polished)
    matcher = difflib.SequenceMatcher(None, raw_tokens, polished_tokens)
    pairs: list[dict] = []

    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "replace":
            raw_seg = " ".join(raw_tokens[i1:i2])
            polished_seg = " ".join(polished_tokens[j1:j2])
            if raw_seg and polished_seg and raw_seg != polished_seg:
                dist = _levenshtein(raw_seg, polished_seg)
                pairs.append(
                    {
                        "raw": raw_seg,
                        "polished": polished_seg,
                        "edit_distance": dist,
                    }
                )

    return pairs


async def scan_history() -> list[dict]:
    """Scan all completed history sessions and extract correction pairs.

    Returns a scored and filtered list of candidates, ordered by
    descending confidence.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "SELECT raw_text, polished_text FROM history "
            "WHERE status = 'completed' AND raw_text IS NOT NULL "
            "AND polished_text IS NOT NULL AND raw_text != polished_text"
        )
        rows = await cursor.fetchall()

    # Aggregate pairs by raw → polished mapping
    counter: dict[tuple[str, str], dict] = {}
    for row in rows:
        raw, polished = row
        if not raw or not polished:
            continue
        pairs = _diff_texts(raw, polished)
        for pair in pairs:
            key = (pair["raw"], pair["polished"])
            if key in counter:
                counter[key]["frequency"] += 1
            else:
                counter[key] = {
                    "raw_term": pair["raw"],
                    "polished_term": pair["polished"],
                    "frequency": 1,
                    "edit_distance": pair["edit_distance"],
                }

    candidates = list(counter.values())
    if not candidates:
        return []

    # Score: weighted combo of frequency and edit-distance
    max_freq = max(c["frequency"] for c in candidates)
    for c in candidates:
        freq_score = c["frequency"] / max_freq
        # Inverse edit-distance score (use MAX_EDIT_DISTANCE as fixed reference)
        dist_score = 1.0 - (c["edit_distance"] / (MAX_EDIT_DISTANCE + 1))
        c["confidence"] = round(freq_score * 0.6 + dist_score * 0.4, 2)

    # Filter by thresholds
    return sorted(
        (
            c
            for c in candidates
            if c["frequency"] >= MIN_FREQUENCY
            and c["edit_distance"] <= MAX_EDIT_DISTANCE
            and c["confidence"] >= MIN_CONFIDENCE
        ),
        key=lambda x: (-x["confidence"], -x["frequency"]),
    )


async def generate_recommendations() -> list[dict]:
    """Run ``scan_history()`` and persist new recommendations.

    Skips raw_term values that already have a pending or accepted
    recommendation in the database.

    Returns:
        The list of newly created recommendation dicts.
    """
    candidates = await scan_history()
    db_path = get_db_path()

    # Existing raw_terms to skip
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "SELECT DISTINCT raw_term FROM vocab_recommendations WHERE status IN ('pending', 'accepted')"
        )
        existing = {r[0] for r in await cursor.fetchall()}

    new_recs: list[dict] = []
    async with sqlite_async.connect(db_path) as db:
        for c in candidates:
            if c["raw_term"] in existing:
                continue
            cursor = await db.execute(
                "INSERT INTO vocab_recommendations "
                "(raw_term, polished_term, frequency, confidence, edit_distance, status) "
                "VALUES (?, ?, ?, ?, ?, 'pending')",
                (
                    c["raw_term"],
                    c["polished_term"],
                    c["frequency"],
                    c["confidence"],
                    c["edit_distance"],
                ),
            )
            new_recs.append(
                {
                    "id": cursor.lastrowid,
                    **c,
                    "status": "pending",
                }
            )
        await db.commit()

    logger.info("vocab_recommendations_generated", count=len(new_recs))
    return new_recs


async def list_recommendations(status: str | None = None) -> list[dict]:
    """List recommendations, optionally filtered by *status*.

    Args:
        status: ``\"pending\"``, ``\"accepted\"``, ``\"ignored\"``,
            or ``None`` for all.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        if status:
            cursor = await db.execute(
                "SELECT id, raw_term, polished_term, frequency, confidence, "
                "edit_distance, status, notes, created_at "
                "FROM vocab_recommendations WHERE status = ? ORDER BY confidence DESC",
                (status,),
            )
        else:
            cursor = await db.execute(
                "SELECT id, raw_term, polished_term, frequency, confidence, "
                "edit_distance, status, notes, created_at "
                "FROM vocab_recommendations ORDER BY confidence DESC"
            )
        rows = await cursor.fetchall()

    return [
        {
            "id": r[0],
            "raw_term": r[1],
            "polished_term": r[2],
            "frequency": r[3],
            "confidence": r[4],
            "edit_distance": r[5],
            "status": r[6],
            "notes": r[7] or "",
            "created_at": r[8],
        }
        for r in rows
    ]


async def accept_recommendation(
    rec_id: int,
    enforcement_level: str = "suggested",
) -> dict | None:
    """Accept a recommendation: add to dictionary and mark as accepted.

    Args:
        rec_id: Recommendation id.
        enforcement_level: ``\"suggested\"`` (default) or ``\"forced\"``.

    Returns:
        The dictionary entry created, or ``None`` if not found or
        already processed.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "SELECT id, raw_term, polished_term FROM vocab_recommendations WHERE id = ? AND status = 'pending'",
            (rec_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None

        from backend.dictionary_manager import create_entry

        entry = await create_entry(
            canonical_term=row[2],
            aliases=row[1],
            notes=f"Auto-learned: {row[1]} \u2192 {row[2]}",
            category="vocab_learning",
            enforcement_level=enforcement_level,
        )

        await db.execute(
            "UPDATE vocab_recommendations SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (rec_id,),
        )
        await db.commit()

    return entry


async def ignore_recommendation(rec_id: int) -> bool:
    """Mark a recommendation as ignored.

    Returns:
        ``True`` if a row was updated.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "UPDATE vocab_recommendations SET status = 'ignored', "
            "updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
            (rec_id,),
        )
        await db.commit()
        return cursor.rowcount > 0
