"""Tests for profile manager."""

from pathlib import Path

import pytest

from backend.database import init_database
from backend.profile_manager import (
    BUILTIN_PROFILES,
    create_profile,
    delete_profile,
    get_active_profile,
    get_profile,
    list_profiles,
    seed_profiles,
    set_active_profile,
    update_profile,
)


class TestProfileManager:
    """Test profile CRUD and seed."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_seed_creates_builtin_profiles(self) -> None:
        """Seed creates the 5 built-in profiles."""
        await seed_profiles()
        profiles = await list_profiles()
        assert len(profiles) == 5

    @pytest.mark.asyncio
    async def test_seed_is_idempotent(self) -> None:
        """Seed doesn't duplicate profiles."""
        await seed_profiles()
        await seed_profiles()
        profiles = await list_profiles()
        assert len(profiles) == 5

    @pytest.mark.asyncio
    async def test_first_profile_is_active_after_seed(self) -> None:
        """After seed, the first profile is active."""
        await seed_profiles()
        active = await get_active_profile()
        assert active is not None
        assert active["name"] == BUILTIN_PROFILES[0]["name"]

    @pytest.mark.asyncio
    async def test_create_profile(self) -> None:
        """Can create a custom profile."""
        p = await create_profile(
            name="Custom",
            prompt_template="Fix this: {text}",
            asr_language="zh",
        )
        assert p["name"] == "Custom"
        assert p["prompt_template"] == "Fix this: {text}"
        assert p["asr_language"] == "zh"
        assert p["builtin"] is False

    @pytest.mark.asyncio
    async def test_get_profile(self) -> None:
        """Can retrieve a profile by id."""
        await seed_profiles()
        p = await get_profile(1)
        assert p is not None
        assert p["name"] == BUILTIN_PROFILES[0]["name"]

    @pytest.mark.asyncio
    async def test_get_profile_not_found(self) -> None:
        """Returns None for non-existent id."""
        p = await get_profile(999)
        assert p is None

    @pytest.mark.asyncio
    async def test_list_profiles(self) -> None:
        """Can list all profiles."""
        await seed_profiles()
        profiles = await list_profiles()
        assert len(profiles) >= 5

    @pytest.mark.asyncio
    async def test_update_profile(self) -> None:
        """Can update a custom profile."""
        p = await create_profile(name="Old", prompt_template="{text}")
        updated = await update_profile(p["id"], name="New", prompt_template="Fix: {text}")
        assert updated is not None
        assert updated["name"] == "New"
        assert updated["prompt_template"] == "Fix: {text}"

    @pytest.mark.asyncio
    async def test_delete_custom_profile(self) -> None:
        """Can delete a custom profile."""
        p = await create_profile(name="Temp", prompt_template="{text}")
        deleted = await delete_profile(p["id"])
        assert deleted is True
        assert await get_profile(p["id"]) is None

    @pytest.mark.asyncio
    async def test_cannot_delete_builtin(self) -> None:
        """Cannot delete a built-in profile."""
        await seed_profiles()
        deleted = await delete_profile(1)
        assert deleted is False

    @pytest.mark.asyncio
    async def test_set_active_profile(self) -> None:
        """Setting a profile active deactivates others."""
        await seed_profiles()
        p1 = await create_profile(name="Custom", prompt_template="{text}")
        await set_active_profile(p1["id"])
        active = await get_active_profile()
        assert active is not None
        assert active["id"] == p1["id"]

        # Reactivate builtin
        await set_active_profile(1)
        active = await get_active_profile()
        assert active["id"] == 1
