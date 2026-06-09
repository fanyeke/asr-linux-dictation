"""Local ASR client using whisper.cpp via subprocess.

Provides :class:`LocalASRClient` which calls the whisper.cpp CLI
(``whisper-cli``) as a subprocess to transcribe audio locally.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import tempfile

from backend.asr_client import ASRError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_WHISPER_CLI_NAMES = ["whisper-cli", "whisper", "whisper.cpp"]

_SUPPORTED_FORMATS = {"wav", "mp3", "m4a", "ogg", "flac"}


def _find_whisper_cli() -> str | None:
    """Find the whisper.cpp CLI executable in PATH."""
    import shutil

    for name in _WHISPER_CLI_NAMES:
        path = shutil.which(name)
        if path:
            return path
    return None


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class LocalASRClient:
    """Local ASR client using whisper.cpp via subprocess.

    Transcribes audio using a locally-running whisper.cpp model.
    Falls back gracefully with clear error messages if whisper-cli
    is not installed or the model file is missing.

    Args:
        model_path: Path to the GGML model file (e.g.
            ``~/.asr-linux/models/ggml-small.bin``).
        model_size: Human-readable size name for logging
            (``"tiny"``, ``"base"``, ``"small"``, ``"medium"``).
    """

    def __init__(self, model_path: str, model_size: str = "small") -> None:
        self._model_path = model_path
        self._model_size = model_size
        self._cli_path = _find_whisper_cli()

    async def warmup(self) -> None:
        """Pre-warm: just log that we're using local ASR (no-op)."""
        logger.info("local_asr_warmup", model=self._model_size)

    async def transcribe(
        self,
        audio_bytes: bytes,
        audio_format: str = "wav",
        timeout: float = 120.0,
        language: str | None = None,
    ) -> str:
        """Transcribe audio bytes to text using local whisper.cpp.

        Args:
            audio_bytes: Raw audio data.
            audio_format: Audio format (``"wav"``, ``"mp3"``, etc.).
            timeout: Maximum time to wait for transcription.
            language: Language code (e.g. ``"zh"``, ``"en"``, ``"auto"``).
                If None or "auto", whisper will auto-detect.

        Returns:
            Transcribed text.

        Raises:
            ASRError: If whisper-cli fails or returns empty output.
        """
        # Check prerequisites
        if self._cli_path is None:
            raise ASRError(
                "whisper-cli not found. Install whisper.cpp from "
                "https://github.com/ggerganov/whisper.cpp",
                error_category="server_error",
            )

        if not os.path.exists(self._model_path):
            raise ASRError(
                f"Model not found at {self._model_path}. "
                f"Download the {self._model_size} model first.",
                error_category="server_error",
            )

        # Save audio to temp file
        suffix = f".{audio_format}"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            # Build whisper-cli command
            cmd = [
                self._cli_path,
                "--model",
                self._model_path,
                "--file",
                tmp_path,
                "--no-timestamps",  # -nt: clean text output
            ]
            if language and language != "auto":
                cmd.extend(["--language", language])

            logger.info(
                "local_asr_started",
                model=self._model_size,
                model_path=self._model_path,
                audio_bytes=len(audio_bytes),
                language=language or "auto",
            )

            # Run whisper.cpp as subprocess
            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout,
                )
            except TimeoutError:
                raise ASRError(
                    f"whisper.cpp timed out after {timeout}s",
                    error_category="timeout",
                ) from None

            if proc.returncode != 0:
                error_output = stderr.decode().strip()[:500]
                raise ASRError(
                    f"whisper.cpp failed (exit {proc.returncode}): {error_output}",
                    error_category="server_error",
                )

            text = stdout.decode().strip()

            if not text:
                raise ASRError(
                    "whisper.cpp returned empty transcription",
                    error_category="malformed",
                )

            logger.info(
                "local_asr_completed",
                model=self._model_size,
                text_preview=text[:60],
                audio_bytes=len(audio_bytes),
            )
            return text

        except ASRError:
            raise
        except Exception as exc:
            raise ASRError(
                f"Local ASR failed: {exc}",
                error_category="unknown",
            ) from exc
        finally:
            # Clean up temp file
            with contextlib.suppress(OSError):
                os.unlink(tmp_path)
