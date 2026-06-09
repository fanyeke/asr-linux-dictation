"""Tests for system dependency checking."""


import pytest
from httpx import AsyncClient


@pytest.fixture(autouse=True)
def setup(monkeypatch: pytest.MonkeyPatch) -> None:
    """Disable auth for deps tests."""
    monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "")


class TestSystemDeps:
    """Test GET /system/deps endpoint."""

    @pytest.mark.asyncio
    async def test_deps_returns_list(self, client: AsyncClient) -> None:
        """Returns a list of deps with found status."""
        response = await client.get("/system/deps")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_deps_has_expected_tools(self, client: AsyncClient) -> None:
        """Response includes all expected system tools."""
        response = await client.get("/system/deps")
        data = response.json()
        names = {d["name"] for d in data}
        assert "arecord" in names
        assert "xdotool" in names
        assert "xsel" in names or "xclip" in names
        assert "wtype" in names
        assert "wl-copy" in names

    @pytest.mark.asyncio
    async def test_deps_each_have_found_field(self, client: AsyncClient) -> None:
        """Each dep entry has name and found fields."""
        response = await client.get("/system/deps")
        for dep in response.json():
            assert "name" in dep
            assert "found" in dep
            assert isinstance(dep["found"], bool)
