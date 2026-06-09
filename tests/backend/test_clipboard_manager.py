"""Tests for ClipboardManager — clipboard save/restore around text injection."""

from __future__ import annotations

import logging
import subprocess
from typing import Any

import pytest

from backend import clipboard_manager
from backend.clipboard_manager import ClipboardManager, FocusLostError


@pytest.mark.asyncio
async def test_run_clipboard_timeout_returns_completed_process(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A hung clipboard command returns a timeout result instead of hanging."""

    def fake_run(*args: Any, **kwargs: Any) -> subprocess.CompletedProcess:
        raise subprocess.TimeoutExpired(cmd=args[0], timeout=1.0)

    monkeypatch.setattr(clipboard_manager.subprocess, "run", fake_run)

    result = await clipboard_manager._run_clipboard("xsel", "write", input_data=b"text")

    assert result.returncode == 124
    assert b"timed out" in result.stderr


@pytest.mark.asyncio
async def test_run_xclip_write_uses_bounded_owner_loop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """xclip write success means the clipboard owner is running, not exited."""

    class FakePopen:
        returncode = None

        def __init__(self, args: tuple[str, ...], **kwargs: Any) -> None:
            self.args = args
            self.kwargs = kwargs
            self.input_data: bytes | None = None

        def communicate(
            self,
            input: bytes | None = None,
            timeout: float | None = None,
        ) -> tuple[bytes, bytes]:
            self.input_data = input
            raise subprocess.TimeoutExpired(cmd=self.args, timeout=timeout)

    created: list[FakePopen] = []

    def fake_popen(args: tuple[str, ...], **kwargs: Any) -> FakePopen:
        proc = FakePopen(args, **kwargs)
        created.append(proc)
        return proc

    monkeypatch.setattr(clipboard_manager.subprocess, "Popen", fake_popen)

    result = await clipboard_manager._run_clipboard(
        "xclip",
        "write",
        input_data=b"text",
    )

    assert result.returncode == 0
    assert created[0].args == ("xclip", "-selection", "clipboard", "-loops", "2")
    assert created[0].input_data == b"text"


class TestClipboardManager:
    """Test the ClipboardManager class."""

    # ------------------------------------------------------------------
    # Fixtures
    # ------------------------------------------------------------------

    @pytest.fixture
    def manager(self) -> ClipboardManager:
        """Return a fresh ClipboardManager instance with xsel available."""
        return ClipboardManager()

    @staticmethod
    def _enable_tool(
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
        tool: str = "xsel",
    ) -> None:
        """Pretend a clipboard tool is available."""
        monkeypatch.setattr(
            "backend.clipboard_manager.shutil.which",
            lambda cmd: f"/usr/bin/{cmd}" if cmd == tool else None,
        )
        manager._tool = tool  # noqa: SLF001

    @staticmethod
    def _mock_run(
        monkeypatch: pytest.MonkeyPatch,
        *,
        output: bytes = b"",
        returncode: int = 0,
    ) -> list[dict[str, Any]]:
        """Replace ``_run_clipboard`` with a mock that records calls.

        Returns a list of dicts with keys ``tool``, ``mode``,
        ``input_data``.
        """
        calls: list[dict[str, Any]] = []

        async def mock_run(
            tool: str,
            mode: str,  # type: ignore[func-returns-value]
            input_data: bytes | None = None,
        ) -> Any:
            calls.append({"tool": tool, "mode": mode, "input_data": input_data})
            from subprocess import CompletedProcess

            return CompletedProcess((tool, mode), returncode, output, b"")

        monkeypatch.setattr("backend.clipboard_manager._run_clipboard", mock_run)
        return calls

    # ------------------------------------------------------------------
    # save()
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_save_returns_clipboard_content(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """``save()`` stores and returns the current clipboard content."""
        self._enable_tool(manager, monkeypatch)
        self._mock_run(monkeypatch, output=b"saved content")

        result = await manager.save()

        assert result == "saved content"
        assert manager._saved_content == "saved content"  # noqa: SLF001

    @pytest.mark.asyncio
    async def test_save_empty_clipboard_returns_none(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """``save()`` returns ``None`` when the clipboard is empty."""
        self._enable_tool(manager, monkeypatch)
        self._mock_run(monkeypatch, output=b"")

        result = await manager.save()

        assert result is None
        assert manager._saved_content is None  # noqa: SLF001

    @pytest.mark.asyncio
    async def test_save_failed_command_returns_none(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """``save()`` returns ``None`` when the clipboard command fails."""
        self._enable_tool(manager, monkeypatch)
        self._mock_run(monkeypatch, returncode=1)

        result = await manager.save()

        assert result is None

    # ------------------------------------------------------------------
    # restore()
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_restore_pushes_saved_content(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """``restore()`` writes the saved content back to the clipboard."""
        self._enable_tool(manager, monkeypatch)
        manager._saved_content = "original text"  # noqa: SLF001

        calls = self._mock_run(monkeypatch)

        await manager.restore()

        assert len(calls) == 1
        assert calls[0]["mode"] == "write"
        assert calls[0]["input_data"] == b"original text"

    @pytest.mark.asyncio
    async def test_restore_noop_when_no_saved_content(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """``restore()`` is a no-op when no content was saved."""
        self._enable_tool(manager, monkeypatch)
        manager._saved_content = None  # noqa: SLF001

        calls = self._mock_run(monkeypatch)

        await manager.restore()

        assert calls == []

    # ------------------------------------------------------------------
    # set_clipboard()
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_set_clipboard(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """``set_clipboard()`` writes text to the X11 clipboard."""
        self._enable_tool(manager, monkeypatch)

        calls = self._mock_run(monkeypatch)

        await manager.set_clipboard("test text")

        assert len(calls) == 1
        assert calls[0]["mode"] == "write"
        assert calls[0]["input_data"] == b"test text"

    @pytest.mark.asyncio
    async def test_set_clipboard_for_paste_waits_until_text_is_visible(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Clipboard paste setup waits out stale reads from async clipboard owners."""
        self._enable_tool(manager, monkeypatch)
        reads = [b"old text", b"test text"]
        calls: list[dict[str, Any]] = []

        async def mock_run(
            tool: str,
            mode: str,
            input_data: bytes | None = None,
        ) -> Any:
            calls.append({"tool": tool, "mode": mode, "input_data": input_data})
            from subprocess import CompletedProcess

            if mode == "read":
                return CompletedProcess((tool, mode), 0, reads.pop(0), b"")
            return CompletedProcess((tool, mode), 0, b"", b"")

        async def no_sleep(_delay: float) -> None:
            return None

        monkeypatch.setattr("backend.clipboard_manager._run_clipboard", mock_run)
        monkeypatch.setattr("backend.clipboard_manager.asyncio.sleep", no_sleep)

        result = await manager.set_clipboard_for_paste("test text", timeout=0.2)

        assert result is True
        assert calls[0]["mode"] == "write"
        assert calls[0]["input_data"] == b"test text"
        assert [call["mode"] for call in calls[1:]] == ["read", "read"]

    @pytest.mark.asyncio
    async def test_set_clipboard_for_paste_reports_timeout_for_stale_clipboard(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A stale clipboard read returns False so callers do not paste old text."""
        self._enable_tool(manager, monkeypatch)

        async def mock_run(
            tool: str,
            mode: str,
            input_data: bytes | None = None,
        ) -> Any:
            from subprocess import CompletedProcess

            output = b"old text" if mode == "read" else b""
            return CompletedProcess((tool, mode), 0, output, b"")

        async def no_sleep(_delay: float) -> None:
            return None

        monkeypatch.setattr("backend.clipboard_manager._run_clipboard", mock_run)
        monkeypatch.setattr("backend.clipboard_manager.asyncio.sleep", no_sleep)

        result = await manager.set_clipboard_for_paste(
            "new text",
            timeout=0.0,
            poll_interval=0.0,
        )

        assert result is False

    # ------------------------------------------------------------------
    # inject_with_fallback — success path
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_inject_with_fallback_success(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """When *inject_func* succeeds, text stays in clipboard (no restore)."""
        ops: dict[str, list[Any]] = {"save": [], "restore": [], "set": []}
        inject_called: list[str] = []

        async def mock_save() -> str | None:
            ops["save"].append(True)
            return "original"

        async def mock_restore() -> None:
            ops["restore"].append(True)

        async def mock_set(text: str) -> None:
            ops["set"].append(text)

        monkeypatch.setattr(manager, "save", mock_save)
        monkeypatch.setattr(manager, "restore", mock_restore)
        monkeypatch.setattr(manager, "set_clipboard", mock_set)

        async def inject_func(text: str) -> None:
            inject_called.append(text)

        result = await manager.inject_with_fallback("hello", inject_func)

        assert result["success"] is True
        assert result["method"] == "paste"
        assert result["clipboard_saved"] is True
        assert ops["save"] == [True]
        assert ops["restore"] == []  # clipboard is NOT restored
        assert ops["set"] == []  # set_clipboard not called on success
        assert inject_called == ["hello"]

    # ------------------------------------------------------------------
    # inject_with_fallback — runtime error (paste failure)
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_inject_with_fallback_runtime_error(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """On RuntimeError, clipboard is NOT restored — text stays as fallback."""
        ops: dict[str, list[Any]] = {"save": [], "restore": [], "set": []}

        async def mock_save() -> str | None:
            ops["save"].append(True)
            return "original"

        async def mock_restore() -> None:
            ops["restore"].append(True)

        async def mock_set(text: str) -> None:
            ops["set"].append(text)

        monkeypatch.setattr(manager, "save", mock_save)
        monkeypatch.setattr(manager, "restore", mock_restore)
        monkeypatch.setattr(manager, "set_clipboard", mock_set)

        async def inject_func(text: str) -> None:
            raise RuntimeError("Paste command failed")

        result = await manager.inject_with_fallback("hello", inject_func)

        assert result["success"] is False
        assert result["method"] == "clipboard_fallback"
        assert result["clipboard_saved"] is True
        assert ops["save"] == [True]
        assert ops["restore"] == []  # NOT restored
        assert ops["set"] == []  # set_clipboard NOT called (text already set by inject_func)

    # ------------------------------------------------------------------
    # inject_with_fallback — focus lost
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_inject_with_fallback_focus_lost(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """On :class:`FocusLostError`, text is copied to clipboard as fallback."""
        ops: dict[str, list[Any]] = {"save": [], "restore": [], "set": []}

        async def mock_save() -> str | None:
            ops["save"].append(True)
            return "original"

        async def mock_restore() -> None:
            ops["restore"].append(True)

        async def mock_set(text: str) -> None:
            ops["set"].append(text)

        monkeypatch.setattr(manager, "save", mock_save)
        monkeypatch.setattr(manager, "restore", mock_restore)
        monkeypatch.setattr(manager, "set_clipboard", mock_set)

        async def inject_func(text: str) -> None:
            raise FocusLostError("Focus lost!")

        caplog.set_level(logging.INFO)

        result = await manager.inject_with_fallback("fallback text", inject_func)

        assert result["success"] is False
        assert result["method"] == "clipboard_fallback"
        assert result["clipboard_saved"] is True
        assert ops["save"] == [True]
        assert ops["set"] == ["fallback text"]
        assert ops["restore"] == []  # restore NOT called
        assert "focus" in caplog.text.lower()

    # ------------------------------------------------------------------
    # inject_with_fallback — no saved content
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_inject_with_fallback_empty_clipboard(
        self,
        manager: ClipboardManager,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """When clipboard is empty, ``clipboard_saved`` is ``False``."""

        async def mock_save() -> None:
            return None

        async def mock_restore() -> None:
            pass

        monkeypatch.setattr(manager, "save", mock_save)
        monkeypatch.setattr(manager, "restore", mock_restore)

        async def inject_func(text: str) -> None:
            pass

        result = await manager.inject_with_fallback("text", inject_func)

        assert result["success"] is True
        assert result["clipboard_saved"] is False

    # ------------------------------------------------------------------
    # Tool missing — graceful degradation
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_no_tool_logs_warning(
        self,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """When neither xsel nor xclip is installed, a warning is logged."""
        import backend.clipboard_manager as cm

        caplog.set_level(logging.WARNING)
        cm.shutil.which = lambda cmd: None  # type: ignore[method-assign]

        cm.ClipboardManager()

        assert "xsel" in caplog.text or "xclip" in caplog.text

    @pytest.mark.asyncio
    async def test_no_tool_save_returns_none(
        self,
        manager: ClipboardManager,
    ) -> None:
        """``save()`` returns ``None`` when no tool is available."""
        manager._tool = None  # noqa: SLF001
        result = await manager.save()
        assert result is None

    @pytest.mark.asyncio
    async def test_no_tool_restore_noop(
        self,
        manager: ClipboardManager,
    ) -> None:
        """``restore()`` is a no-op when no tool is available."""
        manager._tool = None  # noqa: SLF001
        manager._saved_content = "something"  # noqa: SLF001
        await manager.restore()  # should not raise

    @pytest.mark.asyncio
    async def test_no_tool_set_clipboard_noop(
        self,
        manager: ClipboardManager,
    ) -> None:
        """``set_clipboard()`` is a no-op when no tool is available."""
        manager._tool = None  # noqa: SLF001
        await manager.set_clipboard("text")  # should not raise

    @pytest.mark.asyncio
    async def test_no_tool_inject_func_still_called(
        self,
        manager: ClipboardManager,
    ) -> None:
        """``inject_with_fallback`` still calls *inject_func* when no tool is available."""
        manager._tool = None  # noqa: SLF001

        inject_called: list[str] = []

        async def inject_func(text: str) -> None:
            inject_called.append(text)

        result = await manager.inject_with_fallback("text", inject_func)

        assert inject_called == ["text"]
        assert result["success"] is True
        assert result["clipboard_saved"] is False

    # ------------------------------------------------------------------
    # FocusLostError
    # ------------------------------------------------------------------

    def test_focus_lost_error_is_exception(self) -> None:
        """FocusLostError is a proper exception that can be raised and caught."""
        exc = FocusLostError("test message")
        assert isinstance(exc, Exception)
        assert str(exc) == "test message"
