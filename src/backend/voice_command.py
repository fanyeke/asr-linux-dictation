"""Voice command system: match spoken commands to actions.

ASR text → match_command() → if match → execute_command() → result
                             → if no match → None (continue to polish)
"""

from __future__ import annotations

import asyncio
import logging
import subprocess

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Built-in commands
# ---------------------------------------------------------------------------

BUILTIN_COMMANDS: list[dict] = [
    # Navigation
    {
        "keywords": ["换行", "新行"],
        "action_type": "keyboard",
        "action_params": {"keys": "Return"},
        "description": "换行",
        "builtin": True,
    },
    {
        "keywords": ["删除上一句"],
        "action_type": "keyboard_seq",
        "action_params": {"keys": ["ctrl+shift+Left", "BackSpace"]},
        "description": "删除上一句",
        "builtin": True,
    },
    {
        "keywords": ["撤销", "撤回"],
        "action_type": "keyboard",
        "action_params": {"keys": "ctrl+z"},
        "description": "撤销",
        "builtin": True,
    },
    {
        "keywords": ["保存"],
        "action_type": "keyboard",
        "action_params": {"keys": "ctrl+s"},
        "description": "保存",
        "builtin": True,
    },
    # Formatting
    {
        "keywords": ["加粗", "粗体"],
        "action_type": "keyboard",
        "action_params": {"keys": "ctrl+b"},
        "description": "加粗",
        "builtin": True,
    },
    {
        "keywords": ["斜体"],
        "action_type": "keyboard",
        "action_params": {"keys": "ctrl+i"},
        "description": "斜体",
        "builtin": True,
    },
    {
        "keywords": ["下划线"],
        "action_type": "keyboard",
        "action_params": {"keys": "ctrl+u"},
        "description": "下划线",
        "builtin": True,
    },
    # Clipboard
    {
        "keywords": ["复制", "拷贝"],
        "action_type": "keyboard",
        "action_params": {"keys": "ctrl+c"},
        "description": "复制",
        "builtin": True,
    },
    {
        "keywords": ["粘贴"],
        "action_type": "keyboard",
        "action_params": {"keys": "ctrl+v"},
        "description": "粘贴",
        "builtin": True,
    },
    {
        "keywords": ["剪切"],
        "action_type": "keyboard",
        "action_params": {"keys": "ctrl+x"},
        "description": "剪切",
        "builtin": True,
    },
    {
        "keywords": ["全选", "选择全部"],
        "action_type": "keyboard",
        "action_params": {"keys": "ctrl+a"},
        "description": "全选",
        "builtin": True,
    },
    # Launch
    {
        "keywords": ["打开浏览器"],
        "action_type": "launch",
        "action_params": {"cmd": "xdg-open https://"},
        "description": "打开浏览器",
        "builtin": True,
    },
    {
        "keywords": ["打开终端"],
        "action_type": "launch",
        "action_params": {"cmd": "xterm"},
        "description": "打开终端",
        "builtin": True,
    },
]


# ---------------------------------------------------------------------------
# Command matching
# ---------------------------------------------------------------------------


def match_command(text: str, commands: list[dict] | None = None) -> tuple[str | None, dict | None, str]:
    """Check if *text* starts with a known command keyword.

    Args:
        text: The transcribed text to check.
        commands: Command list to match against. Defaults to BUILTIN_COMMANDS.

    Returns:
        A tuple ``(matched_keyword, command_dict, remaining_text)``.
        If no command matches, returns ``(None, None, text)``.
    """
    if commands is None:
        commands = BUILTIN_COMMANDS

    best_match: tuple[str, dict] | None = None
    best_keyword_len = 0

    for cmd in commands:
        if not cmd.get("enabled", True):
            continue
        for keyword in cmd.get("keywords", []):
            if text.startswith(keyword) and len(keyword) > best_keyword_len:
                best_match = (keyword, cmd)
                best_keyword_len = len(keyword)

    if best_match is not None:
        keyword, cmd = best_match
        remaining = text[len(keyword) :].strip()
        return keyword, cmd, remaining

    return None, None, text


# ---------------------------------------------------------------------------
# Command execution
# ---------------------------------------------------------------------------


async def execute_command(command: dict) -> dict:
    """Execute a voice command action.

    Args:
        command: A command dict with ``action_type`` and ``action_params``.

    Returns:
        A result dict with ``success`` (bool) and ``message`` (str).

    Raises:
        ValueError: If the action type is unknown.
    """
    action_type = command["action_type"]
    params = command.get("action_params", {})

    if action_type not in ("keyboard", "keyboard_seq", "launch"):
        raise ValueError(f"Unknown action_type: {action_type}")

    try:
        if action_type == "keyboard":
            keys = params.get("keys", "")
            await _run_xdotool("key", keys)
            return {"success": True, "message": f"Executed key: {keys}"}

        elif action_type == "keyboard_seq":
            keys_list = params.get("keys", [])
            for k in keys_list:
                await _run_xdotool("key", k)
            return {"success": True, "message": f"Executed key sequence: {' + '.join(keys_list)}"}

        elif action_type == "launch":
            cmd = params.get("cmd", "")
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await proc.wait()
            return {"success": True, "message": f"Launched: {cmd}"}

    except Exception as exc:
        logger.error("command_execution_failed: action_type=%s, error=%s", action_type, str(exc))
        return {"success": False, "message": f"Command failed: {exc}"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _run_xdotool(*args: str) -> subprocess.CompletedProcess:
    """Run ``xdotool`` with given arguments asynchronously.

    Args:
        *args: Arguments to pass to xdotool (e.g. ``"key"``, ``"Return"``).

    Returns:
        A :class:`subprocess.CompletedProcess`.

    Raises:
        RuntimeError: If xdotool is not installed.
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            "xdotool",
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=5.0)
        return subprocess.CompletedProcess(
            ("xdotool", *args),
            proc.returncode or 0,
            stdout,
            stderr,
        )
    except FileNotFoundError as exc:
        raise RuntimeError("xdotool is not installed. Install with: sudo apt-get install xdotool") from exc
    except TimeoutError:
        return subprocess.CompletedProcess(
            ("xdotool", *args),
            124,
            b"",
            b"xdotool timed out",
        )
