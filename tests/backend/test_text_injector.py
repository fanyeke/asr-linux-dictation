"""Tests for TextInjector - X11 clipboard injection."""

import sys
from collections.abc import Callable
from typing import Any

import pytest

from backend import text_injector
from backend.text_injector import TEXT_INJECTOR_TERMINALS, TextInjector

pytestmark = pytest.mark.asyncio


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
    def _mock_inject_with_fallback(
        monkeypatch: pytest.MonkeyPatch,
        injector: TextInjector,
        *,
        success: bool = True,
        method: str = "paste",
        clipboard_saved: bool = True,
    ) -> dict[str, list[Any]]:
        """Mock ClipboardManager.inject_with_fallback on injector instance.

        Returns a dict with key ``"inject_with_fallback"`` for call tracking.
        """
        calls: dict[str, list[Any]] = {"inject_with_fallback": []}

        async def _mock(text: str, inject_func: Callable) -> dict:
            calls["inject_with_fallback"].append((text, inject_func))
            return {"success": success, "method": method, "clipboard_saved": clipboard_saved}

        monkeypatch.setattr(
            injector._clipboard_manager, "inject_with_fallback", _mock,
        )
        return calls

    def _mock_paste_env(
        self,
        monkeypatch: pytest.MonkeyPatch,
        injector: TextInjector,
        *,
        window_id: str = "12345",
        is_terminal: bool = False,
        paste_success: bool = True,
        clipboard_set_success: bool = True,
    ) -> dict[str, list[Any]]:
        """Set up mocks for window detection, terminal check, clipboard, and paste.

        Also mocks ``inject_with_fallback`` to call the inner ``inject_func``
        so we can test the full flow end-to-end.
        """
        calls: dict[str, list[Any]] = {
            "get_active": [],
            "is_terminal": [],
            "set_clipboard_for_paste": [],
            "paste": [],
        }

        async def _get_active(self: TextInjector) -> str | None:
            calls["get_active"].append("called")
            return window_id

        async def _is_terminal(self: TextInjector, wid: str) -> bool:
            calls["is_terminal"].append(wid)
            return is_terminal

        async def _set_clipboard_for_paste(text: str) -> bool:
            calls["set_clipboard_for_paste"].append(text)
            return clipboard_set_success

        async def _paste(self: TextInjector, wid: str, term: bool) -> bool:
            calls["paste"].append((wid, term))
            return paste_success

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)
        monkeypatch.setattr(
            injector._clipboard_manager,
            "set_clipboard_for_paste",
            _set_clipboard_for_paste,
        )

        # Mock inject_with_fallback to call the inner function and return
        # a realistic result, since the real implementation requires a
        # clipboard tool (xsel/xclip) that may not be available in CI.
        async def _mock_fallback(text: str, inject_func) -> dict:
            try:
                await inject_func(text)
                return {"success": True, "method": "paste", "clipboard_saved": True}
            except RuntimeError:
                return {
                    "success": False,
                    "method": "clipboard_fallback",
                    "clipboard_saved": True,
                }

        monkeypatch.setattr(
            injector._clipboard_manager,
            "inject_with_fallback",
            _mock_fallback,
        )

        return calls

    # ------------------------------------------------------------------
    # Happy path – normal window (refactored to use inject_with_fallback)
    # ------------------------------------------------------------------

    async def test_inject_normal_window(self, injector: TextInjector,
                                        monkeypatch: pytest.MonkeyPatch) -> None:
        """Successful clipboard-paste into a normal (non-terminal) window.

        Verifies:
        - inject_with_fallback is called with the text
        - Result is translated from dict to InjectionResult
        ``_prepare_and_paste`` logic is exercised inside inject_with_fallback.
        """
        paste_calls = self._mock_paste_env(monkeypatch, injector)

        result = await injector.inject("hello world")

        assert result.success is True
        assert result.method == "paste"
        assert result.clipboard_saved is True
        assert result.error is None

        # inject_with_fallback was invoked (we can check via its side effects)
        assert len(paste_calls["get_active"]) == 2  # before + after clipboard set
        assert paste_calls["is_terminal"] == ["12345"]
        assert paste_calls["set_clipboard_for_paste"] == ["hello world"]
        assert paste_calls["paste"] == [("12345", False)]

    async def test_inject_uses_clipboard_set_before_paste(
        self,
        injector: TextInjector,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Injection waits for clipboard visibility before pressing paste."""
        order: list[str] = []

        async def _get_active(self: TextInjector) -> str | None:
            order.append("get_active")
            return "12345"

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            order.append("is_terminal")
            return False

        async def _set_cb(text: str) -> bool:
            order.append(f"set:{text}")
            return True

        async def _paste(self: TextInjector, window_id: str, is_terminal: bool) -> bool:
            order.append(f"paste:{window_id}:{is_terminal}")
            return True

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)
        monkeypatch.setattr(
            injector._clipboard_manager,
            "set_clipboard_for_paste",
            _set_cb,
        )

        # Mock inject_with_fallback to execute the inject_func inline
        async def _mock_fallback(text: str, inject_func) -> dict:
            await inject_func(text)
            return {"success": True, "method": "paste", "clipboard_saved": True}

        monkeypatch.setattr(
            injector._clipboard_manager, "inject_with_fallback", _mock_fallback,
        )

        result = await injector.inject("hello world")

        assert result.success is True
        assert order == [
            "get_active",
            "is_terminal",
            "set:hello world",
            "get_active",  # focus re-check after clipboard set
            "paste:12345:False",
        ]

    async def test_inject_does_not_type_when_paste_fails(
        self,
        injector: TextInjector,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Paste failure leaves text in clipboard instead of using lossy xdotool type."""
        paste_called: list[Any] = []
        type_called: list[Any] = []

        async def _get_active(self: TextInjector) -> str | None:
            return "12345"

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            return False

        async def _paste(self: TextInjector, window_id: str, is_terminal: bool) -> bool:
            paste_called.append((window_id, is_terminal))
            return False

        async def _type(self: TextInjector, window_id: str, text: str) -> bool:
            type_called.append((window_id, text))
            raise AssertionError("inject() must not use xdotool type")

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)
        self._mock_method(monkeypatch, "_type", _type)

        # Mock inject_with_fallback to actually call inject_func
        # (which will raise RuntimeError because paste fails)
        async def _mock_fallback(text: str, inject_func) -> dict:
            try:
                await inject_func(text)
                return {"success": True, "method": "paste", "clipboard_saved": True}
            except RuntimeError:
                return {
                    "success": False,
                    "method": "clipboard_fallback",
                    "clipboard_saved": True,
                }

        monkeypatch.setattr(
            injector._clipboard_manager, "inject_with_fallback", _mock_fallback,
        )
        # Also need set_clipboard_for_paste to succeed
        async def _set_cb(text: str) -> bool:
            return True

        monkeypatch.setattr(
            injector._clipboard_manager, "set_clipboard_for_paste", _set_cb,
        )

        result = await injector.inject("new text")

        assert result.success is False
        assert result.method == "clipboard_fallback"
        assert result.error is not None
        assert paste_called == [("12345", False)]
        assert type_called == []

    # ------------------------------------------------------------------
    # Terminal window – uses ctrl+shift+v
    # ------------------------------------------------------------------

    async def test_inject_terminal_window(self, injector: TextInjector,
                                          monkeypatch: pytest.MonkeyPatch) -> None:
        """Terminal windows receive ``ctrl+shift+v`` instead of ``ctrl+v``."""
        paste_calls: list[tuple] = []

        async def _get_active(self: TextInjector) -> str | None:
            return "99999"

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            return True

        async def _paste(self: TextInjector, window_id: str, is_terminal: bool) -> bool:
            paste_calls.append((window_id, is_terminal))
            return True

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)

        # Inline inject_with_fallback to exercise the paste function
        async def _mock_fallback(text: str, inject_func) -> dict:
            await inject_func(text)
            return {"success": True, "method": "paste", "clipboard_saved": True}

        monkeypatch.setattr(
            injector._clipboard_manager, "inject_with_fallback", _mock_fallback,
        )
        async def _set_cb(text: str) -> bool:
            return True

        monkeypatch.setattr(
            injector._clipboard_manager, "set_clipboard_for_paste", _set_cb,
        )

        result = await injector.inject("some code")

        assert result.success is True
        assert result.method == "paste"
        assert paste_calls == [("99999", True)]

    # ------------------------------------------------------------------
    # Focus lost – clipboard fallback
    # ------------------------------------------------------------------

    async def test_focus_lost_fallback(self, injector: TextInjector,
                                       monkeypatch: pytest.MonkeyPatch) -> None:
        """When the active window changes during injection,
        inject_with_fallback handles it by leaving text in clipboard.
        """
        get_active_count: int = 0
        paste_called: list[Any] = []

        async def _get_active(self: TextInjector) -> str | None:
            nonlocal get_active_count
            get_active_count += 1
            return "11111" if get_active_count == 1 else "22222"

        async def _paste(self: TextInjector, window_id: str, is_terminal: bool) -> bool:
            paste_called.append((window_id, is_terminal))
            return True

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            return True

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)
        self._mock_method(monkeypatch, "_paste", _paste)

        # Inject_with_fallback integration: the paste function raises FocusLostError
        from backend.clipboard_manager import FocusLostError

        async def _set_cb(text: str) -> bool:
            return True

        monkeypatch.setattr(
            injector._clipboard_manager, "set_clipboard_for_paste", _set_cb,
        )
        # Mock inject_with_fallback to simulate FocusLostError path
        mock_original = injector._clipboard_manager.inject_with_fallback

        async def _mock_fallback(text: str, inject_func) -> dict:
            # Override the inject_func to raise FocusLostError
            async def _failing_func(t: str) -> None:
                try:
                    await inject_func(t)
                except RuntimeError:
                    raise FocusLostError("Focus changed during injection") from None
            return await mock_original(text, _failing_func)

        monkeypatch.setattr(
            injector._clipboard_manager, "inject_with_fallback", _mock_fallback,
        )

        result = await injector.inject("fallback text")

        assert result.success is False
        assert result.method == "clipboard_fallback"
        assert result.error is not None

    # ------------------------------------------------------------------
    # Clipboard save and restore (via inject_with_fallback)
    # ------------------------------------------------------------------

    async def test_clipboard_save_restore(self, injector: TextInjector,
                                          monkeypatch: pytest.MonkeyPatch) -> None:
        """Successful paste reports clipboard_saved=True via inject_with_fallback."""
        paste_calls = self._mock_paste_env(monkeypatch, injector)

        result = await injector.inject("text")

        assert result.success is True
        assert result.method == "paste"
        assert result.clipboard_saved is True
        assert paste_calls["paste"] == [("12345", False)]

        # inject_with_fallback was called (verified by paste being executed)

    async def test_clipboard_save_failure_reported(
        self,
        injector: TextInjector,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """When clipboard save fails, clipboard_saved=False is reported."""
        # Mock inject_with_fallback to return clipboard_saved=False
        self._mock_inject_with_fallback(
            monkeypatch, injector,
            success=True, method="paste", clipboard_saved=False,
        )

        async def _get_active(self: TextInjector) -> str | None:
            return "w1"

        async def _is_terminal(self: TextInjector, window_id: str) -> bool:
            return False

        self._mock_method(monkeypatch, "_get_active_window", _get_active)
        self._mock_method(monkeypatch, "_is_terminal", _is_terminal)

        result = await injector.inject("text")

        assert result.success is True
        assert result.clipboard_saved is False

    # ------------------------------------------------------------------
    # Injection failure (paste command fails)
    # ------------------------------------------------------------------

    async def test_inject_failure(self, injector: TextInjector,
                                  monkeypatch: pytest.MonkeyPatch) -> None:
        """When clipboard paste fails, the result
        indicates failure and the injected text stays in the clipboard.
        """
        self._mock_paste_env(
            monkeypatch, injector, paste_success=False,
        )

        # Mock inject_with_fallback to call inject_func and catch RuntimeError
        async def _mock_fallback(text: str, inject_func) -> dict:
            try:
                await inject_func(text)
                return {"success": True, "method": "paste", "clipboard_saved": True}
            except RuntimeError:
                return {
                    "success": False,
                    "method": "clipboard_fallback",
                    "clipboard_saved": True,
                }

        monkeypatch.setattr(
            injector._clipboard_manager, "inject_with_fallback", _mock_fallback,
        )

        result = await injector.inject("fail text")

        assert result.success is False
        assert result.method == "clipboard_fallback"
        assert result.error is not None

    # ------------------------------------------------------------------
    # No focused window
    # ------------------------------------------------------------------

    async def test_focus_window_not_found(self, injector: TextInjector,
                                          monkeypatch: pytest.MonkeyPatch) -> None:
        """When no window is focused, injection fails early without
        modifying the clipboard.
        """
        async def _get_active(self: TextInjector) -> str | None:
            return None

        self._mock_method(monkeypatch, "_get_active_window", _get_active)

        result = await injector.inject("no window")

        assert result.success is False
        assert result.method == "failed"
        assert result.clipboard_saved is False
        assert result.error is not None
        assert "window" in result.error.lower()

    # ------------------------------------------------------------------
    # Terminal detection (unchanged)
    # ------------------------------------------------------------------

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

    async def test_is_terminal_matches(self, injector: TextInjector,
                                       monkeypatch: pytest.MonkeyPatch) -> None:
        """``_is_terminal`` returns ``True`` for known terminal
        WM_CLASS values parsed from ``xprop`` output.
        """
        _run_called: list[tuple[Any, ...]] = []

        async def _run_mock(*args: str, input_data: bytes | None = None) -> Any:
            _run_called.append(args)
            from subprocess import CompletedProcess
            return CompletedProcess(
                args, 0,
                b'WM_CLASS(STRING) = "gnome-terminal", "Gnome-terminal"\n',
                b"",
            )

        monkeypatch.setattr(
            "backend.text_injector._run_command", _run_mock,
        )

        is_term = await injector._is_terminal("500")
        assert is_term is True
        assert _run_called == [("xprop", "-id", "500", "WM_CLASS")]

    async def test_is_terminal_non_terminal(self, injector: TextInjector,
                                            monkeypatch: pytest.MonkeyPatch) -> None:
        """``_is_terminal`` returns ``False`` for non-terminal windows."""
        async def _run_mock(*args: str, input_data: bytes | None = None) -> Any:
            from subprocess import CompletedProcess
            return CompletedProcess(
                args, 0,
                b'WM_CLASS(STRING) = "google-chrome", "Google-chrome"\n',
                b"",
            )

        monkeypatch.setattr(
            "backend.text_injector._run_command", _run_mock,
        )

        is_term = await injector._is_terminal("500")
        assert is_term is False

    async def test_is_terminal_failed_xprop(self, injector: TextInjector,
                                            monkeypatch: pytest.MonkeyPatch) -> None:
        """``_is_terminal`` returns ``False`` when xprop fails."""
        async def _run_mock(*args: str, input_data: bytes | None = None) -> Any:
            from subprocess import CompletedProcess
            return CompletedProcess(args, 1, b"", b"error")

        monkeypatch.setattr(
            "backend.text_injector._run_command", _run_mock,
        )

        is_term = await injector._is_terminal("500")
        assert is_term is False
