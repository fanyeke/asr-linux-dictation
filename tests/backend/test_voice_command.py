"""Tests for the voice command system."""

from __future__ import annotations

import pytest

from backend.voice_command import (
    BUILTIN_COMMANDS,
    execute_command,
    match_command,
)


class TestMatchCommand:
    """Test command matching."""

    def test_match_simple(self) -> None:
        """Simple keyword match at start of text."""
        keyword, cmd, remaining = match_command("换行", BUILTIN_COMMANDS)
        assert keyword == "换行"
        assert cmd is not None
        assert cmd["action_type"] == "keyboard"
        assert remaining == ""

    def test_match_with_remaining_text(self) -> None:
        """Text after matched keyword is returned as remaining."""
        keyword, cmd, remaining = match_command("保存我的工作")
        assert keyword == "保存"
        assert remaining == "我的工作"

    def test_no_match(self) -> None:
        """Text without any command keyword returns None."""
        keyword, cmd, remaining = match_command("今天天气真不错")
        assert keyword is None
        assert cmd is None
        assert remaining == "今天天气真不错"

    def test_longest_keyword_wins(self) -> None:
        """When multiple keywords match, the longest one wins."""
        keyword, cmd, remaining = match_command("删除上一句的内容")
        # "删除上一句" (5 chars) should win over "删除" (2 chars)
        assert keyword == "删除上一句"
        assert cmd is not None
        assert cmd["action_type"] == "keyboard_seq"
        assert remaining == "的内容"

    def test_disabled_commands_skipped(self) -> None:
        """Commands with enabled=False are not matched."""
        disabled = [
            {"keywords": ["测试"], "enabled": False, "action_type": "keyboard", "action_params": {}, "description": ""},
        ]
        keyword, cmd, remaining = match_command("测试命令", disabled)
        assert keyword is None
        assert cmd is None

    def test_keyword_not_at_start(self) -> None:
        """Keyword in the middle of text is not matched."""
        keyword, cmd, remaining = match_command("请换行")
        assert keyword is None  # "换行" is not at the start

    def test_empty_text(self) -> None:
        """Empty text returns no match."""
        keyword, cmd, remaining = match_command("")
        assert keyword is None
        assert cmd is None

    def test_all_keywords_start_with_same_prefix(self) -> None:
        """Multiple keywords sharing a prefix resolve correctly."""
        commands = [
            {
                "keywords": ["打开"],
                "action_type": "launch",
                "action_params": {"cmd": "default"},
                "description": "",
                "builtin": True,
            },
            {
                "keywords": ["打开浏览器"],
                "action_type": "launch",
                "action_params": {"cmd": "browser"},
                "description": "",
                "builtin": True,
            },
        ]
        keyword, cmd, remaining = match_command("打开浏览器", commands)
        assert keyword == "打开浏览器"
        assert cmd["action_params"]["cmd"] == "browser"

    def test_partial_keyword_match_does_not_fire(self) -> None:
        """Text that partially matches a keyword (but doesn't start with it) does not trigger."""
        keyword, cmd, remaining = match_command("新买的手机")
        assert keyword is None  # "新" is not a keyword, "新行" is not a prefix


class TestExecuteCommand:
    """Test command execution (mocked)."""

    @pytest.mark.asyncio
    async def test_keyboard_action_with_mock(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Keyboard command calls xdotool with correct keys."""
        from backend import voice_command

        call_args: list[tuple] = []

        async def mock_run_xdotool(*args: str):
            call_args.append(args)
            from subprocess import CompletedProcess

            return CompletedProcess(("xdotool", *args), 0, b"", b"")

        monkeypatch.setattr(voice_command, "_run_xdotool", mock_run_xdotool)

        result = await execute_command(
            {
                "action_type": "keyboard",
                "action_params": {"keys": "ctrl+s"},
            }
        )

        assert result["success"] is True
        assert call_args == [("key", "ctrl+s")]

    @pytest.mark.asyncio
    async def test_keyboard_seq_action(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Keyboard sequence sends multiple keys in order."""
        from backend import voice_command

        call_args: list[tuple] = []

        async def mock_run_xdotool(*args: str):
            call_args.append(args)
            from subprocess import CompletedProcess

            return CompletedProcess(("xdotool", *args), 0, b"", b"")

        monkeypatch.setattr(voice_command, "_run_xdotool", mock_run_xdotool)

        result = await execute_command(
            {
                "action_type": "keyboard_seq",
                "action_params": {"keys": ["ctrl+shift+Left", "BackSpace"]},
            }
        )

        assert result["success"] is True
        assert len(call_args) == 2
        assert call_args[0] == ("key", "ctrl+shift+Left")
        assert call_args[1] == ("key", "BackSpace")

    @pytest.mark.asyncio
    async def test_unknown_action_type(self) -> None:
        """Unknown action type raises ValueError."""
        with pytest.raises(ValueError, match="unknown_type"):
            await execute_command(
                {
                    "action_type": "unknown_type",
                    "action_params": {},
                }
            )

    @pytest.mark.asyncio
    async def test_xdotool_not_found_handled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """RuntimeError from xdotool is caught and returned as failed result."""
        from backend import voice_command

        async def mock_run(*args: str):
            raise RuntimeError("xdotool not found")

        monkeypatch.setattr(voice_command, "_run_xdotool", mock_run)

        result = await execute_command(
            {
                "action_type": "keyboard",
                "action_params": {"keys": "Return"},
            }
        )

        assert result["success"] is False
        assert "xdotool" in result["message"]

    @pytest.mark.asyncio
    async def test_shell_action_success(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Shell command that succeeds returns success and stdout."""
        import asyncio

        async def mock_create_subprocess_shell(*args, **kwargs):
            proc = await asyncio.create_subprocess_exec(
                "echo",
                "hello",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            return proc

        monkeypatch.setattr("asyncio.create_subprocess_shell", mock_create_subprocess_shell)

        result = await execute_command(
            {
                "action_type": "shell",
                "action_params": {"command": "echo hello", "timeout": 5},
            }
        )

        assert result["success"] is True
        assert "Shell command succeeded" in result["message"]

    @pytest.mark.asyncio
    async def test_shell_action_empty_command(self) -> None:
        """Shell command with empty command returns failure."""
        result = await execute_command(
            {
                "action_type": "shell",
                "action_params": {},
            }
        )
        assert result["success"] is False
        assert "empty" in result["message"]

    @pytest.mark.asyncio
    async def test_http_action_missing_url(self) -> None:
        """HTTP action without url returns failure."""
        result = await execute_command(
            {
                "action_type": "http",
                "action_params": {"method": "GET"},
            }
        )
        assert result["success"] is False
        assert "URL" in result["message"]
