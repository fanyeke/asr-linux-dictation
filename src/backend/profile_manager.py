"""Profile manager for scene-based prompt templates.

Provides CRUD for named profiles, each of which bundles a prompt template,
associated dictionary entries, and an ASR language setting.  Built-in
presets are seeded on first database init and cannot be deleted.
"""

from backend import sqlite_async
from backend.database import get_db_path

# ---------------------------------------------------------------------------
# Built-in presets
# ---------------------------------------------------------------------------
BUILTIN_PROFILES: list[dict] = [
    {
        "name": "通用",
        "prompt_template": "{text}",
        "dictionary_ids": None,
        "asr_language": "auto",
        "builtin": True,
    },
    {
        "name": "编程",
        "prompt_template": (
            "You are a code-savvy assistant. Correct grammar and punctuation "
            "in the following dictation text. Preserve camelCase, snake_case, "
            "and code keywords (TODO, FIXME, HACK, XXX). Do NOT auto-close "
            "parentheses, brackets, or quotes. Keep technical terms and symbols "
            "exactly as dictated. Output ONLY the corrected text.\n\n{text}"
        ),
        "dictionary_ids": None,
        "asr_language": "auto",
        "builtin": True,
    },
    {
        "name": "写作",
        "prompt_template": (
            "You are a writing assistant. Polish the following dictation into "
            "formal written Chinese/English. Improve sentence structure, add "
            "appropriate paragraph breaks, and use formal vocabulary. Remove "
            "filler words. Output ONLY the polished text.\n\n{text}"
        ),
        "dictionary_ids": None,
        "asr_language": "auto",
        "builtin": True,
    },
    {
        "name": "会议记录",
        "prompt_template": (
            "You are a meeting note taker. Condense the following dictation "
            "into concise notes. Remove filler words, filler phrases, and "
            "casual speech patterns. Preserve key information, decisions, "
            "action items, and named entities. Use bullet points where "
            "appropriate. Output ONLY the notes.\n\n{text}"
        ),
        "dictionary_ids": None,
        "asr_language": "auto",
        "builtin": True,
    },
    {
        "name": "聊天",
        "prompt_template": (
            "You are a chat assistant. Lightly polish the following dictation "
            "for a casual conversation context. Keep the speaker's tone, "
            "fillers, and informal style. Fix obvious typos and punctuation. "
            "Output ONLY the polished text.\n\n{text}"
        ),
        "dictionary_ids": None,
        "asr_language": "auto",
        "builtin": True,
    },
]


def _row_to_dict(row: sqlite_async.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "prompt_template": row["prompt_template"],
        "dictionary_ids": row["dictionary_ids"],
        "asr_language": row["asr_language"],
        "is_active": bool(row["is_active"]),
        "builtin": bool(row["builtin"]),
    }


async def seed_profiles() -> None:
    """Insert built-in profiles if the table is empty."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute("SELECT COUNT(*) AS cnt FROM profiles")
        row = await cursor.fetchone()
        if row and row[0] > 0:
            return
        for p in BUILTIN_PROFILES:
            await db.execute(
                "INSERT INTO profiles (name, prompt_template, dictionary_ids, asr_language, builtin) "
                "VALUES (?, ?, ?, ?, ?)",
                (p["name"], p["prompt_template"], p["dictionary_ids"], p["asr_language"], 1),
            )
        # Activate the first profile
        await db.execute("UPDATE profiles SET is_active = 1 WHERE id = 1")
        await db.commit()


async def list_profiles() -> list[dict]:
    """List all profiles, ordered by id."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            "SELECT * FROM profiles ORDER BY id"
        )
        rows = await cursor.fetchall()
        return [_row_to_dict(r) for r in rows]


async def get_profile(profile_id: int) -> dict | None:
    """Get a single profile by id."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            "SELECT * FROM profiles WHERE id = ?", (profile_id,)
        )
        row = await cursor.fetchone()
        return _row_to_dict(row) if row else None


async def create_profile(
    name: str,
    prompt_template: str,
    dictionary_ids: str | None = None,
    asr_language: str = "auto",
) -> dict:
    """Create a new profile."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            "INSERT INTO profiles (name, prompt_template, dictionary_ids, asr_language) "
            "VALUES (?, ?, ?, ?)",
            (name, prompt_template, dictionary_ids, asr_language),
        )
        await db.commit()
        new_id = cursor.lastrowid
        cursor = await db.execute("SELECT * FROM profiles WHERE id = ?", (new_id,))
        return _row_to_dict(await cursor.fetchone())


async def update_profile(
    profile_id: int,
    name: str | None = None,
    prompt_template: str | None = None,
    dictionary_ids: str | None = None,
    asr_language: str | None = None,
) -> dict | None:
    """Update an existing profile. Returns None if not found."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row

        # Check existence and builtin
        cursor = await db.execute(
            "SELECT * FROM profiles WHERE id = ?", (profile_id,)
        )
        existing = await cursor.fetchone()
        if not existing:
            return None

        updates = {}
        if name is not None:
            updates["name"] = name
        if prompt_template is not None:
            updates["prompt_template"] = prompt_template
        if dictionary_ids is not None:
            updates["dictionary_ids"] = dictionary_ids
        if asr_language is not None:
            updates["asr_language"] = asr_language

        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values())
            values.append(profile_id)
            await db.execute(
                f"UPDATE profiles SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                values,
            )
            await db.commit()

        cursor = await db.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,))
        return _row_to_dict(await cursor.fetchone())


async def delete_profile(profile_id: int) -> bool:
    """Delete a profile. Built-in profiles cannot be deleted."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "SELECT builtin FROM profiles WHERE id = ?", (profile_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return False
        if row[0]:
            return False  # Cannot delete built-in
        await db.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        await db.commit()
        return True


async def set_active_profile(profile_id: int) -> dict | None:
    """Set a profile as the active one (deactivates others)."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            "SELECT * FROM profiles WHERE id = ?", (profile_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return None
        # Deactivate all, then activate this one
        await db.execute("UPDATE profiles SET is_active = 0")
        await db.execute(
            "UPDATE profiles SET is_active = 1 WHERE id = ?", (profile_id,)
        )
        await db.commit()
        return _row_to_dict(row)


async def get_active_profile() -> dict | None:
    """Get the currently active profile, or None."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            "SELECT * FROM profiles WHERE is_active = 1 LIMIT 1"
        )
        row = await cursor.fetchone()
        return _row_to_dict(row) if row else None
