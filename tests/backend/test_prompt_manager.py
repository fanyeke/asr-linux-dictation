"""Tests for prompt manager."""

from pathlib import Path

import pytest

from backend.database import init_database
from backend.prompt_manager import (
    create_prompt,
    delete_prompt,
    get_active_prompt,
    get_prompt,
    list_prompts,
    set_active_prompt,
    update_prompt,
)


class TestPromptCRUD:
    """Test prompt CRUD operations."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_create_prompt(self) -> None:
        """Can create a new prompt."""
        prompt = await create_prompt(
            name="Default",
            template="Fix grammar: {text}",
        )
        assert prompt["id"] == 1
        assert prompt["name"] == "Default"
        assert prompt["template"] == "Fix grammar: {text}"
        assert prompt["is_active"] is False

    @pytest.mark.asyncio
    async def test_get_prompt(self) -> None:
        """Can retrieve a prompt by id."""
        created = await create_prompt(name="Test", template="Hello {text}")
        prompt = await get_prompt(created["id"])
        assert prompt is not None
        assert prompt["name"] == "Test"

    @pytest.mark.asyncio
    async def test_get_prompt_not_found(self) -> None:
        """Returns None for non-existent prompt."""
        prompt = await get_prompt(999)
        assert prompt is None

    @pytest.mark.asyncio
    async def test_list_prompts(self) -> None:
        """Can list all prompts."""
        await create_prompt(name="A", template="A")
        await create_prompt(name="B", template="B")
        prompts = await list_prompts()
        assert len(prompts) == 2

    @pytest.mark.asyncio
    async def test_update_prompt(self) -> None:
        """Can update an existing prompt."""
        created = await create_prompt(name="Old", template="Old")
        updated = await update_prompt(
            created["id"],
            name="New",
            template="New template",
        )
        assert updated["name"] == "New"
        assert updated["template"] == "New template"

    @pytest.mark.asyncio
    async def test_delete_prompt(self) -> None:
        """Can delete a prompt."""
        created = await create_prompt(name="ToDelete", template="X")
        result = await delete_prompt(created["id"])
        assert result is True
        prompt = await get_prompt(created["id"])
        assert prompt is None


class TestPromptActive:
    """Test active prompt behavior."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_set_active_prompt(self) -> None:
        """Can mark a prompt as active."""
        p1 = await create_prompt(name="P1", template="T1")
        p2 = await create_prompt(name="P2", template="T2")

        await set_active_prompt(p1["id"])
        active = await get_active_prompt()
        assert active["id"] == p1["id"]

        # Switch active to p2
        await set_active_prompt(p2["id"])
        active = await get_active_prompt()
        assert active["id"] == p2["id"]

        # p1 should no longer be active
        p1_check = await get_prompt(p1["id"])
        assert p1_check["is_active"] is False

    @pytest.mark.asyncio
    async def test_get_active_prompt_none(self) -> None:
        """Returns None when no prompt is active."""
        active = await get_active_prompt()
        assert active is None
