"""Usage insights engine — period comparisons, streaks, time-saved estimates.

Aggregates data from the ``history`` table to produce human-readable
insights for the dashboard.  All queries use SQLite aggregate functions
and do not require additional storage.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from backend import sqlite_async
from backend.database import get_db_path
from backend.logging_config import get_logger

logger = get_logger(__name__)

# Average typing speed used for "time saved" estimate (words per minute)
TYPING_WPM = 40
# Average word length in characters (used to convert chars to words)
AVG_WORD_LENGTH = 5


def _period_bounds(days: int) -> tuple[str, str]:
    """Return ``(start, end)`` ISO timestamps for a period ending now.

    Args:
        days: Number of days the period covers.

    Returns:
        ``(start_iso, end_iso)`` tuple.
    """
    end = datetime.now()
    start = end - timedelta(days=days)
    return start.isoformat(), end.isoformat()


async def _query_period_stats(days: int) -> dict:
    """Query aggregate stats for the last *days* days.

    Returns a dict with ``sessions``, ``successes``, ``fails``,
    ``total_chars``, ``total_duration_ms``, ``avg_duration_ms``.
    """
    start, end = _period_bounds(days)
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            """SELECT
                COUNT(*) AS sessions,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS successes,
                SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) AS fails,
                COALESCE(SUM(LENGTH(raw_text)), 0) AS total_chars,
                COALESCE(SUM(timing_ms), 0) AS total_duration_ms,
                AVG(timing_ms) AS avg_duration_ms
            FROM history
            WHERE created_at >= ? AND created_at <= ?""",
            (start, end),
        )
        row = await cursor.fetchone()
        return {
            "sessions": row[0] if row else 0,
            "successes": row[1] or 0 if row else 0,
            "fails": row[2] or 0 if row else 0,
            "total_chars": row[3] or 0 if row else 0,
            "total_duration_ms": row[4] or 0 if row else 0,
            "avg_duration_ms": round(row[5]) if row and row[5] else 0,
        }


async def _compute_streak() -> int:
    """Compute the current streak: consecutive calendar days with at least
    one completed session, going backwards from today.

    Returns:
        Number of consecutive days (>= 0).
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            """SELECT DISTINCT DATE(created_at, 'localtime') AS day
            FROM history WHERE status = 'completed'
            ORDER BY day DESC"""
        )
        rows = await cursor.fetchall()

    if not rows:
        return 0

    active_days = {r[0] for r in rows}
    today = datetime.now().strftime("%Y-%m-%d")
    streak = 0
    current = today

    while current in active_days:
        streak += 1
        dt = datetime.strptime(current, "%Y-%m-%d") - timedelta(days=1)
        current = dt.strftime("%Y-%m-%d")

    return streak


async def _find_best_hour() -> int | None:
    """Find the hour of day (0-23) with the most completed sessions.

    Returns:
        The hour number, or ``None`` if no sessions exist.
    """
    db_path = get_db_path()
    async with sqlite_async.connect(db_path) as db:
        cursor = await db.execute(
            """SELECT CAST(strftime('%H', created_at, 'localtime') AS INTEGER) AS hour,
                    COUNT(*) AS cnt
            FROM history WHERE status = 'completed'
            GROUP BY hour ORDER BY cnt DESC LIMIT 1"""
        )
        row = await cursor.fetchone()
        return row[0] if row else None


async def compute_insights() -> dict:
    """Compute all dashboard insights.

    Returns a dict with:
    - ``current``: stats for the last 7 days
    - ``previous``: stats for the 7 days before that
    - ``streak``: current consecutive-day streak
    - ``best_hour``: most productive hour (0-23) or None
    - ``time_saved_seconds``: estimated typing time saved
    - ``comparison``: dict with trends (up/down/flat)
    - ``summary``: a short natural-language summary string
    """
    current = await _query_period_stats(7)
    previous = await _query_period_stats(14)  # days 8-14 ago

    # Subtract current from previous 14-day stats to get days 8-14
    prev_7 = {
        "sessions": previous["sessions"] - current["sessions"],
        "successes": previous["successes"] - current["successes"],
        "fails": previous["fails"] - current["fails"],
        "total_chars": previous["total_chars"] - current["total_chars"],
        "total_duration_ms": previous["total_duration_ms"] - current["total_duration_ms"],
    }

    # Clamp negative values (edge case for very first week)
    for k in prev_7:
        prev_7[k] = max(prev_7[k], 0)

    streak = await _compute_streak()
    best_hour = await _find_best_hour()

    # Time saved estimate
    total_words = current["total_chars"] / AVG_WORD_LENGTH if current["total_chars"] else 0
    typing_time_seconds = total_words / TYPING_WPM * 60 if total_words else 0
    actual_time_seconds = current["total_duration_ms"] / 1000
    time_saved_seconds = round(max(0, typing_time_seconds - actual_time_seconds))

    # Trend arrows
    comparison = _compute_comparison(current, prev_7)

    # Natural language summary
    summary = _generate_summary(current, streak, best_hour, comparison, time_saved_seconds)

    return {
        "current": current,
        "previous": prev_7,
        "streak": streak,
        "best_hour": best_hour,
        "time_saved_seconds": time_saved_seconds,
        "comparison": comparison,
        "summary": summary,
    }


def _compute_comparison(current: dict, previous: dict) -> dict:
    """Compute trends between current and previous periods.

    Returns a dict with change percentages and direction strings
    for sessions, chars, and success rate.
    """

    def _pct(a: int | float, b: int | float) -> float:
        if b == 0:
            return 100.0 if a > 0 else 0.0
        return round((a - b) / b * 100, 1)

    sessions_pct = _pct(current["sessions"], previous["sessions"])
    chars_pct = _pct(current["total_chars"], previous["total_chars"])

    prev_success_rate = round(previous["successes"] / previous["sessions"] * 100, 1) if previous["sessions"] > 0 else 0
    curr_success_rate = round(current["successes"] / current["sessions"] * 100, 1) if current["sessions"] > 0 else 0

    return {
        "sessions_pct": sessions_pct,
        "chars_pct": chars_pct,
        "success_rate_before": prev_success_rate,
        "success_rate_now": curr_success_rate,
        "sessions_trend": "up" if sessions_pct > 5 else ("down" if sessions_pct < -5 else "flat"),
        "chars_trend": "up" if chars_pct > 5 else ("down" if chars_pct < -5 else "flat"),
    }


def _generate_summary(
    current: dict,
    streak: int,
    best_hour: int | None,
    comparison: dict,
    time_saved_seconds: int,
) -> str:
    """Generate a short natural-language summary of the user's usage."""
    if current["sessions"] == 0:
        return "还没有听写数据。开始第一次听写来解锁你的使用洞察。"

    parts: list[str] = []

    # Word count
    chars = current["total_chars"]
    words = round(chars / AVG_WORD_LENGTH)
    if chars >= 1000:
        parts.append(f"本周你说了一共 {chars:,} 个字")
    else:
        parts.append(f"本周你说了约 {words} 个词")

    # Trend
    ct = comparison["chars_trend"]
    if ct == "up":
        parts.append(f"比上周多了 {comparison['chars_pct']}%")
    elif ct == "down":
        parts.append(f"比上周少了 {abs(comparison['chars_pct'])}%")

    # Streak
    if streak >= 3:
        parts.append(f"已连续使用 {streak} 天")

    # Time saved
    if time_saved_seconds >= 60:
        minutes = round(time_saved_seconds / 60)
        parts.append(f"约省了 {minutes} 分钟打字时间")

    # Best hour
    if best_hour is not None and current["sessions"] >= 5:
        parts.append(f"最常用时段是 {best_hour}:00 左右")

    # Success rate
    sr = comparison["success_rate_now"]
    if sr >= 90:
        parts.append("听写成功率很高")
    elif sr < 50 and current["sessions"] >= 3:
        parts.append("成功率偏低，可以检查麦克风和 API 配置")

    return "，".join(parts) + "。"
