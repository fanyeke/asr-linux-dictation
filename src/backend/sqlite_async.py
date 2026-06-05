"""Small async wrapper around stdlib sqlite3.

The project only needs a narrow subset of the aiosqlite API.  This wrapper keeps
that call shape while avoiding a worker-thread startup hang seen with
``aiosqlite.connect()`` in the current Python runtime.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from types import TracebackType
from typing import Any

Row = sqlite3.Row


class Cursor:
    """Async facade for ``sqlite3.Cursor`` fetch operations."""

    def __init__(self, cursor: sqlite3.Cursor) -> None:
        self._cursor = cursor

    @property
    def lastrowid(self) -> int | None:
        return self._cursor.lastrowid

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    async def fetchone(self) -> Any:
        return self._cursor.fetchone()

    async def fetchall(self) -> list[Any]:
        return self._cursor.fetchall()


class Connection:
    """Async context manager for a SQLite connection."""

    def __init__(self, database: str | Path, **kwargs: Any) -> None:
        self._database = str(database)
        self._kwargs = kwargs
        self._connection: sqlite3.Connection | None = None

    async def __aenter__(self) -> Connection:
        self._connection = sqlite3.connect(self._database, **self._kwargs)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.close()

    @property
    def row_factory(self) -> Any:
        return self._require_connection().row_factory

    @row_factory.setter
    def row_factory(self, value: Any) -> None:
        self._require_connection().row_factory = value

    async def execute(
        self,
        sql: str,
        parameters: tuple[Any, ...] | list[Any] = (),
    ) -> Cursor:
        conn = self._require_connection()
        return Cursor(conn.execute(sql, parameters))

    async def commit(self) -> None:
        self._require_connection().commit()

    async def close(self) -> None:
        if self._connection is None:
            return
        conn = self._connection
        self._connection = None
        conn.close()

    def _require_connection(self) -> sqlite3.Connection:
        if self._connection is None:
            raise RuntimeError("SQLite connection is not open")
        return self._connection


def connect(database: str | Path, **kwargs: Any) -> Connection:
    """Return an async SQLite connection context manager."""
    return Connection(database, **kwargs)
