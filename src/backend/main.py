"""FastAPI application entry point."""

import asyncio
import os
import time
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
)

from backend.asr_client import ASRClient
from backend.audio_recorder import AudioRecorder
from backend.config import Settings
from backend.config_store import UserConfig, load_user_config, save_user_config
from backend.database import init_database
from backend.diagnostics import build_diagnostics_bundle
from backend.dictation_orchestrator import DictationOrchestrator
from backend.dictionary_manager import (
    create_entry,
    delete_entry,
    list_entries,
    update_entry,
)
from backend.history_store import get_session, list_sessions
from backend.logging_config import configure_logging, get_logger
from backend.polish_client import PolishClient
from backend.prompt_manager import list_prompts
from backend.text_injector import TextInjector

# Store active WebSocket connections
_ws_connections: list[WebSocket] = []
logger = get_logger(__name__)

# Singletons for dictation pipeline
_recorder: AudioRecorder | None = None
_orchestrator: DictationOrchestrator | None = None
_current_asr_api_key: str | None = None
_current_llm_api_key: str | None = None
_user_config: UserConfig | None = None
_dictation_processing_lock = asyncio.Lock()


def _build_asr_probe_wav() -> bytes:
    """Return a short valid mono WAV payload for ASR key probing."""
    sample_rate = 16000
    duration_seconds = 0.5
    frame_count = int(sample_rate * duration_seconds)
    amplitude = 4000
    period = max(sample_rate // 440, 1)

    pcm = bytearray()
    for index in range(frame_count):
        sample = amplitude if (index % period) < (period // 2) else -amplitude
        pcm.extend(sample.to_bytes(2, byteorder="little", signed=True))

    num_channels = 1
    bits_per_sample = 16
    block_align = num_channels * bits_per_sample // 8
    byte_rate = sample_rate * block_align
    data_size = len(pcm)

    return b"".join(
        [
            b"RIFF",
            (36 + data_size).to_bytes(4, byteorder="little"),
            b"WAVE",
            b"fmt ",
            (16).to_bytes(4, byteorder="little"),
            (1).to_bytes(2, byteorder="little"),
            num_channels.to_bytes(2, byteorder="little"),
            sample_rate.to_bytes(4, byteorder="little"),
            byte_rate.to_bytes(4, byteorder="little"),
            block_align.to_bytes(2, byteorder="little"),
            bits_per_sample.to_bytes(2, byteorder="little"),
            b"data",
            data_size.to_bytes(4, byteorder="little"),
            bytes(pcm),
        ]
    )


def get_recorder(vad_enabled: bool = True) -> AudioRecorder:
    """Return the singleton AudioRecorder instance."""
    global _recorder
    if _recorder is None:
        _recorder = AudioRecorder(vad_enabled=vad_enabled)
    return _recorder


def _resolve_asr_api_key() -> str | None:
    """Return the active ASR API key from runtime config, DB config, or env."""
    global _current_asr_api_key, _user_config
    if _current_asr_api_key is not None:
        return _current_asr_api_key
    if _user_config is not None and _user_config.asr_api_key:
        return _user_config.asr_api_key
    return os.environ.get("ASR_LINUX_MIMO_API_KEY")


def _resolve_llm_api_key() -> str | None:
    """Return the active OpenAI-compatible LLM API key."""
    global _current_llm_api_key, _user_config
    if _current_llm_api_key is not None:
        return _current_llm_api_key
    if _user_config is not None and _user_config.llm_api_key:
        return _user_config.llm_api_key
    return os.environ.get("ASR_LINUX_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")


def get_orchestrator() -> DictationOrchestrator:
    """Return the singleton DictationOrchestrator instance.

    Re-creates the orchestrator if the API key or endpoint settings have
    changed since the last call so that runtime config updates take effect.
    """
    global _orchestrator, _current_asr_api_key, _current_llm_api_key, _user_config
    active_asr_key = _resolve_asr_api_key()
    active_llm_key = _resolve_llm_api_key()
    cfg = _user_config or UserConfig()

    # Build a fingerprint of the current configuration
    config_fingerprint = (
        active_asr_key,
        active_llm_key,
        cfg.asr_base_url,
        cfg.asr_model,
        cfg.llm_enabled,
        cfg.llm_base_url,
        cfg.llm_model,
        cfg.asr_language,
    )
    old_fingerprint = getattr(_orchestrator, "_config_fingerprint", None)

    # Recreate if this is the first call or any config changed
    if _orchestrator is None or config_fingerprint != old_fingerprint:
        asr = ASRClient(
            api_key=active_asr_key,
            base_url=cfg.asr_base_url,
            model=cfg.asr_model,
        )
        polish = PolishClient(
            api_key=active_llm_key,
            base_url=cfg.llm_base_url,
            model=cfg.llm_model,
        )
        injector = TextInjector()

        async def _broadcast_status(session_id: str, status: str, extra: dict) -> None:
            """Broadcast orchestrator status changes to WebSocket clients."""
            event = {
                "type": "status_update",
                "session_id": session_id,
                "status": status,
                **extra,
            }
            disconnected: list[WebSocket] = []
            for ws in _ws_connections:
                try:
                    await ws.send_json(event)
                except Exception:
                    disconnected.append(ws)
            for ws in disconnected:
                if ws in _ws_connections:
                    _ws_connections.remove(ws)

        _orchestrator = DictationOrchestrator(
            asr, polish, injector=injector.inject, polish_enabled=cfg.llm_enabled,
            asr_language=cfg.asr_language,
            on_status_change=_broadcast_status,
        )
        _orchestrator._config_fingerprint = config_fingerprint  # type: ignore[attr-defined]
        _current_asr_api_key = active_asr_key
        _current_llm_api_key = active_llm_key

    return _orchestrator


async def verify_token(request: Request) -> None:
    """Verify the session token from the request header."""
    settings = Settings()
    token = request.headers.get("x-token")

    if not settings.secret_token:
        # No token configured; accept all requests
        return

    if not token or token != settings.secret_token:
        raise HTTPException(status_code=401, detail="Invalid or missing token")


async def verify_ws_token(websocket: WebSocket) -> bool:
    """Verify WebSocket token from query parameter."""
    settings = Settings()
    token = websocket.query_params.get("token")

    if not settings.secret_token:
        return True

    return token is not None and token == settings.secret_token


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    global _user_config
    settings = Settings()
    log_file = settings.data_dir / "logs" / "asr-linux.log"
    configure_logging(log_level=settings.log_level, log_file=log_file)
    await init_database()
    _user_config = await load_user_config()
    yield


app = FastAPI(title="ASR Linux Backend", version="0.1.0", lifespan=lifespan)


@app.get("/config")
async def get_config(
    _: Annotated[None, Depends(verify_token)],
) -> dict:
    """Get current runtime configuration.

    API key values are never returned to the client. Only boolean flags
    indicate whether a key is available.
    """
    global _user_config
    cfg = _user_config or UserConfig()
    return {
        "asr_api_key_set": _resolve_asr_api_key() is not None,
        "llm_api_key_set": _resolve_llm_api_key() is not None,
        "language": Settings().asr_language,
        "asr_base_url": cfg.asr_base_url,
        "asr_model": cfg.asr_model,
        "llm_enabled": cfg.llm_enabled,
        "llm_base_url": cfg.llm_base_url,
        "llm_model": cfg.llm_model,
        "hotkey": cfg.hotkey,
        "ui_language": cfg.ui_language,
        "asr_language": cfg.asr_language,
        "vad_enabled": cfg.vad_enabled,
    }


@app.post("/config")
async def set_config(
    data: dict,
    _: Annotated[None, Depends(verify_token)],
) -> dict:
    """Update runtime configuration and persist to database."""
    global _current_asr_api_key, _current_llm_api_key, _user_config
    cfg = _user_config or UserConfig()

    new_asr_key = data.get("asr_api_key", data.get("api_key"))
    if new_asr_key is not None:
        _current_asr_api_key = new_asr_key if new_asr_key else None
        cfg.asr_api_key = _current_asr_api_key

    new_llm_key = data.get("llm_api_key")
    if new_llm_key is not None:
        _current_llm_api_key = new_llm_key if new_llm_key else None
        cfg.llm_api_key = _current_llm_api_key

    if "asr_base_url" in data:
        cfg.asr_base_url = data["asr_base_url"] or cfg.asr_base_url
    if "asr_model" in data:
        cfg.asr_model = data["asr_model"] or cfg.asr_model
    if "llm_enabled" in data:
        cfg.llm_enabled = bool(data["llm_enabled"])
    if "llm_base_url" in data:
        cfg.llm_base_url = data["llm_base_url"] or cfg.llm_base_url
    if "llm_model" in data:
        cfg.llm_model = data["llm_model"] or cfg.llm_model
    if "hotkey" in data:
        cfg.hotkey = data["hotkey"] or cfg.hotkey
    if "ui_language" in data:
        cfg.ui_language = data["ui_language"] or cfg.ui_language
    if "asr_language" in data:
        cfg.asr_language = data["asr_language"] or cfg.asr_language
    if "vad_enabled" in data:
        cfg.vad_enabled = bool(data["vad_enabled"])

    _user_config = cfg
    await save_user_config(cfg)

    return {
        "status": "ok",
        "asr_api_key_set": _resolve_asr_api_key() is not None,
        "llm_api_key_set": _resolve_llm_api_key() is not None,
        "asr_base_url": cfg.asr_base_url,
        "asr_model": cfg.asr_model,
        "llm_enabled": cfg.llm_enabled,
        "llm_base_url": cfg.llm_base_url,
        "llm_model": cfg.llm_model,
        "hotkey": cfg.hotkey,
        "ui_language": cfg.ui_language,
        "asr_language": cfg.asr_language,
        "vad_enabled": cfg.vad_enabled,
    }


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/test-asr-key")
async def test_asr_key(
    _: Annotated[None, Depends(verify_token)],
) -> dict:
    """Test whether the current API key is accepted by the ASR service."""
    import httpx

    api_key = _resolve_asr_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="No API key configured")

    cfg = _user_config or UserConfig()

    try:
        # Send a short valid WAV probe so auth is tested without relying on a
        # malformed or empty audio file that can trigger service-side 5xx errors.
        import base64

        audio_b64 = base64.b64encode(_build_asr_probe_wav()).decode("utf-8")
        data_url = f"data:audio/wav;base64,{audio_b64}"

        payload = {
            "model": cfg.asr_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": data_url,
                                "format": "wav",
                            },
                        },
                    ],
                },
            ],
        }

        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            response = await client.post(
                f"{cfg.asr_base_url.rstrip('/')}/chat/completions",
                json=payload,
                headers={"Content-Type": "application/json", "api-key": api_key},
            )
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="ASR service timed out") from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"ASR connection error: {exc}"
        ) from exc

    if response.status_code == 401:
        raise HTTPException(
            status_code=401, detail="Authentication failed — API key rejected by ASR service"
        )
    if response.status_code >= 500:
        raise HTTPException(
            status_code=502, detail=f"ASR service error: HTTP {response.status_code}"
        )

    # 4xx other than 401 usually means the audio was too short / malformed,
    # which proves the key is valid (auth passed).
    return {
        "valid": True,
        "asr_status": response.status_code,
        "message": "API key is valid (ASR accepted the request)",
    }


@app.get("/test-llm-key")
async def test_llm_key(
    _: Annotated[None, Depends(verify_token)],
) -> dict:
    """Test whether the current OpenAI-compatible LLM settings work."""
    import httpx

    started_at = time.perf_counter()
    api_key = _resolve_llm_api_key()
    if not api_key:
        logger.warning(
            "llm_probe_failed",
            error_type="config_error",
            duration_ms=0,
        )
        raise HTTPException(status_code=400, detail="No LLM API key configured")

    cfg = _user_config or UserConfig()
    url = f"{cfg.llm_base_url.rstrip('/')}/chat/completions"
    logger.info(
        "llm_probe_started",
        model=cfg.llm_model,
        base_url=cfg.llm_base_url,
    )

    payload = {
        "model": cfg.llm_model,
        "messages": [
            {
                "role": "user",
                "content": "只回复 ok",
            }
        ],
        "temperature": 0,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
            response = await client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        logger.warning(
            "llm_probe_failed",
            error_type="llm_timeout",
            duration_ms=duration_ms,
        )
        raise HTTPException(status_code=504, detail="LLM service timed out") from exc
    except Exception as exc:
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        logger.warning(
            "llm_probe_failed",
            error_type="network_error",
            duration_ms=duration_ms,
        )
        raise HTTPException(
            status_code=502, detail=f"LLM connection error: {exc}"
        ) from exc

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    if response.status_code in (401, 403):
        logger.warning(
            "llm_probe_failed",
            error_type="llm_auth_error",
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        raise HTTPException(
            status_code=401,
            detail="Authentication failed — API key rejected by LLM service",
        )
    if response.status_code >= 500:
        logger.warning(
            "llm_probe_failed",
            error_type="llm_server_error",
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        raise HTTPException(
            status_code=502, detail=f"LLM service error: HTTP {response.status_code}"
        )
    if response.status_code >= 400:
        logger.warning(
            "llm_probe_failed",
            error_type="llm_invalid_request",
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        detail = response.text[:200]
        raise HTTPException(
            status_code=400,
            detail=f"LLM request rejected: HTTP {response.status_code} {detail}",
        )

    try:
        data = response.json()
        data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        logger.warning(
            "llm_probe_failed",
            error_type="llm_invalid_response",
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        raise HTTPException(
            status_code=502,
            detail="LLM returned malformed response",
        ) from exc

    logger.info(
        "llm_probe_succeeded",
        status_code=response.status_code,
        duration_ms=duration_ms,
        model=cfg.llm_model,
    )
    return {
        "valid": True,
        "llm_status": response.status_code,
        "message": "LLM key is valid (OpenAI-compatible request accepted)",
    }


@app.get("/protected")
async def protected_route(token: Annotated[None, Depends(verify_token)]) -> dict:
    """Protected route for testing token validation."""
    return {"message": "authenticated"}


@app.get("/prompts")
async def get_prompts(
    _: Annotated[None, Depends(verify_token)],
) -> list[dict]:
    """List all prompt templates."""
    return await list_prompts()


@app.get("/dictionary")
async def get_dictionary(
    _: Annotated[None, Depends(verify_token)],
    category: str | None = None,
) -> list[dict]:
    """List all dictionary entries, optionally filtered by category."""
    return await list_entries(category=category)


@app.post("/dictionary")
async def create_dictionary_entry(
    data: dict,
    _: Annotated[None, Depends(verify_token)],
) -> dict:
    """Create a new dictionary entry."""
    canonical_term = data.get("canonical_term", "").strip()
    if not canonical_term:
        raise HTTPException(status_code=400, detail="canonical_term is required")
    return await create_entry(
        canonical_term=canonical_term,
        aliases=data.get("aliases"),
        notes=data.get("notes"),
        category=data.get("category"),
        enforcement_level=data.get("enforcement_level", "suggested"),
        pronunciation=data.get("pronunciation"),
    )


@app.put("/dictionary/{entry_id}")
async def update_dictionary_entry(
    entry_id: int,
    data: dict,
    _: Annotated[None, Depends(verify_token)],
) -> dict:
    """Update an existing dictionary entry."""
    entry = await update_entry(
        entry_id,
        canonical_term=data.get("canonical_term"),
        pronunciation=data.get("pronunciation"),
        aliases=data.get("aliases"),
        notes=data.get("notes"),
        category=data.get("category"),
        enforcement_level=data.get("enforcement_level"),
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@app.delete("/dictionary/{entry_id}")
async def delete_dictionary_entry(
    entry_id: int,
    _: Annotated[None, Depends(verify_token)],
) -> dict:
    """Delete a dictionary entry."""
    deleted = await delete_entry(entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"status": "deleted", "id": entry_id}


@app.get("/history")
async def get_history(
    _: Annotated[None, Depends(verify_token)],
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """List dictation history sessions."""
    return await list_sessions(limit=limit, offset=offset)


@app.post("/history/{session_id}/retry")
async def retry_session(
    session_id: str,
    _: Annotated[None, Depends(verify_token)],
) -> dict:
    """Retry a failed dictation session without re-recording.

    Looks up the session by ID. If ``raw_text`` exists, re-runs the
    polish + inject pipeline and creates a new history record.
    """
    session = await get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.get("raw_text"):
        raise HTTPException(
            status_code=400,
            detail="No raw_text available for retry — the session failed before transcription",
        )

    orchestrator = get_orchestrator()
    return await orchestrator.retry_from_text(session["raw_text"])


@app.get("/diagnostics/export")
async def diagnostics_export(
    _: Annotated[None, Depends(verify_token)],
) -> Response:
    """Export diagnostic data as a zip file download.

    Includes: latest log file, user config (with API keys redacted), and
    the last 20 history records.
    """
    bundle = await build_diagnostics_bundle()
    return Response(
        content=bundle.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=asr-linux-diagnostics.zip",
        },
    )


@app.post("/dictation/start")
async def start_dictation(
    _: Annotated[None, Depends(verify_token)],
) -> dict:
    """Start recording audio. Returns session_id.

    Idempotent: if already recording, returns the existing session_id.
    """
    if _dictation_processing_lock.locked():
        raise HTTPException(
            status_code=409,
            detail="Dictation processing is still running",
        )

    cfg = _user_config or UserConfig()
    recorder = get_recorder(vad_enabled=cfg.vad_enabled)
    session_id = await recorder.start()
    return {"status": "started", "session_id": session_id}


@app.get("/dictation/level")
async def dictation_level(
    _: Annotated[None, Depends(verify_token)],
) -> dict:
    """Get current microphone audio level."""
    recorder = get_recorder()
    level = await recorder.get_level()
    return {"level": level, "recording": recorder.is_recording}


@app.post("/dictation/stop")
async def stop_dictation(
    _: Annotated[None, Depends(verify_token)],
) -> dict:
    """Stop recording and process the audio.

    Idempotent: if not currently recording, returns a no-op response
    so the caller knows there is nothing to process.
    """
    if _dictation_processing_lock.locked():
        raise HTTPException(
            status_code=409,
            detail="Dictation processing is still running",
        )

    async with _dictation_processing_lock:
        recorder = get_recorder()
        audio_path = await recorder.stop()

        if audio_path is None:
            return {
                "status": "idle",
                "message": "Not recording — nothing to stop",
            }

        # Read audio file
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        if len(audio_bytes) == 0:
            return {
                "status": "failed",
                "error": "Recorded audio is empty. Check microphone input and alsamixer settings.",
                "error_type": "EmptyAudio",
            }

        # Process through pipeline
        orchestrator = get_orchestrator()
        result = await orchestrator.process(audio_bytes)
        return result


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time events."""
    if not await verify_ws_token(websocket):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    _ws_connections.append(websocket)

    try:
        await websocket.send_json({"type": "connected"})

        while True:
            # Keep connection alive and explicitly handle close frames.  Some
            # TestClient/runtime combinations do not unwind ``receive_text()``
            # cleanly on context exit, while raw receive exposes disconnects.
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            text = message.get("text")
            if text == "__close__":
                break
            if text == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _ws_connections:
            _ws_connections.remove(websocket)


@app.post("/broadcast")
async def broadcast_event(
    event: dict,
    token: Annotated[None, Depends(verify_token)],
) -> dict:
    """Broadcast an event to all connected WebSocket clients."""
    disconnected = []
    for ws in _ws_connections:
        try:
            await ws.send_json(event)
        except Exception:
            disconnected.append(ws)

    for ws in disconnected:
        if ws in _ws_connections:
            _ws_connections.remove(ws)

    return {"status": "broadcasted", "clients": len(_ws_connections)}
