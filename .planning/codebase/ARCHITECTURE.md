<!-- refreshed: 2026-06-05 -->
# Architecture

**Analysis Date:** 2026-06-05

## System Overview

ASR Linux is a desktop voice-input application for Linux composed of two cooperating processes:

- **Electron desktop shell** — owns windows, tray, global hotkeys, renderer UI, and backend lifecycle.
- **Python FastAPI backend** — owns audio capture, cloud ASR/LLM integration, text injection, persistence, and the dictation state machine.

The two processes communicate over localhost HTTP and WebSocket. The backend binds to `127.0.0.1` on an ephemeral port and emits a session token on stdout; the main process discovers both values and includes the token in every request header.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Backend Supervisor  │  Hotkey Adapter  │  Window Manager   │  │
│  │  src/electron/main/...                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│           IPC (contextBridge)│                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Renderer Process (Chromium)                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │  │
│  │  │ Dashboard│ │ Dictate  │ │ History  │ │ Settings │        │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │  │
│  │  ┌──────────┐ ┌──────────┐                                   │  │
│  │  │  Overlay │ │ Settings │  (separate BrowserWindows)        │  │
│  │  │  Window  │ │  Window  │                                   │  │
│  │  └──────────┘ └──────────┘                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP + WebSocket (localhost)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Python FastAPI Backend                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  Audio   │  │  ASR     │  │  Polish  │  │  Text    │          │
│  │ Recorder │  │  Client  │  │  Client  │  │ Injector │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │             │             │             │                  │
│       └─────────────┴─────────────┴─────────────┘                  │
│                     │                                              │
│                     ▼                                              │
│       ┌─────────────────────┐                                     │
│       │ DictationOrchestrator│  (state machine + pipeline)        │
│       └─────────────────────┘                                     │
│                     │                                              │
│       ┌─────────────┴─────────────┐                               │
│       ▼                             ▼                             │
│  ┌──────────┐                ┌──────────┐                        │
│  │ History  │                │ Prompt + │                        │
│  │  Store   │                │Dictionary│                        │
│  └──────────┘                └──────────┘                        │
│       │                             │                             │
│       └─────────────┬───────────────┘                             │
│                     ▼                                              │
│            ┌──────────────┐                                       │
│            │   SQLite DB  │  (~/.local/share/asr-linux/)          │
│            └──────────────┘                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Backend Supervisor | Spawns Python process, parses port/token from stdout, forwards requests | `src/electron/main/backend-supervisor.ts` |
| Main Process | Owns app lifecycle, tray, window creation, hotkey registration | `src/electron/main/main.ts` |
| Preload | Typed IPC bridge exposing only approved APIs to renderer | `src/electron/preload/preload.cts` |
| Settings Renderer | React app with tabs for Dashboard, Dictate, History, Settings | `src/electron/renderer/app.tsx` |
| Overlay Renderer | Minimal always-on-top window showing pipeline phase and mic level | `src/electron/renderer/overlay-app.tsx` |
| FastAPI App | HTTP routes, WebSocket endpoint, auth, config, diagnostics | `src/backend/main.py` |
| Dictation Orchestrator | State machine: recording → ASR → polish → inject → history | `src/backend/dictation_orchestrator.py` |
| Audio Recorder | ALSA `arecord` subprocess capture + VU-meter level parsing | `src/backend/audio_recorder.py` |
| ASR Client | Cloud ASR (MiMo / OpenAI-compatible) with retry + error classification | `src/backend/asr_client.py` |
| Polish Client | LLM text polish with prompt templating + dictionary context | `src/backend/polish_client.py` |
| Text Injector | X11 clipboard + `xdotool` paste into focused window | `src/backend/text_injector.py` |
| History Store | SQLite persistence of session metadata and retry support | `src/backend/history_store.py` |
| Prompt Manager | CRUD for prompt templates and active-prompt selection | `src/backend/prompt_manager.py` |
| Dictionary Manager | Term storage + relevance matching (text + pinyin fuzzy) | `src/backend/dictionary_manager.py` |

## Pattern Overview

**Overall:** Two-process desktop app with a clean service boundary.

**Key Characteristics:**
- Renderer never calls cloud APIs directly; all external traffic goes through the backend.
- Backend never renders GUI; all UI lives in Electron renderer processes.
- State is pushed from backend to frontend via WebSocket `status_update` events.
- API keys are stored in Linux Secret Service when available, with SQLite fallback.
- The dictation pipeline is sequential and async, guarded by an `asyncio.Lock` to prevent overlapping sessions.

## Layers

**Electron Shell (Presentation):**
- Purpose: Windows, hotkeys, tray, renderer hosting, backend lifecycle.
- Location: `src/electron/`
- Contains: TypeScript main-process code, React renderer pages, preload bridge.
- Depends on: Python backend (HTTP + WebSocket).
- Used by: End user.

**Backend API (Transport):**
- Purpose: FastAPI HTTP routes and WebSocket for real-time events.
- Location: `src/backend/main.py`
- Contains: Route handlers, token validation, dependency injection of singletons.
- Depends on: All backend service modules.
- Used by: Electron main process (via `backend-supervisor.ts`).

**Backend Services (Domain):**
- Purpose: Dictation orchestration, audio capture, cloud clients, text injection, persistence.
- Location: `src/backend/`
- Contains: Module-per-concern service classes and functions.
- Depends on: SQLite, ALSA (`arecord`), X11 tools (`xdotool`, `xsel`, `xclip`), cloud HTTP APIs.
- Used by: FastAPI route handlers.

**Data Layer (Persistence):**
- Purpose: SQLite storage for config, prompts, dictionary, history.
- Location: `~/.local/share/asr-linux/asr-linux.db`
- Contains: Tables `user_config`, `prompts`, `dictionary`, `history`, `migrations`.
- Depends on: Local filesystem.
- Used by: Config store, prompt manager, dictionary manager, history store.

## Data Flow

### Primary Dictation Path

1. **Hotkey trigger** — global shortcut registered in Electron main (`main.ts`) fires `toggle-dictation` IPC event.
2. **Start request** — renderer (or main) calls `voiceAPI.startDictation()` which POSTs `/dictation/start` to backend.
3. **Record audio** — `AudioRecorder.start()` spawns `arecord`, monitors VU-meter levels on stderr, and returns a `session_id`.
4. **Level streaming** — renderer polls `/dictation/level` and/or receives WebSocket events to show the waveform.
5. **Stop request** — `voiceAPI.stopDictation()` POSTs `/dictation/stop`.
6. **Pipeline execution** (`dictation_orchestrator.py`):
   a. Save WAV file from `arecord`.
   b. **ASR** — `ASRClient.transcribe()` sends base64-encoded audio to cloud ASR; on success stores `raw_text`.
   c. **Dictionary lookup** — `find_relevant_entries()` matches canonical terms / aliases / pinyin against `raw_text`.
   d. **Polish** — `PolishClient.polish()` sends `raw_text` + prompt template + dictionary context to LLM; returns `polished_text`.
   e. **Inject** — `TextInjector.inject()` saves clipboard, sets new text, simulates `ctrl+v` (or `ctrl+shift+v` for terminals).
   f. **History** — `history_store.update_session()` writes final state and timing.
7. **Status broadcast** — each phase emits a WebSocket `status_update` event so overlay and settings UIs update in real time.
8. **Result display** — renderer shows raw/polished text or error info.

### Configuration Update Path

1. User edits settings in `SettingsPage.tsx`.
2. Renderer POSTs `/config` with new values (e.g., API keys, hotkey, LLM toggle).
3. Backend persists to SQLite (`config_store.py`) and Linux Secret Service (`secret_store.py`) for keys.
4. `get_orchestrator()` in `main.py` detects config fingerprint change on next dictation and rebuilds clients.

### Retry Path

1. User clicks retry on a failed session in `HistoryPage.tsx`.
2. Renderer POSTs `/history/{session_id}/retry`.
3. Backend loads the old session’s `raw_text` and runs polish + inject without re-recording.
4. A new history record is created; the old session is marked with `retried:{new_id}`.

## Key Abstractions

**DictationOrchestrator:**
- Purpose: Owns the entire pipeline state machine and coordinates all domain services.
- Examples: `src/backend/dictation_orchestrator.py`
- Pattern: Orchestrator / Mediator — it holds references to ASR, Polish, and Injector clients and calls them in sequence.

**AudioRecorder:**
- Purpose: Encapsulates ALSA subprocess lifecycle and real-time audio level monitoring.
- Examples: `src/backend/audio_recorder.py`
- Pattern: Adapter — wraps `arecord` CLI in an async class with start/stop/level APIs.

**ASRClient / PolishClient:**
- Purpose: Abstract cloud API communication with retry, timeout, and error classification.
- Examples: `src/backend/asr_client.py`, `src/backend/polish_client.py`
- Pattern: Gateway / Client — each wraps a single external HTTP API.

**TextInjector:**
- Purpose: Abstract X11 desktop text insertion.
- Examples: `src/backend/text_injector.py`
- Pattern: Adapter — wraps `xdotool`, `xsel`, `xclip` into an async inject API.

**Backend Supervisor:**
- Purpose: Bridge between Electron main and the Python backend process.
- Examples: `src/electron/main/backend-supervisor.ts`
- Pattern: Process Manager — spawns, monitors, and proxies HTTP to the child process.

## Entry Points

**Electron Main:**
- Location: `src/electron/main/main.ts`
- Triggers: `npm run dev` (or packaged app launch)
- Responsibilities: Create main BrowserWindow, start backend supervisor, register global hotkey, create tray icon, handle IPC.

**Python Backend:**
- Location: `src/backend/main.py`
- Triggers: Spawned by Electron main process (`python -m backend.main` or equivalent)
- Responsibilities: Start Uvicorn on `127.0.0.1:0` (ephemeral), print `PORT=<port> TOKEN=<token>` to stdout, serve HTTP + WebSocket.

**Renderer Settings App:**
- Location: `src/electron/renderer/app.tsx`
- Triggers: Loaded by main BrowserWindow (`index.html`)
- Responsibilities: Tab-based UI (Dashboard, Dictate, History, Settings), fetch backend config, subscribe to WebSocket events.

**Renderer Overlay App:**
- Location: `src/electron/renderer/overlay-app.tsx`
- Triggers: Loaded by overlay BrowserWindow (`overlay.html`)
- Responsibilities: Minimal always-on-top UI showing current pipeline phase and microphone level.

## Architectural Constraints

- **Threading:** Single-threaded async event loop in Python (asyncio). Heavy I/O is offloaded to subprocesses (`arecord`) or HTTP clients (`httpx.AsyncClient`).
- **Global state:** Module-level singletons in `main.py` (`_recorder`, `_orchestrator`, `_ws_connections`, `_user_config`). These are managed via FastAPI dependency functions and an `asyncio.Lock` (`_dictation_processing_lock`) to prevent concurrent dictation sessions.
- **Port binding:** Backend must bind to `127.0.0.1` with ephemeral port `0`; Electron discovers the actual port from stdout.
- **Authentication:** All backend routes (except `/health`) require `x-token` header matching the runtime-generated secret. WebSocket uses `?token=` query param.
- **Clipboard ownership:** `xclip` acts as a clipboard owner process; `ClipboardManager` uses bounded loops and timeouts to avoid hanging the pipeline.
- **No cross-process shared memory:** All state transfer is HTTP/WebSocket or filesystem (SQLite, WAV files).

## Anti-Patterns

### Renderer Directly Fetching Backend

**What happens:** Some renderer code (e.g., `SettingsPage.tsx`) uses raw `fetch()` directly against the backend URL instead of going through the preload bridge.
**Why it's wrong:** It bypasses the typed IPC abstraction and makes URL/token plumbing scattered across components.
**Do this instead:** Route all backend communication through `window.voiceAPI` methods defined in `preload.cts`, or centralize fetch logic in a single service module.

### Module-Level Mutable Singletons Without Locking

**What happens:** `_recorder`, `_orchestrator`, and `_user_config` are mutable module globals in `main.py`.
**Why it's wrong:** Concurrent requests could observe half-initialized state or race on updates.
**Do this instead:** The `_dictation_processing_lock` currently guards the critical section; any expansion of shared state should use explicit locks or async-safe containers.

## Error Handling

**Strategy:** Categorized exceptions with structured logging. Each pipeline stage catches its own errors, updates session status, broadcasts failure via WebSocket, and returns a degraded result rather than crashing.

**Patterns:**
- `ASRError` and `PolishError` carry `error_category` (`auth`, `timeout`, `rate_limit`, `server_error`, `malformed`, `unknown`).
- Retry policy (`RetryPolicy`) applies exponential backoff with jitter only to retryable categories.
- Non-retryable errors (e.g., 401 auth) fail fast and surface to the user immediately.
- Injection failures fall back to clipboard (text is left on the system clipboard for manual paste).

## Cross-Cutting Concerns

**Logging:** Structured JSON Lines via `structlog`. Secret redaction is applied globally. Logs rotate at 10 MB with 5 backups. Location: `~/.local/share/asr-linux/logs/asr-linux.log`.

**Validation:** Pydantic `BaseSettings` for env/config validation. FastAPI validates request bodies automatically.

**Authentication:** Token-based localhost auth. Token is generated at startup and passed to Electron via stdout. No user login or OAuth.

**Internationalization:** Lightweight React context in `src/electron/renderer/lib/i18n.ts` supporting `zh` and `en`. UI language is persisted in `user_config`.

---

*Architecture analysis: 2026-06-05*
