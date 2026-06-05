"""Tests for TextInjector - X11 clipboard injection."""

import sys
from collections.abc import Callable
from typing import Any

import pytest

from backend import text_injector
from backend.text_injector import TEXT_INJECTOR_TERMINALS, TextInjector


@pytest.mark.asyncio
async def test_run_command_times_out(monkeypatch: pytest.MonkeyPatch) -> None:
    """Desktop helper commands cannot hang the dictation pipeline indefinitely."""
    monkeypatch.setattr(text_injector, "DESKTOP_COMMAND_TIMEOUT_SECONDS", 0.05)

    result = await text_injector._run_command(
        sys.executable,
        "-c",
        "import time; time.sleep(5)",
    )

    assert result.returncode == 124
    assert b"timed out" in result.stderr


class TestTextInjector:
    """Test the TextInjector class."""

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @pytest.fixture
    def injector(self) -> TextInjector:
        """Return a fresh TextInjector instance."""
        return TextInjector()

    @staticmethod
    def _mock_method(
        monkeypatch: pytest.MonkeyPatch,
        method: str,
        impl: Callable[..., Any],
    ) -> None:
        """Replace a method on TextInjector with a mock implementation.

        The mock is placed on the *class* so that ``self`` is automatically
        passed as the first argument (normal method dispatch).
        """
        monkeypatch.setattr(TextInjector, method, impl)

    @staticmethod
    def _mock_clipboard(
        monkeypatch: pytest.MonkeyPatch,
        injector: TextInjector,
        *,
        save_return: str | None = "original clipboard",
    ) -> dict[str, list[Any]]:
        """Mock ClipboardManager methods on the injector instance.

        Returns a dict with keys ``"save"``, ``"set"``, ``"restore"``
        for call tracking.
        """
        calls: dict[str, list[Any]] = {"save": [], "set": [], "restore": []}

        async def _save() -> str | None:
            calls["save"].append(True)
            return save_return

        async def _set(text: str) -> bool:
            calls["set"].append(text)
            return True

        async def _set_for_paste(text: str) -> bool:
            calls["set"].append(text)
            return True

        async def _restore() -> None:
            calls["restore"].append(True)

        monkeypatch.setattr(injector._clipboard_manager, "save", _save)
        monkeypatch.setattr(injector._clipboard_manager, "set_clipboard", _set)
        monkeypatch.setattr(
            injector._clipboard_manager,
            "set_clipboard_for_paste",
            _set_for_paste,
            raising=False,
        )
        monkeypatch.setattr(injector._clipboard_manager, "restore", _restore)

        return calls

    # ------------------------------------------------------------------
    # Happy path – normal window (clipboard paste is now primary)
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_inject_normal_window(self, injector: TextInjector,
                                        monkeypatch: pytest.MonkeyPatch) -> None:
        """Successful clipboard-paste into a normal (non-terminal) window.

        Verifies:
        - Text is set on clipboard
        - Active window is queried twice (focus check)
        - ``ctrl+v`` is used (not terminal variant)
        - Clipboard is left as the injected text after successful paste
        """
        calls: dict[str, list[Any]] = {
            "save": [],
            "set": [],
            "get_active": [],
            "is_terminal": [],
            "paste": [],
            "restore": [],
        }

        async def _get_active(self: TextInjector) -> str | None:
            calls["get_active"].append("called")
            return "12345"

        async def _is_terminal(  # type: ignore[func-returns-value]
            self: TextInjector, window_id: str,
        ) -> bool:
            calls["is_terminal"].append(window_id)
            return False

        async def _paste(  # type: ignore[func-returns-value]
            self: TextInjector, window_id: str, is_terminal: bool,
        ) -> bool:
            calls["paste"].append((window_id, is_terminal))
            return True

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)

        clip_calls = self._mock_clipboard(monkeypatch, injector)

        result = await injector.inject("hello world")

        assert result.success is True
        assert result.method == "paste"
        assert result.clipboard_saved is False
        assert result.error is None

        assert clip_calls["save"] == []
        assert clip_calls["set"] == ["hello world"]
        # Two getactivewindow calls: before and after focus check
        assert len(calls["get_active"]) == 2
        assert calls["is_terminal"] == ["12345"]
        assert calls["paste"] == [("12345", False)]
        assert clip_calls["restore"] == []

    @pytest.mark.asyncio
    async def test_inject_uses_clipboard_set_before_paste(
        self,
        injector: TextInjector,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Injection waits for clipboard visibility before pressing paste."""
        calls: list[str] = []

        async def _get_active(self: TextInjector) -> str | None:
            calls.append("get_active")
            return "12345"

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            calls.append("is_terminal")
            return False

        async def _set_clipboard_for_paste(text: str) -> bool:
            calls.append(f"set:{text}")
            return True

        async def _paste(
            self: TextInjector,
            window_id: str,
            is_terminal: bool,
        ) -> bool:
            calls.append(f"paste:{window_id}:{is_terminal}")
            return True

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)
        self._mock_clipboard(monkeypatch, injector)
        monkeypatch.setattr(
            injector._clipboard_manager,
            "set_clipboard_for_paste",
            _set_clipboard_for_paste,
        )

        result = await injector.inject("hello world")

        assert result.success is True
        assert calls == [
            "get_active",
            "is_terminal",
            "set:hello world",
            "get_active",
            "paste:12345:False",
        ]

    @pytest.mark.asyncio
    async def test_inject_does_not_type_when_paste_fails(
        self,
        injector: TextInjector,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Paste failure leaves text in clipboard instead of using lossy xdotool type."""
        paste_called: list[Any] = []

        async def _get_active(self: TextInjector) -> str | None:
            return "12345"

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            return False

        async def _paste(
            self: TextInjector,
            window_id: str,
            is_terminal: bool,
        ) -> bool:
            paste_called.append((window_id, is_terminal))
            return False

        async def _type(self: TextInjector, window_id: str, text: str) -> bool:
            raise AssertionError("inject() must not use xdotool type")

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)
        self._mock_method(monkeypatch, "_type", _type)
        self._mock_clipboard(monkeypatch, injector)

        result = await injector.inject("new text")

        assert result.success is False
        assert result.method == "clipboard_fallback"
        assert result.error is not None
        assert "paste" in result.error.lower()
        assert paste_called == [("12345", False)]

    # ------------------------------------------------------------------
    # Terminal window – uses ctrl+shift+v
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_inject_terminal_window(self, injector: TextInjector,
                                          monkeypatch: pytest.MonkeyPatch) -> None:
        """Terminal windows receive ``ctrl+shift+v`` instead of ``ctrl+v``."""
        calls: dict[str, list[Any]] = {
            "paste": [],
        }

        async def _get_active(self: TextInjector) -> str | None:
            return "99999"

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            return True

        async def _paste(  # type: ignore[func-returns-value]
            self: TextInjector, window_id: str, is_terminal: bool,
        ) -> bool:
            calls["paste"].append((window_id, is_terminal))
            return True

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)

        self._mock_clipboard(monkeypatch, injector)

        result = await injector.inject("some code")

        assert result.success is True
        assert result.method == "paste"
        assert calls["paste"] == [("99999", True)]

    # ------------------------------------------------------------------
    # Focus lost – clipboard fallback
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_focus_lost_fallback(self, injector: TextInjector,
                                       monkeypatch: pytest.MonkeyPatch) -> None:
        """When the active window changes during injection the
        text is left in the clipboard for the user and no paste
        is attempted.

        In the new clipboard-paste-first flow, focus is checked
        after setting the clipboard and before calling ``_paste``.
        """
        get_active_count: int = 0
        paste_called: list[Any] = []

        async def _get_active(self: TextInjector) -> str | None:
            nonlocal get_active_count
            get_active_count += 1
            # Return different window on second call → focus changed
            return "11111" if get_active_count == 1 else "22222"

        async def _paste(  # type: ignore[func-returns-value]
            self: TextInjector, window_id: str, is_terminal: bool,
        ) -> bool:
            paste_called.append((window_id, is_terminal))
            return True

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            return True  # pragma: no cover

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)

        clip_calls = self._mock_clipboard(monkeypatch, injector)

        result = await injector.inject("fallback text")

        assert result.success is False
        assert result.method == "clipboard_fallback"
        assert result.clipboard_saved is False
        assert result.error is not None
        assert "focus" in result.error.lower()

        # Clipboard was NOT restored – text stays as fallback
        assert clip_calls["restore"] == []
        # Paste was NOT attempted
        assert paste_called == []

    # ------------------------------------------------------------------
    # Clipboard save and restore
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_clipboard_save_restore(self, injector: TextInjector,
                                          monkeypatch: pytest.MonkeyPatch) -> None:
        """Successful paste leaves injected text in the clipboard."""
        saved_content = "important data"

        async def _get_active(self: TextInjector) -> str | None:
            return "window-1"

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            return False

        async def _paste(  # type: ignore[func-returns-value]
            self: TextInjector, window_id: str, is_terminal: bool,
        ) -> bool:
            return True

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)

        clip_calls = self._mock_clipboard(
            monkeypatch, injector, save_return=saved_content,
        )

        result = await injector.inject("text")

        assert result.success is True
        assert result.clipboard_saved is False
        assert clip_calls["restore"] == []
        assert clip_calls["save"] == []

    # ------------------------------------------------------------------
    # Injection failure (paste command fails)
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_inject_failure(self, injector: TextInjector,
                                  monkeypatch: pytest.MonkeyPatch) -> None:
        """When clipboard paste fails, the result
        indicates failure and the injected text stays in the clipboard.
        """
        async def _get_active(self: TextInjector) -> str | None:
            return "w1"

        async def _type(self: TextInjector, window_id: str, text: str) -> bool:
            return False

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            return False

        async def _paste(  # type: ignore[func-returns-value]
            self: TextInjector, window_id: str, is_terminal: bool,
        ) -> bool:
            return False

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_type", _type)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)

        clip_calls = self._mock_clipboard(monkeypatch, injector)

        result = await injector.inject("fail text")

        assert result.success is False
        assert result.method == "clipboard_fallback"
        assert result.clipboard_saved is False
        assert result.error is not None
        assert "paste" in result.error.lower()

        # Clipboard was NOT restored (text stays as fallback for user)
        assert clip_calls["restore"] == []

    # ------------------------------------------------------------------
    # Paste failure – no xdotool type fallback
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_no_type_fallback_when_paste_fails(self, injector: TextInjector,
                                                     monkeypatch: pytest.MonkeyPatch) -> None:
        """When clipboard paste fails, text stays in the clipboard for manual paste."""
        paste_called: list[Any] = []
        type_called: list[Any] = []

        async def _get_active(self: TextInjector) -> str | None:
            return "w1"

        async def _type(self: TextInjector, window_id: str, text: str) -> bool:
            type_called.append((window_id, text))
            raise AssertionError("inject() must not use xdotool type")

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            return False

        async def _paste(  # type: ignore[func-returns-value]
            self: TextInjector, window_id: str, is_terminal: bool,
        ) -> bool:
            paste_called.append((window_id, is_terminal))
            return False

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_type", _type)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)

        clip_calls = self._mock_clipboard(monkeypatch, injector)

        result = await injector.inject("fallback typed text")

        assert result.success is False
        assert result.method == "clipboard_fallback"
        assert result.clipboard_saved is False

        # Paste was attempted first
        assert paste_called == [("w1", False)]
        assert type_called == []
        assert clip_calls["restore"] == []

    # ------------------------------------------------------------------
    # Empty clipboard save
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_empty_clipboard_save(self, injector: TextInjector,
                                        monkeypatch: pytest.MonkeyPatch) -> None:
        """The injector does not depend on saving the previous clipboard."""
        async def _get_active(self: TextInjector) -> str | None:
            return "w1"

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            return False

        async def _paste(  # type: ignore[func-returns-value]
            self: TextInjector, window_id: str, is_terminal: bool,
        ) -> bool:
            return True

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)

        clip_calls = self._mock_clipboard(
            monkeypatch, injector, save_return=None,
        )

        result = await injector.inject("text after empty clipboard")

        assert result.success is True
        assert result.clipboard_saved is False
        assert clip_calls["save"] == []
        assert clip_calls["restore"] == []

    # ------------------------------------------------------------------
    # Terminal detection
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_terminal_detection(self) -> None:
        """The terminal identifier set matches the expected list."""
        expected = {
            "gnome-terminal",
            "konsole",
            "xterm",
            "rxvt",
            "alacritty",
            "kitty",
            "terminator",
            "tilix",
            "st",
            "lxterminal",
            "qterminal",
            "mate-terminal",
            "xfce4-terminal",
            "deepin-terminal",
            "hyper",
        }
        assert expected == TEXT_INJECTOR_TERMINALS

    @pytest.mark.asyncio
    async def test_is_terminal_matches(self, injector: TextInjector,
                                       monkeypatch: pytest.MonkeyPatch) -> None:
        """``_is_terminal`` returns ``True`` for known terminal
        WM_CLASS values parsed from ``xprop`` output.
        """
        _run_called: list[tuple[Any, ...]] = []

        async def _run_mock(*args: str,  # type: ignore[func-returns-value]
                            input_data: bytes | None = None) -> Any:
            _run_called.append(args)
            # Simulate xprop output:  WM_CLASS(STRING) = "gnome-terminal", "Gnome-terminal"
            from subprocess import CompletedProcess
            return CompletedProcess(
                args, 0,
                b'WM_CLASS(STRING) = "gnome-terminal", "Gnome-terminal"\n',
                b"",
            )

        monkeypatch.setattr(
            "backend.text_injector._run_command", _run_mock,
        )

        is_term = await injector._is_terminal("500")  # noqa: SLF001
        assert is_term is True
        assert _run_called == [("xprop", "-id", "500", "WM_CLASS")]

    @pytest.mark.asyncio
    async def test_is_terminal_non_terminal(self, injector: TextInjector,
                                            monkeypatch: pytest.MonkeyPatch) -> None:
        """``_is_terminal`` returns ``False`` for non-terminal
        windows.
        """
        async def _run_mock(*args: str,  # type: ignore[func-returns-value]
                            input_data: bytes | None = None) -> Any:
            from subprocess import CompletedProcess
            return CompletedProcess(
                args, 0,
                b'WM_CLASS(STRING) = "google-chrome", "Google-chrome"\n',
                b"",
            )

        monkeypatch.setattr(
            "backend.text_injector._run_command", _run_mock,
        )

        is_term = await injector._is_terminal("500")  # noqa: SLF001
        assert is_term is False

    @pytest.mark.asyncio
    async def test_is_terminal_failed_xprop(self, injector: TextInjector,
                                            monkeypatch: pytest.MonkeyPatch) -> None:
        """``_is_terminal`` returns ``False`` when xprop fails."""
        async def _run_mock(*args: str,  # type: ignore[func-returns-value]
                            input_data: bytes | None = None) -> Any:
            from subprocess import CompletedProcess
            return CompletedProcess(args, 1, b"", b"error")

        monkeypatch.setattr(
            "backend.text_injector._run_command", _run_mock,
        )

        is_term = await injector._is_terminal("500")  # noqa: SLF001
        assert is_term is False

    # ------------------------------------------------------------------
    # No focused window
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_focus_window_not_found(self, injector: TextInjector,
                                          monkeypatch: pytest.MonkeyPatch) -> None:
        """When no window is focused, injection fails early without
        modifying the clipboard.
        """
        async def _get_active(self: TextInjector) -> str | None:
            return None

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        # Should never reach these
        self._mock_method(monkeypatch, "_is_terminal",
                          lambda self, w: True)  # pragma: no cover
        self._mock_method(monkeypatch, "_paste",
                          lambda self, w, t: True)  # pragma: no cover

        clip_calls = self._mock_clipboard(monkeypatch, injector)

        result = await injector.inject("no window")

        assert result.success is False
        assert result.method == "failed"
        assert result.clipboard_saved is False
        assert result.error is not None
        assert "window" in result.error.lower()

        # Clipboard was not touched.
        assert clip_calls["save"] == []
        assert clip_calls["set"] == []
        assert clip_calls["restore"] == []
