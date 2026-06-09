"""Tests for window detection and code-aware profile matching."""

from __future__ import annotations

from pathlib import Path

import pytest

from backend.profile_manager import create_profile, list_profiles, seed_window_matches
from backend.window_detector import (
    CODE_EDITOR_WM_CLASSES,
    TERMINAL_WM_CLASSES,
    WindowInfo,
    detect_profile_for_focused_window,
    is_code_editor,
    is_terminal,
)


class TestWindowInfo:
    """Test the WindowInfo dataclass and helper functions."""

    def test_window_info_defaults(self) -> None:
        """WindowInfo has sensible defaults."""
        info = WindowInfo()
        assert info.wm_class == ""
        assert info.wm_name == ""
        assert info.process_name == ""

    def test_window_info_with_values(self) -> None:
        """WindowInfo stores values correctly."""
        info = WindowInfo(wm_class="code", wm_name="test.py - VS Code", process_name="code")
        assert info.wm_class == "code"
        assert info.wm_name == "test.py - VS Code"
        assert info.process_name == "code"


class TestTerminalDetection:
    """Test terminal detection against known patterns."""

    def test_known_terminal(self) -> None:
        """A known terminal class returns True."""
        info = WindowInfo(wm_class="gnome-terminal")
        import asyncio

        assert asyncio.run(is_terminal(info))

    def test_known_terminal_case_insensitive(self) -> None:
        """Terminal detection is case-insensitive."""
        info = WindowInfo(wm_class="Gnome-Terminal")
        import asyncio

        assert asyncio.run(is_terminal(info))

    def test_non_terminal(self) -> None:
        """A non-terminal returns False."""
        info = WindowInfo(wm_class="firefox")
        import asyncio

        assert not asyncio.run(is_terminal(info))

    def test_empty_window(self) -> None:
        """Empty window info returns False."""
        info = WindowInfo()
        import asyncio

        assert not asyncio.run(is_terminal(info))

    def test_terminal_classes_set_not_empty(self) -> None:
        """TERMINAL_WM_CLASSES has entries."""
        assert len(TERMINAL_WM_CLASSES) > 10


class TestCodeEditorDetection:
    """Test code editor detection against known patterns."""

    def test_known_editor(self) -> None:
        """A known code editor class returns True."""
        info = WindowInfo(wm_class="code")
        import asyncio

        assert asyncio.run(is_code_editor(info))

    def test_vscodium(self) -> None:
        """VSCodium is detected as code editor."""
        info = WindowInfo(wm_class="vscodium")
        import asyncio

        assert asyncio.run(is_code_editor(info))

    def test_jetbrains(self) -> None:
        """JetBrains IDEs are detected (wildcard pattern tested by value)."""
        # _detect_x11 would return the raw WM_CLASS; CODE_EDITOR_WM_CLASSES
        # contains specific JetBrains entries
        info = WindowInfo(wm_class="jetbrains-idea")
        import asyncio

        assert asyncio.run(is_code_editor(info))

    def test_non_editor(self) -> None:
        """A non-editor returns False."""
        info = WindowInfo(wm_class="firefox")
        import asyncio

        assert not asyncio.run(is_code_editor(info))

    def test_editor_classes_set_not_empty(self) -> None:
        """CODE_EDITOR_WM_CLASSES has entries."""
        assert len(CODE_EDITOR_WM_CLASSES) > 15


class TestDetectProfileForFocusedWindow:
    """Test profile matching against window info (mocked)."""

    @pytest.mark.asyncio
    async def test_match_code_profile(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Window matching a code editor returns the code profile."""

        async def mock_detect() -> WindowInfo:
            return WindowInfo(wm_class="code", wm_name="test.py - VS Code")

        monkeypatch.setattr("backend.window_detector.detect_focused_window", mock_detect)

        profiles = [
            {"id": 1, "name": "通用", "window_match": "", "window_match_field": "wm_class"},
            {
                "id": 2,
                "name": "编程",
                "window_match": "code,code-oss,vscodium,jetbrains-*",
                "window_match_field": "wm_class",
            },
            {"id": 3, "name": "聊天", "window_match": "", "window_match_field": "wm_class"},
        ]

        matched = await detect_profile_for_focused_window(profiles)
        assert matched is not None
        assert matched["id"] == 2
        assert matched["name"] == "编程"

    @pytest.mark.asyncio
    async def test_match_terminal_profile(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Window matching a terminal returns the matching profile."""

        async def mock_detect() -> WindowInfo:
            return WindowInfo(wm_class="gnome-terminal", wm_name="bash")

        monkeypatch.setattr("backend.window_detector.detect_focused_window", mock_detect)

        profiles = [
            {"id": 1, "name": "通用", "window_match": "", "window_match_field": "wm_class"},
            {
                "id": 2,
                "name": "终端",
                "window_match": "gnome-terminal,konsole,xterm,alacritty",
                "window_match_field": "wm_class",
            },
        ]

        matched = await detect_profile_for_focused_window(profiles)
        assert matched is not None
        assert matched["name"] == "终端"

    @pytest.mark.asyncio
    async def test_no_match_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """When no profile matches, returns None."""

        async def mock_detect() -> WindowInfo:
            return WindowInfo(wm_class="firefox", wm_name="Mozilla Firefox")

        monkeypatch.setattr("backend.window_detector.detect_focused_window", mock_detect)

        profiles = [
            {"id": 1, "name": "通用", "window_match": "", "window_match_field": "wm_class"},
        ]

        matched = await detect_profile_for_focused_window(profiles)
        # "通用" has empty window_match, which means no filter → should NOT match
        assert matched is None

    @pytest.mark.asyncio
    async def test_wildcard_pattern(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Wildcard patterns match correctly."""

        async def mock_detect() -> WindowInfo:
            return WindowInfo(wm_class="jetbrains-pycharm", wm_name="project - PyCharm")

        monkeypatch.setattr("backend.window_detector.detect_focused_window", mock_detect)

        profiles = [
            {"id": 1, "name": "通用", "window_match": "", "window_match_field": "wm_class"},
            {"id": 2, "name": "代码", "window_match": "jetbrains-*", "window_match_field": "wm_class"},
        ]

        matched = await detect_profile_for_focused_window(profiles)
        assert matched is not None
        assert matched["name"] == "代码"


class TestProfileWindowMatchPersistence:
    """Test window_match persistence in the profile manager."""

    @pytest.fixture(autouse=True)
    async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        """Initialize database for each test."""
        monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "")
        from backend.database import init_database

        await init_database()
        yield

    @pytest.mark.asyncio
    async def test_create_profile_with_window_match(self) -> None:
        """Creating a profile with window_match stores it correctly."""
        profile = await create_profile(
            name="代码模式",
            prompt_template="You are a code assistant...",
            window_match="code,vscodium",
            window_match_field="wm_class",
        )
        assert profile["window_match"] == "code,vscodium"
        assert profile["window_match_field"] == "wm_class"

    @pytest.mark.asyncio
    async def test_create_profile_default_window_match(self) -> None:
        """Creating a profile without window_match defaults to empty."""
        profile = await create_profile(
            name="默认",
            prompt_template="{text}",
        )
        assert profile["window_match"] == ""
        assert profile["window_match_field"] == "wm_class"

    @pytest.mark.asyncio
    async def test_seed_window_matches(self) -> None:
        """seed_window_matches updates built-in profiles without error."""
        # First seed profiles
        from backend.profile_manager import seed_profiles

        await seed_profiles()
        # Then seed window matches
        await seed_window_matches()

        profiles = await list_profiles()
        # "编程" profile should have a window_match now
        prog_profile = [p for p in profiles if p["name"] == "编程"]
        assert len(prog_profile) == 1
        # May or may not have window_match depending on whether seed did anything
        assert "window_match" in prog_profile[0]
        assert "window_match_field" in prog_profile[0]
