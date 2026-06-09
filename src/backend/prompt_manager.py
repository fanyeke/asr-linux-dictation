"""Prompt management for ASR Linux."""

from backend import sqlite_async
from backend.database import get_db_path


def _row_to_dict(row: sqlite_async.Row) -> dict:
    """Convert a SQLite row to a dict with proper types."""
    return {
        "id": row["id"],
        "name": row["name"],
        "template": row["template"],
        "is_active": bool(row["is_active"]),
    }


async def create_prompt(name: str, template: str) -> dict:
    """Create a new prompt."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            "INSERT INTO prompts (name, template) VALUES (?, ?)",
            (name, template),
        )
        await db.commit()
        row = await db.execute("SELECT * FROM prompts WHERE id = ?", (cursor.lastrowid,))
        return _row_to_dict(await row.fetchone())


async def get_prompt(prompt_id: int) -> dict | None:
    """Get a prompt by id."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute("SELECT * FROM prompts WHERE id = ?", (prompt_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        return _row_to_dict(row)


async def list_prompts() -> list[dict]:
    """List all prompts."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute("SELECT * FROM prompts ORDER BY id")
        rows = await cursor.fetchall()
        return [_row_to_dict(row) for row in rows]


async def update_prompt(prompt_id: int, name: str, template: str) -> dict:
    """Update an existing prompt."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        await db.execute(
            "UPDATE prompts SET name = ?, template = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (name, template, prompt_id),
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM prompts WHERE id = ?", (prompt_id,))
        row = await cursor.fetchone()
        if row is None:
            raise ValueError(f"Prompt with id {prompt_id} not found")
        return _row_to_dict(row)


async def delete_prompt(prompt_id: int) -> bool:
    """Delete a prompt. Returns True if a row was deleted."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute("DELETE FROM prompts WHERE id = ?", (prompt_id,))
        await db.commit()
        return cursor.rowcount > 0


async def set_active_prompt(prompt_id: int) -> None:
    """Set a prompt as active, deactivating all others."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        await db.execute("UPDATE prompts SET is_active = 0")
        await db.execute("UPDATE prompts SET is_active = 1 WHERE id = ?", (prompt_id,))
        await db.commit()


async def get_active_prompt() -> dict | None:
    """Get the currently active prompt, or None."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute("SELECT * FROM prompts WHERE is_active = 1 LIMIT 1")
        row = await cursor.fetchone()
        if row is None:
            return None
        return _row_to_dict(row)
