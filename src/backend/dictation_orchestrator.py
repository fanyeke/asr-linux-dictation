"""Dictation orchestrator for coordinating the ASR → polish pipeline."""

import asyncio
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from backend.asr_client import ASRClient, ASRError
from backend.config import Settings
from backend.dictionary_manager import list_entries
from backend.history_store import create_session, get_session, update_session
from backend.logging_config import get_logger
from backend.polish_client import PolishClient
from backend.prompt_manager import get_active_prompt

logger = get_logger(__name__)

DEFAULT_PROMPT_TEMPLATE = "{text}"


class DictationOrchestrator:
    """Coordinates the full dictation pipeline: ASR → prompt → dictionary → polish → injector."""

    def __init__(
        self,
        asr_client: ASRClient,
        polish_client: PolishClient,
        injector: Callable[[str], Any | Awaitable[Any]] | None = None,
        polish_enabled: bool = True,
        on_status_change: Callable[[str, str, dict], Awaitable[None] | None] | None = None,
    ) -> None:
        """Initialize the orchestrator.

        Args:
            asr_client: Client for speech-to-text.
            polish_client: Client for text polishing via LLM.
            injector: Optional callable invoked with the polished text.
            on_status_change: Optional callback ``(session_id, status, extra)`` invoked
                whenever the pipeline advances to a new phase. Used for real-time
                WebSocket broadcasting.
        """
        self.asr_client = asr_client
        self.polish_client = polish_client
        self.injector = injector
        self.polish_enabled = polish_enabled
        self.on_status_change = on_status_change

    async def _broadcast(self, session_id: str, status: str, **extra: Any) -> None:
        """Broadcast a status change via the on_status_change callback."""
        if self.on_status_change is not None:
            result = self.on_status_change(session_id, status, extra)
            if asyncio.iscoroutine(result):
                await result

    async def process(self, audio_bytes: bytes) -> dict:
        """Run the full dictation pipeline.

        Args:
            audio_bytes: Raw audio data to transcribe.

        Returns:
            The final session dict with status, raw_text, polished_text, etc.
            On failure, returns the session dict with status="failed" and
            error_type set to indicate which stage failed.
        """
        session_id = uuid.uuid4().hex
        await create_session(session_id)
        pipeline_start = time.monotonic()
        logger.info("pipeline_started", session_id=session_id, audio_bytes=len(audio_bytes))

        # ---- ASR -----------------------------------------------------------
        asr_start = time.monotonic()
        try:
            settings = Settings()
            raw_text = await self.asr_client.transcribe(
                audio_bytes, language=settings.asr_language
            )
            asr_ms = int((time.monotonic() - asr_start) * 1000)
            logger.info("asr_completed", session_id=session_id,
                        raw_text_preview=raw_text[:60], duration_ms=asr_ms)
        except ASRError as e:
            asr_ms = int((time.monotonic() - asr_start) * 1000)
            logger.error("asr_failed", session_id=session_id, error=str(e),
                         category=e.error_category, duration_ms=asr_ms)
            return await update_session(
                session_id,
                status="failed",
                error_type=f"asr:{e.error_category}",
            )

        await update_session(session_id, status="transcribing", raw_text=raw_text)
        await self._broadcast(session_id, "transcribing", raw_text=raw_text)

        if self.polish_enabled:
            # ---- Prompt + Dictionary -------------------------------------------
            active = await get_active_prompt()
            prompt_template = active["template"] if active else DEFAULT_PROMPT_TEMPLATE

            entries = await list_entries()
            mapped = [
                {
                    "term": e["canonical_term"],
                    "definition": e["notes"] or "",
                    "pronunciation": e.get("pronunciation") or "",
                }
                for e in entries
            ]
            logger.info("dictionary_lookup", session_id=session_id, matches=len(entries))

            # ---- Polish --------------------------------------------------------
            try:
                polish_start = time.monotonic()
                polished = await self.polish_client.polish(
                    raw_text, prompt_template, dictionary_entries=mapped,
                )
                polish_ms = int((time.monotonic() - polish_start) * 1000)
                logger.info("polish_completed", session_id=session_id,
                            polished_preview=polished[:60], duration_ms=polish_ms)
            except Exception as e:
                logger.error("polish_failed", session_id=session_id, error=str(e))
                return await update_session(
                    session_id,
                    status="failed",
                    raw_text=raw_text,
                    error_type=f"polish:{type(e).__name__}",
                )
        else:
            polished = raw_text
            logger.info("polish_skipped", session_id=session_id)

        await update_session(session_id, status="polishing", polished_text=polished)
        await self._broadcast(session_id, "polishing", polished_text=polished)

        # ---- Inject --------------------------------------------------------
        if self.injector:
            try:
                inject_start = time.monotonic()
                result = self.injector(polished)
                if asyncio.iscoroutine(result):
                    await result
                inject_ms = int((time.monotonic() - inject_start) * 1000)
                logger.info("inject_completed", session_id=session_id, duration_ms=inject_ms)
            except Exception as e:
                logger.error("inject_failed", session_id=session_id, error=str(e))
                await self._broadcast(session_id, "failed", error_type=f"inject:{type(e).__name__}")
                return await update_session(
                    session_id,
                    status="failed",
                    raw_text=raw_text,
                    polished_text=polished,
                    error_type=f"inject:{type(e).__name__}",
                )

        session = await update_session(session_id, status="completed")
        total_ms = int((time.monotonic() - pipeline_start) * 1000)
        logger.info("pipeline_completed", session_id=session_id, duration_ms=total_ms)
        await self._broadcast(session_id, "completed", raw_text=raw_text, polished_text=polished)
        return session

    async def retry_from_text(self, raw_text: str) -> dict:
        """Re-run polish + inject on existing raw text without re-recording.

        Creates a new session and runs the prompt/dictionary enrichment,
        LLM polish, and text injection stages.

        Args:
            raw_text: The raw ASR transcript from a previous failed session.

        Returns:
            The final session dict for the new retry session.
        """
        session_id = uuid.uuid4().hex
        await create_session(session_id)
        pipeline_start = time.monotonic()
        logger.info(
            "retry_started",
            session_id=session_id,
            raw_text_preview=raw_text[:60],
        )

        await update_session(session_id, status="transcribing", raw_text=raw_text)
        await self._broadcast(session_id, "transcribing", raw_text=raw_text)

        if self.polish_enabled:
            # ---- Prompt + Dictionary -------------------------------------------
            active = await get_active_prompt()
            prompt_template = active["template"] if active else DEFAULT_PROMPT_TEMPLATE

            entries = await list_entries()
            mapped = [
                {
                    "term": e["canonical_term"],
                    "definition": e["notes"] or "",
                    "pronunciation": e.get("pronunciation") or "",
                }
                for e in entries
            ]
            logger.info("dictionary_lookup", session_id=session_id, matches=len(entries))

            # ---- Polish --------------------------------------------------------
            try:
                polish_start = time.monotonic()
                polished = await self.polish_client.polish(
                    raw_text, prompt_template, dictionary_entries=mapped,
                )
                polish_ms = int((time.monotonic() - polish_start) * 1000)
                logger.info(
                    "polish_completed",
                    session_id=session_id,
                    polished_preview=polished[:60],
                    duration_ms=polish_ms,
                )
            except Exception as e:
                logger.error("polish_failed", session_id=session_id, error=str(e))
                await self._broadcast(session_id, "failed", error_type=f"polish:{type(e).__name__}")
                return await update_session(
                    session_id,
                    status="failed",
                    raw_text=raw_text,
                    error_type=f"polish:{type(e).__name__}",
                )
        else:
            polished = raw_text
            logger.info("polish_skipped", session_id=session_id)

        await update_session(session_id, status="polishing", polished_text=polished)
        await self._broadcast(session_id, "polishing", polished_text=polished)

        # ---- Inject --------------------------------------------------------
        if self.injector:
            try:
                inject_start = time.monotonic()
                result = self.injector(polished)
                if asyncio.iscoroutine(result):
                    await result
                inject_ms = int((time.monotonic() - inject_start) * 1000)
                logger.info("inject_completed", session_id=session_id, duration_ms=inject_ms)
            except Exception as e:
                logger.error("inject_failed", session_id=session_id, error=str(e))
                await self._broadcast(session_id, "failed", error_type=f"inject:{type(e).__name__}")
                return await update_session(
                    session_id,
                    status="failed",
                    raw_text=raw_text,
                    polished_text=polished,
                    error_type=f"inject:{type(e).__name__}",
                )

        session = await update_session(session_id, status="completed")
        total_ms = int((time.monotonic() - pipeline_start) * 1000)
        logger.info("retry_completed", session_id=session_id, duration_ms=total_ms)
        return session

    async def get_status(self, session_id: str) -> dict | None:
        """Retrieve the current status of a session.

        Args:
            session_id: The session identifier.

        Returns:
            Session dict if found, None otherwise.
        """
        return await get_session(session_id)
