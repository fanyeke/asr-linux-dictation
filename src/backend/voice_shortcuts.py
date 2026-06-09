"""User-configurable voice shortcuts stored in SQLite.

Provides CRUD operations on the ``voice_commands`` table for user-created
shortcuts.  The built-in commands live as constants in ``voice_command.py``;
this module manages the user-customisable subset.
"""

from __future__ import annotations

import json
from typing import Any

from backend import sqlite_async
from backend.database import get_db_path


def _row_to_dict(row: Any) -> dict:
    """Convert a sqlite row to a shortcut dict."""
    return {
        "id": row[0],
        "keywords": json.loads(row[1]),
        "action_type": row[2],
        "action_params": json.loads(row[3]) if row[3] else {},
        "description": row[4],
        "enabled": bool(row[5]),
        "created_at": row[7],
        "updated_at": row[8],
    }


async def list_shortcuts() -> list[dict]:
    """List all user-defined voice shortcuts (``builtin=0``)."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "SELECT id, keywords, action_type, action_params, description, "
            "enabled, builtin, created_at, updated_at "
            "FROM voice_commands WHERE builtin = 0 ORDER BY id"
        )
        rows = await cursor.fetchall()
        return [_row_to_dict(r) for r in rows]


async def create_shortcut(
    keywords: list[str],
    action_type: str,
    action_params: dict | None = None,
    description: str = "",
) -> dict:
    """Create a new user voice shortcut.

    Args:
        keywords: Trigger phrases (at least one required).
        action_type: One of ``keyboard``, ``keyboard_seq``, ``launch``,
            ``shell``, ``http``.
        action_params: Type-specific parameters.
        description: Human-readable description.

    Returns:
        The created shortcut dict with the new ``id``.
    """
    if not keywords:
        raise ValueError("At least one keyword is required")

    if action_type not in ("keyboard", "keyboard_seq", "launch", "shell", "http"):
        raise ValueError(f"Unknown action_type: {action_type}")

    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "INSERT INTO voice_commands "
            "(keywords, action_type, action_params, description, enabled, builtin) "
            "VALUES (?, ?, ?, ?, 1, 0)",
            (
                json.dumps(keywords, ensure_ascii=False),
                action_type,
                json.dumps(action_params or {}, ensure_ascii=False),
                description,
            ),
        )
        shortcut_id = cursor.lastrowid
        await db.commit()

    return {
        "id": shortcut_id,
        "keywords": keywords,
        "action_type": action_type,
        "action_params": action_params or {},
        "description": description,
        "enabled": True,
    }


async def get_shortcut(shortcut_id: int) -> dict | None:
    """Get a single shortcut by id."""
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "SELECT id, keywords, action_type, action_params, description, "
            "enabled, builtin, created_at, updated_at "
            "FROM voice_commands WHERE id = ?",
            (shortcut_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return _row_to_dict(row)


async def update_shortcut(
    shortcut_id: int,
    keywords: list[str] | None = None,
    action_type: str | None = None,
    action_params: dict | None = None,
    description: str | None = None,
    enabled: bool | None = None,
) -> dict | None:
    """Update an existing user shortcut.

    Only the fields supplied are changed.  Built-in shortcuts may not be
    updated — the function returns ``None`` for builtins.

    Returns:
        The updated shortcut dict, or ``None`` if the id does not exist
        or refers to a built-in command.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "SELECT id FROM voice_commands WHERE id = ? AND builtin = 0",
            (shortcut_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None

        set_clauses: list[str] = []
        params: list[Any] = []

        if keywords is not None:
            set_clauses.append("keywords = ?")
            params.append(json.dumps(keywords, ensure_ascii=False))
        if action_type is not None:
            if action_type not in ("keyboard", "keyboard_seq", "launch", "shell", "http"):
                raise ValueError(f"Unknown action_type: {action_type}")
            set_clauses.append("action_type = ?")
            params.append(action_type)
        if action_params is not None:
            set_clauses.append("action_params = ?")
            params.append(json.dumps(action_params, ensure_ascii=False))
        if description is not None:
            set_clauses.append("description = ?")
            params.append(description)
        if enabled is not None:
            set_clauses.append("enabled = ?")
            params.append(1 if enabled else 0)

        if not set_clauses:
            return await get_shortcut(shortcut_id)

        set_clauses.append("updated_at = CURRENT_TIMESTAMP")
        params.append(shortcut_id)

        await db.execute(
            f"UPDATE voice_commands SET {', '.join(set_clauses)} WHERE id = ?",
            tuple(params),
        )
        await db.commit()

    return await get_shortcut(shortcut_id)


async def delete_shortcut(shortcut_id: int) -> bool:
    """Delete a user shortcut.

    Built-in commands cannot be deleted.

    Returns:
        True if a row was deleted, False otherwise.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "DELETE FROM voice_commands WHERE id = ? AND builtin = 0",
            (shortcut_id,),
        )
        await db.commit()
        return cursor.rowcount > 0


async def load_user_commands() -> list[dict]:
    """Load all enabled user commands from the DB as command dicts.

    Returns a list compatible with ``voice_command.match_command()`` and
    ``voice_command.execute_command()``.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            "SELECT id, keywords, action_type, action_params, description, "
            "enabled, builtin, created_at, updated_at "
            "FROM voice_commands WHERE builtin = 0 AND enabled = 1 "
            "ORDER BY id"
        )
        rows = await cursor.fetchall()

    result = []
    for r in rows:
        data = _row_to_dict(r)
        result.append(
            {
                "keywords": data["keywords"],
                "action_type": data["action_type"],
                "action_params": data["action_params"],
                "description": data["description"],
                "enabled": True,
                "builtin": False,
                "id": data["id"],
            }
        )
    return result
