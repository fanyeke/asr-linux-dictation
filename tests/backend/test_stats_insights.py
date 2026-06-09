"""Tests for the usage insights engine."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

import pytest

from backend.database import init_database
from backend.stats_insights import compute_insights


def _insert_history_sync(db_path: str, records: list[dict]) -> None:
    """Insert history records synchronously for test setup."""
    import sqlite3

    conn = sqlite3.connect(db_path)
    for r in records:
        conn.execute(
            """INSERT INTO history
               (session_id, raw_text, polished_text, status, timing_ms)
               VALUES (?, ?, ?, ?, ?)""",
            (r["sid"], r["raw"], r.get("polished"), r["status"], r.get("timing_ms")),
        )
    conn.commit()
    conn.close()


class TestComputeInsights:
    """Tests for the compute_insights function."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_empty_db(self) -> None:
        """With no history, insights return zeros and a 'no data' summary."""
        insights = await compute_insights()

        assert insights["current"]["sessions"] == 0
        assert insights["current"]["total_chars"] == 0
        assert insights["streak"] == 0
        assert insights["best_hour"] is None
        assert insights["time_saved_seconds"] == 0
        assert "还没有听写数据" in insights["summary"]

    @pytest.mark.asyncio
    async def test_with_recent_session(self) -> None:
        """A recent session is counted in current period."""
        from backend.database import get_db_path

        _insert_history_sync(
            str(get_db_path()),
            [
                {
                    "sid": "sess-1",
                    "raw": "hello world this is a test",
                    "polished": "Hello world this is a test.",
                    "status": "completed",
                    "timing_ms": 5000,
                },
            ],
        )

        insights = await compute_insights()
        assert insights["current"]["sessions"] == 1
        assert insights["current"]["successes"] == 1
        assert insights["current"]["total_chars"] == len("hello world this is a test")
        assert insights["best_hour"] is not None  # should detect the hour
        assert insights["summary"] != ""

    @pytest.mark.asyncio
    async def test_streak_detection(self) -> None:
        """Consecutive daily sessions build a streak."""
        from backend.database import get_db_path

        db_path = str(get_db_path())
        today = datetime.now()
        records = []
        for i in range(3):
            day = today - timedelta(days=i)
            records.append(
                {
                    "sid": f"sess-streak-{i}",
                    "raw": f"test {i}",
                    "polished": f"Test {i}.",
                    "status": "completed",
                    "timing_ms": 1000,
                }
            )
            # Manually set created_at
            import sqlite3

            conn = sqlite3.connect(db_path)
            conn.execute(
                """INSERT INTO history (session_id, raw_text, polished_text, status, timing_ms, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (f"sess-streak-{i}", f"test {i}", f"Test {i}.", "completed", 1000, day.isoformat()),
            )
            conn.commit()
            conn.close()

        insights = await compute_insights()
        # Should detect at least 1 day streak
        assert insights["streak"] >= 1

    @pytest.mark.asyncio
    async def test_insight_keys_exist(self) -> None:
        """All expected keys are present in the response."""
        from backend.database import get_db_path

        _insert_history_sync(
            str(get_db_path()),
            [
                {
                    "sid": "sess-key1",
                    "raw": "test data",
                    "polished": "Test data.",
                    "status": "completed",
                    "timing_ms": 2000,
                },
            ],
        )

        insights = await compute_insights()
        assert "current" in insights
        assert "previous" in insights
        assert "streak" in insights
        assert "best_hour" in insights
        assert "time_saved_seconds" in insights
        assert "comparison" in insights
        assert "summary" in insights
        assert isinstance(insights["comparison"]["sessions_trend"], str)

    @pytest.mark.asyncio
    async def test_mixed_success_failure(self) -> None:
        """Mix of completed and failed sessions."""
        from backend.database import get_db_path

        _insert_history_sync(
            str(get_db_path()),
            [
                {"sid": "s1", "raw": "ok", "status": "completed", "timing_ms": 1000},
                {"sid": "s2", "raw": "fail1", "status": "failed", "timing_ms": 500},
                {"sid": "s3", "raw": "fail2", "status": "failed", "timing_ms": 500},
                {"sid": "s4", "raw": "ok2", "status": "completed", "timing_ms": 2000},
            ],
        )

        insights = await compute_insights()
        assert insights["current"]["sessions"] == 4
        assert insights["current"]["successes"] == 2
        assert insights["current"]["fails"] == 2
        assert insights["comparison"]["success_rate_now"] == 50.0
