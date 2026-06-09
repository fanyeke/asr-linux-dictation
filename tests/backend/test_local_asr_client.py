"""Tests for the local ASR client."""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.asr_client import ASRError
from backend.local_asr_client import LocalASRClient, _find_whisper_cli


class TestFindWhisperCLI:
    """Test whisper-cli discovery."""

    def test_find_returns_none_when_not_installed(self) -> None:
        """Returns None when no whisper-cli is in PATH."""
        # PATH set to empty so nothing is found
        with patch.dict(os.environ, {"PATH": ""}):
            result = _find_whisper_cli()
            assert result is None


class TestLocalASRClient:
    """Test the LocalASRClient class."""

    def test_init_stores_params(self) -> None:
        """Constructor stores model path and size."""
        client = LocalASRClient("/models/small.bin", "small")
        assert client._model_path == "/models/small.bin"
        assert client._model_size == "small"

    @patch("backend.local_asr_client._find_whisper_cli", return_value=None)
    async def test_transcribe_no_cli(self, mock_find) -> None:
        """Raises ASRError when whisper-cli is not installed."""
        client = LocalASRClient("/models/small.bin")
        with pytest.raises(ASRError, match="whisper-cli not found"):
            await client.transcribe(b"audio data")

    @patch("backend.local_asr_client._find_whisper_cli", return_value="/usr/bin/whisper-cli")
    async def test_transcribe_no_model(self, mock_find) -> None:
        """Raises ASRError when model file doesn't exist."""
        client = LocalASRClient("/nonexistent/model.bin")
        with pytest.raises(ASRError, match="Model not found"):
            await client.transcribe(b"audio data")

    @patch("backend.local_asr_client._find_whisper_cli", return_value="/usr/bin/whisper-cli")
    async def test_transcribe_success(self, mock_find, tmp_path: Path) -> None:
        """Successful transcription returns transcribed text."""
        model_path = tmp_path / "model.bin"
        model_path.write_text("fake model")

        # Mock subprocess to return fake transcription
        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.communicate = AsyncMock(return_value=(b"hello world", b""))

        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            client = LocalASRClient(str(model_path))
            result = await client.transcribe(b"fake audio")

        assert result == "hello world"

    @patch("backend.local_asr_client._find_whisper_cli", return_value="/usr/bin/whisper-cli")
    async def test_transcribe_timeout(self, mock_find, tmp_path: Path) -> None:
        """Raises ASRError when whisper-cli times out."""
        model_path = tmp_path / "model.bin"
        model_path.write_text("fake model")

        mock_proc = MagicMock()
        mock_proc.communicate = AsyncMock(side_effect=TimeoutError())

        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            client = LocalASRClient(str(model_path))
            with pytest.raises(ASRError, match="timed out"):
                await client.transcribe(b"fake audio")

    @patch("backend.local_asr_client._find_whisper_cli", return_value="/usr/bin/whisper-cli")
    async def test_transcribe_non_zero_exit(self, mock_find, tmp_path: Path) -> None:
        """Raises ASRError when whisper-cli exits with error."""
        model_path = tmp_path / "model.bin"
        model_path.write_text("fake model")

        mock_proc = MagicMock()
        mock_proc.returncode = 1
        mock_proc.communicate = AsyncMock(return_value=(b"", b"error message"))

        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            client = LocalASRClient(str(model_path))
            with pytest.raises(ASRError, match="whisper.cpp failed"):
                await client.transcribe(b"fake audio")

    @patch("backend.local_asr_client._find_whisper_cli", return_value="/usr/bin/whisper-cli")
    async def test_transcribe_empty_output(self, mock_find, tmp_path: Path) -> None:
        """Raises ASRError when whisper-cli returns empty text."""
        model_path = tmp_path / "model.bin"
        model_path.write_text("fake model")

        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.communicate = AsyncMock(return_value=(b"  \n", b""))

        with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
            client = LocalASRClient(str(model_path))
            with pytest.raises(ASRError, match="empty transcription"):
                await client.transcribe(b"fake audio")

    @patch("backend.local_asr_client._find_whisper_cli", return_value="/usr/bin/whisper-cli")
    async def test_transcribe_with_language(self, mock_find, tmp_path: Path) -> None:
        """Language parameter is passed to whisper-cli."""
        model_path = tmp_path / "model.bin"
        model_path.write_text("fake model")

        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.communicate = AsyncMock(return_value=("你好世界".encode(), b""))

        cmd_args = []

        async def capture_exec(*args, **kwargs):
            nonlocal cmd_args
            cmd_args = args
            return mock_proc

        with patch("asyncio.create_subprocess_exec", side_effect=capture_exec):
            client = LocalASRClient(str(model_path))
            result = await client.transcribe(b"fake audio", language="zh")

        assert result == "\u4f60\u597d\u4e16\u754c"
        assert "--language" in cmd_args
        assert cmd_args[cmd_args.index("--language") + 1] == "zh"

    @patch("backend.local_asr_client._find_whisper_cli", return_value="/usr/bin/whisper-cli")
    async def test_warmup(self, mock_find) -> None:
        """warmup() is a no-op that doesn't raise."""
        client = LocalASRClient("/some/model.bin")
        await client.warmup()  # Should not raise
