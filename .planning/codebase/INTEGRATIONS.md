# External Integrations

**Analysis Date:** 2026-06-05

## APIs & External Services

**ASR (Automatic Speech Recognition):**
- **Service:** MiMo ASR API (Xiaomi / xiaomimimo.com)
- **Endpoint:** `https://token-plan-cn.xiaomimimo.com/v1/chat/completions`
- **Protocol:** OpenAI-compatible chat completions with `input_audio` content type
- **Authentication:** `api-key` header
- **Default Model:** `mimo-v2.5-asr`
- **Client:** `src/backend/asr_client.py` — ASRClient class with retry policy
- **Env Var:** `ASR_LINUX_MIMO_API_KEY` (runtime config or DB also accepted)
- **Test Probe:** `/test-asr-key` endpoint sends a synthetic WAV to validate auth

**LLM Text Polish:**
- **Service:** OpenAI-compatible API (configurable)
- **Default Endpoint:** `https://api.openai.com/v1/chat/completions`
- **Default Model:** `gpt-4o-mini`
- **Authentication:** `Authorization: Bearer <token>` header
- **Client:** `src/backend/polish_client.py` — PolishClient with regex pre-processing + LLM post-processing
- **Env Var:** `ASR_LINUX_LLM_API_KEY` or `OPENAI_API_KEY`
- **Features:** Filler word stripping (regex), conservative cleanup prompt, dictionary term injection, retry policy
- **Test Probe:** `/test-llm-key` endpoint sends a minimal Chinese prompt

**HTTP Client:**
- **Library:** `httpx` 0.27 (async)
- **Timeout:** 30s default for ASR/polish, 15s for test probes
- **Retry Policy:** Exponential backoff for timeouts, 5xx, and 429 errors (`src/backend/retry_policy.py`)

## Data Storage

**Primary Database:**
- **Type:** SQLite (stdlib `sqlite3` via custom async wrapper)
- **Location:** `~/.local/share/asr-linux/asr-linux.db` (XDG_DATA_HOME respected)
- **Wrapper:** `src/backend/sqlite_async.py` — Custom `Connection`/`Cursor` facade
- **Schema:** prompts, dictionary, history, user_config tables with manual migration baseline

**File Storage:**
- **Recordings:** `~/.local/share/asr-linux/recordings/<session_id>.wav`
- **Logs:** `~/.local/share/asr-linux/logs/asr-linux.log` (rotating, 10MB × 5 backups)
- **No cloud file storage integration**

**Caching:**
- None detected — no Redis, memcached, or in-memory cache beyond singleton instances

## Authentication & Identity

**API Security:**
- **Method:** Shared secret token (`x-token` header for HTTP, `token` query param for WebSocket)
- **Token Source:** Electron `BackendSupervisor` generates a random token on startup; injected into backend env
- **Backend Config:** `ASR_LINUX_SECRET_TOKEN` env var (optional — if unset, no auth required)
- **No OAuth, JWT, or user identity system**

**Secret Storage:**
- **Primary:** SQLite `user_config` table (API keys stored in plaintext)
- **Optional:** Linux Secret Service (`secret-tool` / libsecret) via `src/backend/secret_store.py`
- **Fallback behavior:** If `secret-tool` unavailable, falls back to SQLite persistence
- **Redaction:** `structlog` processors mask `api_key`, `token`, `secret`, `password` keys in logs

## Linux Desktop Integration

**Audio Subsystem:**
- **Interface:** ALSA via `arecord` command-line tool
- **Features:** VU meter monitoring (`--vumeter=stereo`), silence auto-stop, max duration cap (5 min)
- **Format:** 16-bit PCM mono WAV @ 16kHz (configurable)
- **No PulseAudio or PipeWire direct integration** (relies on ALSA compatibility layer)

**X11 Integration:**
- **Window Manager:** X11 only (`xdotool`, `xprop`)
- **Text Injection:** `xdotool key` for paste simulation (Ctrl+V / Ctrl+Shift+V for terminals)
- **Clipboard:** `xsel` (preferred) or `xclip` for save/restore/set operations
- **Window Detection:** `xprop WM_CLASS` for terminal detection
- **No Wayland support** (`xdotool` is X11-only)

**Global Hotkeys:**
- **Implementation:** Electron `globalShortcut` API
- **Default:** `Alt+=`
- **Fallbacks:** `F12`, `F10`, `F9`, `F11`, `Ctrl+Shift+R`
- **Persistence:** Stored in SQLite `user_config.hotkey`

**System Tray:**
- **Implementation:** Electron `Tray` with `nativeImage` icon
- **Features:** Show window, Quit, double-click support
- **Behavior:** Close button hides to tray; app runs backgrounded

## Monitoring & Observability

**Logging:**
- **Framework:** `structlog` 24.1 with JSON Lines output
- **Features:** ISO timestamps, log level uppercase, automatic sensitive key redaction, exception rendering
- **Destinations:** Rotating file + stdout
- **Levels:** info / debug / trace (configurable via `ASR_LINUX_LOG_LEVEL`)
- **Log File:** `~/.local/share/asr-linux/logs/asr-linux.log`

**Diagnostics:**
- **Endpoint:** `GET /diagnostics/export` — Returns ZIP with logs, redacted config, last 20 history records
- **No external error tracking** (Sentry, Rollbar, etc. not integrated)

**Health Check:**
- **Endpoint:** `GET /health` — Returns `{"status": "ok"}`

## CI/CD & Deployment

**Version Control:**
- **Platform:** Git (no `.github/` directory — no GitHub Actions, issues, or PR templates detected)

**Build Process:**
- **Frontend:** `npm run build` → `tsc` + `vite build` → `dist/electron/`
- **Backend:** No build step; Python source run directly via `uv run python -m uvicorn`
- **No automated CI/CD pipeline detected**
- **No containerization** (Dockerfile, docker-compose not present)

**Distribution:**
- **Target:** Electron-packaged Linux desktop app
- **Method:** Manual or scripted packaging (no automated release pipeline)

## Environment Configuration

**Required System Dependencies:**
- `arecord` (alsa-utils) — Audio recording
- `xdotool` — Text injection / window detection
- `xsel` or `xclip` — Clipboard manipulation
- `xprop` — Window class detection
- `secret-tool` (optional) — Secure secret storage

**Required Environment Variables:**
- `ASR_LINUX_MIMO_API_KEY` or runtime config — ASR service access
- `ASR_LINUX_LLM_API_KEY` or `OPENAI_API_KEY` — LLM service access (optional if polish disabled)
- `ASR_LINUX_SECRET_TOKEN` — API authentication (optional)
- `PYTHONPATH=src` — Set by Electron supervisor when spawning backend

**Python Environment:**
- Backend spawned from `.venv/bin/python` (relative to project root)
- `uv run` or direct venv activation required for development

## Webhooks & Callbacks

**Incoming:**
- None — no external webhooks or callbacks received

**Outgoing:**
- None — no webhooks sent to external services
- **WebSocket:** Internal only (`/ws`) for real-time status updates from backend to Electron renderer

## Browser / Renderer Integration

**IPC Channels (Main ↔ Renderer):**
- `get-backend-config` — Returns `{url, token}`
- `start-dictation` / `stop-dictation` — Proxied to backend API
- `show-overlay` / `hide-overlay` — Overlay window visibility
- `status-update` (main→renderer) — Pipeline phase broadcasts
- `microphone-level` (main→renderer) — VU meter updates
- `toggle-dictation` (main→renderer) — Hotkey trigger
- `get-hotkey` / `set-hotkey` — Hotkey preference

**Context Isolation:**
- `contextIsolation: true`, `nodeIntegration: false` in all BrowserWindows
- Preload script (`preload.cts`) exposes `window.voiceAPI` via `contextBridge`

---

*Integration audit: 2026-06-05*
