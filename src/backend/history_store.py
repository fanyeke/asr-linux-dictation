"""History store for dictation session persistence."""

from backend import sqlite_async
from backend.database import get_db_path

VALID_STATUSES = {"recording", "transcribing", "polishing", "completed", "failed"}


def _row_to_dict(row: sqlite_async.Row) -> dict:
    """Convert a SQLite row to a dict with proper types."""
    return {
        "id": row["id"],
        "session_id": row["session_id"],
        "raw_text": row["raw_text"],
        "polished_text": row["polished_text"],
        "status": row["status"],
        "timing_ms": row["timing_ms"],
        "prompt_id": row["prompt_id"],
        "error_type": row["error_type"],
        "failed_audio_path": row["failed_audio_path"],
        "asr_ms": row["asr_ms"],
        "polish_ms": row["polish_ms"],
        "created_at": row["created_at"],
    }


async def create_session(session_id: str, prompt_id: int | None = None) -> dict:
    """Create a new dictation session.

    Args:
        session_id: Unique identifier for the session.
        prompt_id: Optional prompt template id.

    Returns:
        The newly created session dict.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            "INSERT INTO history (session_id, status, prompt_id) VALUES (?, ?, ?)",
            (session_id, "recording", prompt_id),
        )
        await db.commit()
        row = await db.execute(
            "SELECT * FROM history WHERE id = ?", (cursor.lastrowid,)
        )
        return _row_to_dict(await row.fetchone())


async def get_session(session_id: str) -> dict | None:
    """Retrieve a session by its session_id.

    Args:
        session_id: Unique session identifier.

    Returns:
        Session dict if found, None otherwise.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            "SELECT * FROM history WHERE session_id = ?", (session_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return _row_to_dict(row)


async def list_sessions(limit: int = 50, offset: int = 0) -> list[dict]:
    """List sessions with pagination, most recent first.

    Args:
        limit: Maximum number of sessions to return.
        offset: Number of sessions to skip.

    Returns:
        List of session dicts.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            "SELECT * FROM history ORDER BY id DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
        rows = await cursor.fetchall()
        return [_row_to_dict(row) for row in rows]


async def update_session(session_id: str, **kwargs) -> dict:
    """Update fields on an existing session.

    Accepts any subset of: raw_text, polished_text, status, timing_ms,
    prompt_id, error_type, failed_audio_path.

    Args:
        session_id: Unique session identifier.
        **kwargs: Fields to update.

    Returns:
        The updated session dict.

    Raises:
        ValueError: If the session is not found.
    """
    if not kwargs:
        return await get_session(session_id)  # type: ignore[return-value]

    valid_columns = {
        "raw_text",
        "polished_text",
        "status",
        "timing_ms",
        "prompt_id",
        "error_type",
        "failed_audio_path",
        "asr_ms",
        "polish_ms",
    }
    updates = {k: v for k, v in kwargs.items() if k in valid_columns}

    if "status" in updates and updates["status"] not in VALID_STATUSES:
        raise ValueError(
            f"Invalid status '{updates['status']}'. "
            f"Must be one of: {', '.join(sorted(VALID_STATUSES))}"
        )

    if not updates:
        return await get_session(session_id)  # type: ignore[return-value]

    set_clause = ", ".join(f"{col} = ?" for col in updates)
    values = list(updates.values())
    values.append(session_id)

    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            f"UPDATE history SET {set_clause} WHERE session_id = ?",
            values,
        )
        await db.commit()

        if cursor.rowcount == 0:
            raise ValueError(f"Session with session_id '{session_id}' not found")

        row = await db.execute(
            "SELECT * FROM history WHERE session_id = ?", (session_id,)
        )
        return _row_to_dict(await row.fetchone())


async def search_sessions(
    query: str = "",
    status: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Search sessions by text query and/or status.

    Searches ``raw_text`` and ``polished_text`` using SQL LIKE.
    When *status* is provided, also filters by session status.

    Args:
        query: Free-text search term (case-insensitive LIKE match).
        status: Optional status filter (e.g. ``"completed"``, ``"failed"``).
        limit: Maximum number of results (default 50).

    Returns:
        List of matching session dicts, most recent first.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row

        conditions: list[str] = []
        params: list = []

        if query:
            like = f"%{query}%"
            conditions.append("(raw_text LIKE ? OR polished_text LIKE ?)")
            params.extend([like, like])

        if status:
            conditions.append("status = ?")
            params.append(status)

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        sql = f"SELECT * FROM history {where_clause} ORDER BY id DESC LIMIT ?"
        params.append(limit)

        cursor = await db.execute(sql, tuple(params))
        rows = await cursor.fetchall()
        return [_row_to_dict(row) for row in rows]


async def get_failed_sessions() -> list[dict]:
    """Retrieve all sessions with status 'failed'.

    Returns:
        List of failed session dicts.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row
        cursor = await db.execute(
            "SELECT * FROM history WHERE status = ? ORDER BY id DESC",
            ("failed",),
        )
        rows = await cursor.fetchall()
        return [_row_to_dict(row) for row in rows]


async def mark_retry(session_id: str, new_session_id: str) -> dict:
    """Link an old failed session to a new retry session.

    Updates the old session's error_type to indicate it has been retried.

    Args:
        session_id: The original failed session id.
        new_session_id: The new retry session id.

    Returns:
        The updated old session dict.

    Raises:
        ValueError: If the old session is not found.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        db.row_factory = sqlite_async.Row

        # Fetch existing error_type
        cursor = await db.execute(
            "SELECT * FROM history WHERE session_id = ?", (session_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            raise ValueError(f"Session with session_id '{session_id}' not found")

        existing_error = row["error_type"] or ""
        retry_tag = f"retried:{new_session_id}"
        new_error = f"{existing_error};{retry_tag}" if existing_error else retry_tag

        await db.execute(
            "UPDATE history SET error_type = ? WHERE session_id = ?",
            (new_error, session_id),
        )
        await db.commit()

        updated = await db.execute(
            "SELECT * FROM history WHERE session_id = ?", (session_id,)
        )
        return _row_to_dict(await updated.fetchone())
