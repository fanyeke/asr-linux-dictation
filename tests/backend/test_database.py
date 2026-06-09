"""Tests for SQLite database connection and migration baseline."""

from pathlib import Path

import pytest

from backend.database import get_db_path, init_database


class TestDatabasePath:
    """Test database file path resolution."""

    def test_db_path_in_data_dir(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Database file is placed in the data directory."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        db_path = get_db_path()
        assert db_path.parent == tmp_path
        assert db_path.name == "asr-linux.db"


class TestDatabaseInitialization:
    """Test database initialization and migrations."""

    @pytest.mark.asyncio
    async def test_database_file_created(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Database file is created on initialization."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        db_path = get_db_path()
        assert db_path.exists()

    @pytest.mark.asyncio
    async def test_migrations_table_exists(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Migrations table is created during initialization."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        db_path = get_db_path()

        from backend import sqlite_async

        async with sqlite_async.connect(db_path) as db:
            cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'")
            row = await cursor.fetchone()
            assert row is not None
            assert row[0] == "migrations"

    @pytest.mark.asyncio
    async def test_migration_record_inserted(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Baseline migration record is inserted."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        db_path = get_db_path()

        from backend import sqlite_async

        async with sqlite_async.connect(db_path) as db:
            cursor = await db.execute("SELECT version FROM migrations ORDER BY version DESC LIMIT 1")
            row = await cursor.fetchone()
            assert row is not None
            assert row[0] == 0
