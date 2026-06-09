"""Tests for voice shortcuts CRUD operations."""

from __future__ import annotations

from pathlib import Path

import pytest

from backend.database import init_database
from backend.voice_shortcuts import (
    create_shortcut,
    delete_shortcut,
    get_shortcut,
    list_shortcuts,
    load_user_commands,
    update_shortcut,
)


class TestVoiceShortcuts:
    """Test user-defined voice shortcuts CRUD."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_create_shortcut(self) -> None:
        """Create a shell shortcut and verify fields."""
        shortcut = await create_shortcut(
            keywords=["提交代码"],
            action_type="shell",
            action_params={"command": "git add -A && git commit -m wip && git push"},
            description="一键提交代码",
        )
        assert shortcut["id"] > 0
        assert shortcut["keywords"] == ["提交代码"]
        assert shortcut["action_type"] == "shell"
        assert shortcut["action_params"]["command"] == "git add -A && git commit -m wip && git push"
        assert shortcut["description"] == "一键提交代码"
        assert shortcut["enabled"] is True

    @pytest.mark.asyncio
    async def test_create_http_shortcut(self) -> None:
        """Create an HTTP shortcut."""
        shortcut = await create_shortcut(
            keywords=["开始番茄钟"],
            action_type="http",
            action_params={
                "method": "POST",
                "url": "http://localhost:8080/pomodoro/start",
                "headers": {"Content-Type": "application/json"},
                "body": {"duration": 25},
            },
            description="启动番茄钟",
        )
        assert shortcut["action_type"] == "http"
        assert shortcut["action_params"]["method"] == "POST"
        assert shortcut["action_params"]["url"] == "http://localhost:8080/pomodoro/start"

    @pytest.mark.asyncio
    async def test_create_shortcut_empty_keywords_fails(self) -> None:
        """Creating a shortcut with no keywords should raise ValueError."""
        with pytest.raises(ValueError, match="At least one keyword"):
            await create_shortcut(keywords=[], action_type="shell")

    @pytest.mark.asyncio
    async def test_create_shortcut_invalid_action_type(self) -> None:
        """Creating a shortcut with unknown action_type should raise ValueError."""
        with pytest.raises(ValueError, match="Unknown action_type"):
            await create_shortcut(keywords=["test"], action_type="invalid_type")

    @pytest.mark.asyncio
    async def test_list_shortcuts(self) -> None:
        """List returns all user shortcuts."""
        await create_shortcut(keywords=["cmd1"], action_type="shell", action_params={"command": "echo 1"})
        await create_shortcut(keywords=["cmd2"], action_type="shell", action_params={"command": "echo 2"})
        shortcuts = await list_shortcuts()
        assert len(shortcuts) == 2

    @pytest.mark.asyncio
    async def test_get_shortcut(self) -> None:
        """Get a shortcut by id."""
        created = await create_shortcut(keywords=["test"], action_type="shell", action_params={"command": "echo hello"})
        fetched = await get_shortcut(created["id"])
        assert fetched is not None
        assert fetched["keywords"] == ["test"]

    @pytest.mark.asyncio
    async def test_get_shortcut_not_found(self) -> None:
        """Getting a non-existent shortcut returns None."""
        assert await get_shortcut(9999) is None

    @pytest.mark.asyncio
    async def test_update_shortcut(self) -> None:
        """Update keywords and enable status."""
        created = await create_shortcut(keywords=["old"], action_type="shell", action_params={"command": "echo old"})
        updated = await update_shortcut(
            created["id"],
            keywords=["new", "更新"],
            enabled=False,
        )
        assert updated is not None
        assert updated["keywords"] == ["new", "更新"]
        assert updated["enabled"] is False

    @pytest.mark.asyncio
    async def test_update_shortcut_not_found(self) -> None:
        """Updating a non-existent shortcut returns None."""
        result = await update_shortcut(9999, enabled=False)
        assert result is None

    @pytest.mark.asyncio
    async def test_update_shortcut_invalid_action_type(self) -> None:
        """Updating with an invalid action_type raises ValueError."""
        created = await create_shortcut(keywords=["test"], action_type="shell", action_params={"command": "echo x"})
        with pytest.raises(ValueError, match="Unknown action_type"):
            await update_shortcut(created["id"], action_type="invalid_type")

    @pytest.mark.asyncio
    async def test_delete_shortcut(self) -> None:
        """Delete a shortcut returns True and it's no longer listed."""
        created = await create_shortcut(
            keywords=["delete-me"], action_type="shell", action_params={"command": "echo bye"}
        )
        assert await delete_shortcut(created["id"]) is True
        assert await list_shortcuts() == []

    @pytest.mark.asyncio
    async def test_delete_shortcut_not_found(self) -> None:
        """Deleting a non-existent shortcut returns False."""
        assert await delete_shortcut(9999) is False

    @pytest.mark.asyncio
    async def test_load_user_commands(self) -> None:
        """load_user_commands returns command dicts compatible with voice_command."""
        await create_shortcut(
            keywords=["测试命令"],
            action_type="shell",
            action_params={"command": "echo hello"},
        )
        commands = await load_user_commands()
        assert len(commands) == 1
        cmd = commands[0]
        assert cmd["keywords"] == ["测试命令"]
        assert cmd["action_type"] == "shell"
        assert cmd["action_params"]["command"] == "echo hello"
        assert cmd["builtin"] is False
        assert cmd["enabled"] is True

    @pytest.mark.asyncio
    async def test_load_user_commands_only_enabled(self) -> None:
        """Disabled shortcuts are excluded from load_user_commands."""
        await create_shortcut(keywords=["enabled"], action_type="shell", action_params={"command": "echo 1"})
        s2 = await create_shortcut(keywords=["disabled"], action_type="shell", action_params={"command": "echo 2"})
        await update_shortcut(s2["id"], enabled=False)

        commands = await load_user_commands()
        assert len(commands) == 1  # only the enabled one
        assert commands[0]["keywords"] == ["enabled"]

    @pytest.mark.asyncio
    async def test_list_all_builtin_excluded(self) -> None:
        """list_shortcuts only returns user (builtin=0) shortcuts."""
        shortcuts = await list_shortcuts()
        # No builtin commands should be returned
        for s in shortcuts:
            assert s.get("builtin") is not True
