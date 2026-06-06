# Technology Stack

**Analysis Date:** 2026-06-05

## Languages

**Primary:**
- **TypeScript** ~5.4 — Electron main process, preload, renderer UI (`src/electron/`)
- **Python** >=3.11 — Backend API, audio processing, text injection (`src/backend/`)

**Secondary:**
- **CSS/Tailwind** — Styling via Tailwind CSS 3.4 with custom design tokens
- **HTML** — Renderer entry points (`index.html`, `overlay.html`)

## Runtime

**Frontend Environment:**
- **Electron** 30.0.0 — Desktop shell, tray, global hotkeys, multi-window management
- **Node.js** ~20 (implied by `@types/node^20.12`)

**Backend Environment:**
- **CPython** >=3.11 — FastAPI server spawned as child process by Electron
- **Uvicorn** >=0.29 (standard) — ASGI server running on `127.0.0.1:0` (random port)

**Package Managers:**
- **npm** — Node.js dependencies (`package.json`, `package-lock.json`)
- **uv** — Python dependencies (`pyproject.toml`, `uv.lock`)
- **Virtual env:** `.venv/` (Python)

## Frameworks

**Core Frontend:**
- **React** 18.3 — UI framework for settings window and overlay
- **FastAPI** 0.110 — Python web framework for backend API
- **Pydantic** 2.6 + Pydantic-Settings 2.2 — Configuration validation and env var loading

**UI/UX:**
- **Tailwind CSS** 3.4.19 — Utility-first CSS framework
- **Framer Motion** 12.40 — Page transitions and animations
- **Lucide React** 1.17 — Icon library

**Build/Dev:**
- **Vite** 4.7 — Renderer build tool with React plugin, multi-page build (`index.html`, `overlay.html`)
- **TypeScript Compiler** 5.4 — Type checking and main/preload compilation (`tsc`)
- **PostCSS** 8.5 + Autoprefixer 10.5 — CSS processing pipeline

**Testing:**
- **Vitest** 1.6 — Frontend test runner with jsdom environment
- **Testing Library** (React, DOM, Jest-DOM, User-Event) — Component testing
- **pytest** 8.0 + pytest-asyncio 0.23 — Backend test runner
- **respx** 0.21 — HTTPX mock library for backend API tests

## Key Dependencies

**Critical Runtime:**
- `electron` 30.0.0 — Desktop app shell, BrowserWindow, Tray, globalShortcut, IPC
- `fastapi` 0.110 — HTTP API framework with WebSocket support
- `uvicorn[standard]` 0.29 — ASGI server (uvloop + websockets)
- `httpx` 0.27 — Async HTTP client for ASR and LLM API calls
- `structlog` 24.1 — Structured JSON logging with sensitive data redaction
- `pypinyin` 0.53 — Chinese pinyin conversion (dictionary pronunciation support)

**Frontend UI:**
- `react` / `react-dom` 18.3 — Component framework
- `framer-motion` — Animations (page transitions, toast, recording pulse)
- `lucide-react` — Icons
- `@fontsource/inter`, `@fontsource/jetbrains-mono`, `@fontsource/space-grotesk` — Self-hosted fonts

**Dev/Build:**
- `typescript` 5.4 — Type system
- `@vitejs/plugin-react` — Vite React fast refresh
- `tailwindcss` + `tailwind-merge` + `clsx` — CSS utilities and class merging
- `jsdom` — DOM environment for Vitest

**Python Dev:**
- `ruff` 0.4 — Python linter (E, F, W, I, N, UP, B, C4, SIM rules)
- `pytest-cov` 7.1 — Coverage reporting

## Configuration

**Environment Variables (Backend):**
- `ASR_LINUX_LOG_LEVEL` — Logging level (`info`/`debug`/`trace`)
- `ASR_LINUX_HOST` — Bind host (default `127.0.0.1`)
- `ASR_LINUX_PORT` — Bind port (default `0` for random)
- `ASR_LINUX_SECRET_TOKEN` — API authentication token
- `ASR_LINUX_DATA_DIR` — Data directory (XDG or `~/.local/share/asr-linux`)
- `ASR_LINUX_MIMO_API_KEY` — ASR service API key
- `ASR_LINUX_LLM_API_KEY` — LLM service API key
- `ASR_LINUX_AUDIO_*` — Audio recording parameters
- `ASR_LINUX_ASR_LANGUAGE` — ASR language (`zh`/`en`/`auto`)
- `.env` file support via Pydantic-Settings

**Build Configuration:**
- `tsconfig.json` — ES2022, NodeNext module resolution, React JSX, strict mode
- `vite.renderer.config.ts` — Multi-page Vite build (index + overlay)
- `vitest.config.ts` — jsdom environment, i18n alias resolution
- `postcss.config.js` — Tailwind + Autoprefixer pipeline
- `pyproject.toml` — Python project metadata, pytest config, ruff lint rules

## Platform Requirements

**Development:**
- Linux desktop with X11 (Wayland not supported)
- Node.js 20+ and npm
- Python 3.11+ with uv
- ALSA (`arecord`) for audio recording
- X11 tools: `xdotool`, `xsel` or `xclip`, `xprop`
- Optional: `secret-tool` (libsecret) for keyring integration

**Production/Deployment:**
- Electron-packaged Linux desktop application
- Python backend bundled in `.venv` or system Python
- All X11/ALSA dependencies must be present on target system
- No containerization or cloud deployment path currently defined

## Notable Architectural Patterns

- **Custom async SQLite wrapper** (`src/backend/sqlite_async.py`) — Avoids `aiosqlite` worker-thread hang
- **Electron spawns Python backend** as child process (`BackendSupervisor`) — Parses uvicorn stdout for dynamic port
- **ContextBridge IPC** — Strict isolation between main and renderer; no `nodeIntegration`
- **Dual-window architecture** — Settings window (900x600) + frameless overlay (400x80, always-on-top)

---

*Stack analysis: 2026-06-06 (refreshed)*
