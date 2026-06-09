"""Tests for the theme configuration API endpoints."""

from pathlib import Path

import pytest
from httpx import AsyncClient

import backend.main as main
from backend.database import init_database


@pytest.fixture(autouse=True)
def _theme_test_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Set up a clean database with theme column and override secret service."""
    monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))

    # Override secret service to avoid keyring interactions
    async def _noop_save(*args, **kwargs) -> bool:
        return False

    async def _noop_load(*args, **kwargs) -> str | None:
        return None

    monkeypatch.setattr("backend.config_store.save_secret", _noop_save)  # type: ignore[assignment]
    monkeypatch.setattr("backend.config_store.load_secret", _noop_load)  # type: ignore[assignment]

    # Initialize database with all migrations (including theme column)
    import asyncio

    asyncio.run(init_database())

    # Reset global config state for isolation between tests
    main._user_config = None


@pytest.mark.asyncio
async def test_get_theme_default(client: AsyncClient) -> None:
    """GET /config returns theme field defaulting to 'light'."""
    resp = await client.get("/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "theme" in data
    assert data["theme"] == "light"


@pytest.mark.asyncio
async def test_set_theme_persists(client: AsyncClient) -> None:
    """POST /config with theme value persists and GET returns same value."""
    # Set theme to dark
    resp = await client.post("/config", json={"theme": "dark"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme"] == "dark"

    # Verify it persists
    resp2 = await client.get("/config")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["theme"] == "dark"


@pytest.mark.asyncio
async def test_set_theme_system(client: AsyncClient) -> None:
    """POST /config with theme 'system' is accepted."""
    resp = await client.post("/config", json={"theme": "system"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["theme"] == "system"


@pytest.mark.asyncio
async def test_set_invalid_theme_returns_400(client: AsyncClient) -> None:
    """POST /config with invalid theme value returns 400."""
    resp = await client.post("/config", json={"theme": "red"})
    assert resp.status_code == 400
    data = resp.json()
    assert "detail" in data
    assert "Invalid theme" in data["detail"]


@pytest.mark.asyncio
async def test_set_theme_empty_string_returns_400(
    client: AsyncClient,
) -> None:
    """POST /config with empty theme string returns 400."""
    resp = await client.post("/config", json={"theme": ""})
    assert resp.status_code == 400
    data = resp.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_theme_round_trip_light_back_to_dark(client: AsyncClient) -> None:
    """Theme can be toggled between light and dark repeatedly."""
    # Start with light
    resp1 = await client.get("/config")
    assert resp1.json()["theme"] == "light"

    # Switch to dark
    await client.post("/config", json={"theme": "dark"})
    resp2 = await client.get("/config")
    assert resp2.json()["theme"] == "dark"

    # Switch back to light
    await client.post("/config", json={"theme": "light"})
    resp3 = await client.get("/config")
    assert resp3.json()["theme"] == "light"
