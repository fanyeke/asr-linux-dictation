"""Dictation orchestrator for coordinating the ASR → polish pipeline."""

import asyncio
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from backend.asr_client import ASRClient, ASRError
from backend.dictionary_manager import (
    count_matches_in_text,
    list_entries,
    record_dictionary_stats,
)
from backend.history_store import create_session, get_session, update_session
from backend.logging_config import get_logger
from backend.polish_client import PolishClient
from backend.profile_manager import get_active_profile
from backend.voice_command import execute_command, match_command

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
        asr_language: str = "auto",
        on_status_change: Callable[[str, str, dict], Awaitable[None] | None] | None = None,
    ) -> None:
        """Initialize the orchestrator.

        Args:
            asr_client: Client for speech-to-text.
            polish_client: Client for text polishing via LLM.
            injector: Optional callable invoked with the polished text.
            polish_enabled: Whether LLM polish is enabled.
            asr_language: Language code for ASR ("zh", "en", "auto").
            on_status_change: Optional callback ``(session_id, status, extra)`` invoked
                whenever the pipeline advances to a new phase. Used for real-time
                WebSocket broadcasting.
        """
        self.asr_client = asr_client
        self.polish_client = polish_client
        self.injector = injector
        self.polish_enabled = polish_enabled
        self.asr_language = asr_language
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
        # Broadcast BEFORE the API call so the overlay shows "transcribing"
        # during the actual transcription, not after it completes.
        await update_session(session_id, status="transcribing")
        await self._broadcast(session_id, "transcribing")

        asr_start = time.monotonic()
        try:
            raw_text = await self.asr_client.transcribe(audio_bytes, language=self.asr_language)
            asr_ms = int((time.monotonic() - asr_start) * 1000)
            logger.info("asr_completed", session_id=session_id, raw_text_preview=raw_text[:60], duration_ms=asr_ms)
            await update_session(session_id, asr_ms=asr_ms)
        except ASRError as e:
            asr_ms = int((time.monotonic() - asr_start) * 1000)
            logger.error(
                "asr_failed", session_id=session_id, error=str(e), category=e.error_category, duration_ms=asr_ms
            )
            return await update_session(
                session_id,
                status="failed",
                error_type=f"asr:{e.error_category}",
            )

        await update_session(session_id, raw_text=raw_text)

        # ---- Voice Command Routing -------------------------------------------
        keyword, cmd, _ = match_command(raw_text)
        if cmd:
            total_ms = int((time.monotonic() - pipeline_start) * 1000)
            logger.info(
                "voice_command_executed",
                session_id=session_id,
                command=keyword,
            )
            await execute_command(cmd)
            await self._broadcast(
                session_id,
                "completed",
                raw_text=raw_text,
                command=keyword,
            )
            return await update_session(
                session_id,
                status="completed",
                raw_text=raw_text,
                polished_text=raw_text,
                timing_ms=total_ms,
            )

        # ---- Language Detection -------------------------------------------
        from backend.language_detector import detect_language

        detected_lang = detect_language(raw_text)
        logger.info("language_detected", session_id=session_id, language=detected_lang)

        if self.polish_enabled:
            # ---- Prompt + Dictionary -------------------------------------------
            active_profile = await get_active_profile()
            prompt_template = active_profile["prompt_template"] if active_profile else DEFAULT_PROMPT_TEMPLATE

            # Filter dictionary entries if profile specifies ids
            entries = await list_entries()
            if active_profile and active_profile.get("dictionary_ids"):
                allowed_ids = {int(x) for x in active_profile["dictionary_ids"].split(",") if x.strip().isdigit()}
                if allowed_ids:
                    entries = [e for e in entries if e["id"] in allowed_ids]

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
            # Broadcast BEFORE the API call so the overlay shows "polishing"
            # during the actual LLM call, not after it completes.
            await update_session(session_id, status="polishing")
            await self._broadcast(session_id, "polishing")

            try:
                polish_start = time.monotonic()
                polished = await self.polish_client.polish(
                    raw_text,
                    prompt_template,
                    dictionary_entries=mapped,
                    detected_language=detected_lang,
                )
                polish_ms = int((time.monotonic() - polish_start) * 1000)
                logger.info(
                    "polish_completed", session_id=session_id, polished_preview=polished[:60], duration_ms=polish_ms
                )
                await update_session(session_id, polish_ms=polish_ms)
            except Exception as e:
                logger.error("polish_failed", session_id=session_id, error=str(e))
                return await update_session(
                    session_id,
                    status="failed",
                    raw_text=raw_text,
                    error_type=f"polish:{type(e).__name__}",
                )

            # Store polished text after completion
            await update_session(session_id, polished_text=polished)
        else:
            polished = raw_text
            entries = []
            await update_session(session_id, polished_text=polished)
            logger.info("polish_skipped", session_id=session_id)

        # ---- Dictionary Stats -------------------------------------------------
        if entries:
            match_counts = count_matches_in_text(entries, polished)
            if match_counts:
                await record_dictionary_stats(session_id, match_counts)
                logger.info("dict_stats_recorded", session_id=session_id, matches=len(match_counts))

        # ---- Inject --------------------------------------------------------
        injection_method = "paste"
        if self.injector:
            try:
                inject_start = time.monotonic()
                result_or_coro = self.injector(polished)
                if asyncio.iscoroutine(result_or_coro):
                    inject_result = await result_or_coro
                else:
                    inject_result = result_or_coro
                inject_ms = int((time.monotonic() - inject_start) * 1000)

                # Capture injection method for clipboard-fallback notification
                if hasattr(inject_result, "success") and hasattr(inject_result, "method"):
                    injection_method = inject_result.method  # type: ignore[union-attr]

                logger.info(
                    "inject_completed",
                    session_id=session_id,
                    duration_ms=inject_ms,
                    method=injection_method,
                )
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

        total_ms = int((time.monotonic() - pipeline_start) * 1000)
        session = await update_session(session_id, status="completed", timing_ms=total_ms)
        logger.info("pipeline_completed", session_id=session_id, duration_ms=total_ms)
        await self._broadcast(
            session_id,
            "completed",
            raw_text=raw_text,
            polished_text=polished,
            injection_method=injection_method,
        )
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

        # ---- Language Detection -------------------------------------------
        from backend.language_detector import detect_language

        detected_lang = detect_language(raw_text)
        logger.info("language_detected", session_id=session_id, language=detected_lang)

        if self.polish_enabled:
            # ---- Prompt + Dictionary -------------------------------------------
            active_profile = await get_active_profile()
            prompt_template = active_profile["prompt_template"] if active_profile else DEFAULT_PROMPT_TEMPLATE

            entries = await list_entries()
            if active_profile and active_profile.get("dictionary_ids"):
                allowed_ids = {int(x) for x in active_profile["dictionary_ids"].split(",") if x.strip().isdigit()}
                if allowed_ids:
                    entries = [e for e in entries if e["id"] in allowed_ids]

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
            # Broadcast BEFORE the API call so the overlay shows "polishing"
            # during the actual LLM call, not after it completes.
            await update_session(session_id, status="polishing")
            await self._broadcast(session_id, "polishing")

            try:
                polish_start = time.monotonic()
                polished = await self.polish_client.polish(
                    raw_text,
                    prompt_template,
                    dictionary_entries=mapped,
                    detected_language=detected_lang,
                )
                polish_ms = int((time.monotonic() - polish_start) * 1000)
                logger.info(
                    "polish_completed",
                    session_id=session_id,
                    polished_preview=polished[:60],
                    duration_ms=polish_ms,
                )
                await update_session(session_id, polish_ms=polish_ms)
            except Exception as e:
                logger.error("polish_failed", session_id=session_id, error=str(e))
                await self._broadcast(session_id, "failed", error_type=f"polish:{type(e).__name__}")
                return await update_session(
                    session_id,
                    status="failed",
                    raw_text=raw_text,
                    error_type=f"polish:{type(e).__name__}",
                )

            # Store polished text after completion
            await update_session(session_id, polished_text=polished)
        else:
            polished = raw_text
            await update_session(session_id, polished_text=polished)
            logger.info("polish_skipped", session_id=session_id)

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

        total_ms = int((time.monotonic() - pipeline_start) * 1000)
        session = await update_session(session_id, status="completed", timing_ms=total_ms)
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
