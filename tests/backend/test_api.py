"""Tests for FastAPI backend API routes and token protection."""

from pathlib import Path

import pytest
from httpx import AsyncClient

import backend.main as main
from backend.config_store import UserConfig


class FakeProbeClient:
    """Small async client fake for API connectivity probes."""

    status_code = 200
    response_json: dict | None = {"choices": [{"message": {"content": "ok"}}]}
    response_text = ""
    calls: list[dict] = []

    def __init__(self, *args, **kwargs) -> None:
        self.args = args
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def post(self, url: str, **kwargs):
        import httpx

        self.__class__.calls.append({"url": url, **kwargs})
        if self.__class__.response_json is None:
            return httpx.Response(
                self.__class__.status_code,
                text=self.__class__.response_text,
            )
        return httpx.Response(
            self.__class__.status_code,
            json=self.__class__.response_json,
        )


@pytest.fixture(autouse=True)
def reset_probe_client() -> None:
    """Reset fake probe client state between tests."""
    FakeProbeClient.status_code = 200
    FakeProbeClient.response_json = {"choices": [{"message": {"content": "ok"}}]}
    FakeProbeClient.response_text = ""
    FakeProbeClient.calls = []


class TestHealthRoute:
    """Test health endpoint."""

    @pytest.mark.asyncio
    async def test_health_returns_ok(self, client: AsyncClient) -> None:
        """Health endpoint returns ok without authentication."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestTokenProtection:
    """Test token-based route protection."""

    @pytest.mark.asyncio
    async def test_protected_route_without_token(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Protected routes reject requests without token."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "test-secret-123")
        response = await client.get("/protected")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_protected_route_with_invalid_token(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Protected routes reject requests with invalid token."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "test-secret-123")
        response = await client.get(
            "/protected",
            headers={"x-token": "invalid-token"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_protected_route_with_valid_token(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Protected routes accept requests with valid token."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "test-secret-123")
        response = await client.get(
            "/protected",
            headers={"x-token": "test-secret-123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "authenticated"


class TestLLMKeyProbe:
    """Test OpenAI-compatible LLM connectivity checks."""

    @pytest.mark.asyncio
    async def test_llm_key_probe_uses_openai_authorization_header(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """GET /test-llm-key sends a minimal OpenAI-compatible request."""
        monkeypatch.setattr("httpx.AsyncClient", FakeProbeClient)
        monkeypatch.setattr(main, "_current_llm_api_key", None)
        monkeypatch.setattr(
            main,
            "_user_config",
            UserConfig(
                llm_api_key="llm-secret",
                llm_base_url="https://llm.example.com/v1",
                llm_model="gpt-test",
            ),
        )

        response = await client.get("/test-llm-key")

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["llm_status"] == 200
        assert FakeProbeClient.calls
        call = FakeProbeClient.calls[0]
        assert call["url"] == "https://llm.example.com/v1/chat/completions"
        assert call["headers"]["Authorization"] == "Bearer llm-secret"
        assert "api-key" not in call["headers"]
        assert call["json"]["model"] == "gpt-test"
        assert call["json"]["messages"][0]["role"] == "user"

    @pytest.mark.asyncio
    async def test_llm_key_probe_requires_key(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """GET /test-llm-key returns a clear error when no LLM key is set."""
        monkeypatch.setattr(main, "_current_llm_api_key", None)
        monkeypatch.setattr(main, "_user_config", UserConfig(llm_api_key=None))

        response = await client.get("/test-llm-key")

        assert response.status_code == 400
        assert "No LLM API key configured" in response.text

    @pytest.mark.asyncio
    async def test_llm_key_probe_reports_server_error(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """GET /test-llm-key categorizes provider 5xx errors."""
        FakeProbeClient.status_code = 500
        FakeProbeClient.response_json = None
        FakeProbeClient.response_text = "Internal Server Error"
        monkeypatch.setattr("httpx.AsyncClient", FakeProbeClient)
        monkeypatch.setattr(main, "_current_llm_api_key", None)
        monkeypatch.setattr(
            main,
            "_user_config",
            UserConfig(llm_api_key="llm-secret"),
        )

        response = await client.get("/test-llm-key")

        assert response.status_code == 502
        assert "LLM service error: HTTP 500" in response.text


class TestConfigRoute:
    """Test configuration API endpoints."""

    @pytest.mark.asyncio
    async def test_post_config_saves_asr_language(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        """POST /config persists asr_language to user config."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "")
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        from backend.database import init_database

        await init_database()
        monkeypatch.setattr(main, "_user_config", UserConfig())

        response = await client.post(
            "/config",
            json={"asr_language": "zh"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["asr_language"] == "zh"
        assert data["status"] == "ok"

    @pytest.mark.asyncio
    async def test_get_config_returns_asr_language(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """GET /config includes asr_language in response."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "")
        monkeypatch.setattr(
            main,
            "_user_config",
            UserConfig(asr_language="en"),
        )

        response = await client.get("/config")

        assert response.status_code == 200
        data = response.json()
        assert data["asr_language"] == "en"

    @pytest.mark.asyncio
    async def test_post_config_saves_vad_enabled(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
    ) -> None:
        """POST /config persists vad_enabled to user config."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "")
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        from backend.database import init_database

        await init_database()
        monkeypatch.setattr(main, "_user_config", UserConfig(vad_enabled=True))

        response = await client.post(
            "/config",
            json={"vad_enabled": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["vad_enabled"] is False
        assert data["status"] == "ok"

    @pytest.mark.asyncio
    async def test_get_config_returns_vad_enabled(
        self,
        client: AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """GET /config includes vad_enabled in response."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "")
        monkeypatch.setattr(
            main,
            "_user_config",
            UserConfig(vad_enabled=False),
        )

        response = await client.get("/config")

        assert response.status_code == 200
        data = response.json()
        assert data["vad_enabled"] is False


class TestDashboardStats:
    """Tests for the /dashboard/stats endpoint."""

    @pytest.fixture(autouse=True)
    async def _setup_db(
        self,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Set up a fresh database with sample history records."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "")
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        from backend import sqlite_async
        from backend.database import get_db_path, init_database

        await init_database()
        db_path = get_db_path()
        async with sqlite_async.connect(db_path) as db:
            # Insert records at different times
            records = [
                # Today (simulated by just not setting a past date)
                ("sess-t1", "today text 1", "Today polished 1", "completed", 1500, 600, 800),
                ("sess-t2", "today text 2", "Today polished 2", "completed", 2000, 700, 1100),
                ("sess-t3", "today fail", None, "failed", None, None, None),
                # Yesterday (24h range but not today — subtract >24h)
                ("sess-y1", "yesterday text", "Yesterday polish", "completed", 1800, 650, 1000),
                ("sess-y2", "yesterday fail 2", None, "failed", None, None, None),
                # 5 days ago
                ("sess-w1", "week old text", "Week old polish", "completed", 3000, 1200, 1600),
            ]
            from datetime import datetime, timedelta

            now = datetime.now()
            for _i, (sid, raw, polished, status, timing, asr, polish) in enumerate(records):
                if sid.startswith("sess-y"):
                    # Guarantee yesterday: 36 hours ago
                    ts = now - timedelta(hours=36)
                elif sid.startswith("sess-w"):
                    ts = now - timedelta(days=5)
                else:
                    ts = now

                await db.execute(
                    """INSERT INTO history
                       (session_id, raw_text, polished_text, status, timing_ms, asr_ms, polish_ms, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                   (sid, raw, polished, status, timing, asr, polish, ts.isoformat()),
                )
            await db.commit()

    @pytest.mark.asyncio
    async def test_dashboard_stats_default_range(self, client: AsyncClient) -> None:
        """Default range (today) returns only today's records."""
        response = await client.get("/dashboard/stats")
        assert response.status_code == 200
        data = response.json()

        assert "summary" in data
        assert "timeline" in data
        assert "latency_trend" in data

        # Today: 3 sessions (2 completed, 1 failed)
        assert data["summary"]["total_sessions"] == 3
        assert data["summary"]["success_count"] == 2
        assert data["summary"]["fail_count"] == 1

    @pytest.mark.asyncio
    async def test_dashboard_stats_range_24h(self, client: AsyncClient) -> None:
        """Range 24h includes today and yesterday records."""
        response = await client.get("/dashboard/stats?range=24h")
        assert response.status_code == 200
        data = response.json()

        # 24h: 5 sessions (3 today + 2 yesterday)
        assert data["summary"]["total_sessions"] == 5

    @pytest.mark.asyncio
    async def test_dashboard_stats_range_7d(self, client: AsyncClient) -> None:
        """Range 7d includes all recent records."""
        response = await client.get("/dashboard/stats?range=7d")
        assert response.status_code == 200
        data = response.json()

        # 7d: 6 sessions
        assert data["summary"]["total_sessions"] == 6
        assert len(data["timeline"]) == 7  # 7 daily slots

    @pytest.mark.asyncio
    async def test_dashboard_stats_timeline_fills_gaps(self, client: AsyncClient) -> None:
        """Timeline fills empty slots with 0."""
        response = await client.get("/dashboard/stats?range=24h")
        assert response.status_code == 200
        data = response.json()

        # 24h timeline should have 24 hourly slots
        assert len(data["timeline"]) == 24
        # Some slots should have 0 count
        zero_slots = [e for e in data["timeline"] if e["count"] == 0]
        assert len(zero_slots) > 0

    @pytest.mark.asyncio
    async def test_dashboard_stats_latency_averages(self, client: AsyncClient) -> None:
        """Latency averages are computed correctly."""
        response = await client.get("/dashboard/stats?range=7d")
        assert response.status_code == 200
        data = response.json()
        summary = data["summary"]

        # ASR avg: (600 + 700 + 650 + 1200) / 4 = 787.5 → 788
        assert summary["avg_asr_ms"] is not None
        assert summary["avg_total_ms"] is not None

    @pytest.mark.asyncio
    async def test_dashboard_stats_invalid_range(self, client: AsyncClient) -> None:
        """Invalid range parameter returns 422."""
        response = await client.get("/dashboard/stats?range=invalid")
        assert response.status_code == 422
