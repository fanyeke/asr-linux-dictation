# Codebase Structure

**Analysis Date:** 2026-06-05

## Directory Layout

```
asr_linux/
├── src/
│   ├── backend/              # Python FastAPI backend
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── config.py         # Pydantic settings (env vars)
│   │   ├── config_store.py   # Persistent user config (SQLite + Secret Service)
│   │   ├── secret_store.py   # Linux Secret Service wrapper
│   │   ├── database.py       # SQLite schema & migration baseline
│   │   ├── sqlite_async.py   # Minimal async sqlite3 wrapper
│   │   ├── logging_config.py # structlog JSONL configuration
│   │   ├── diagnostics.py    # Diagnostic bundle export
│   │   ├── retry_policy.py   # Exponential backoff retry utility
│   │   ├── audio_recorder.py # ALSA arecord subprocess wrapper
│   │   ├── asr_client.py     # Cloud ASR HTTP client
│   │   ├── polish_client.py  # Cloud LLM polish HTTP client
│   │   ├── polish_sanitizer.py # LLM output cleanup
│   │   ├── dictation_orchestrator.py # Pipeline state machine
│   │   ├── text_injector.py  # X11 clipboard + xdotool injection
│   │   ├── clipboard_manager.py # Clipboard save/restore/set + fallback
│   │   ├── history_store.py  # Session history persistence
│   │   ├── prompt_manager.py # Prompt template CRUD
│   │   ├── dictionary_manager.py # Term storage + relevance matching
│   │   ├── profile_manager.py # Scene profiles CRUD + 5 presets
│   │   ├── ring_buffer.py    # PCM audio ring buffer for streaming ASR
│   │   └── transcript_merger.py # Overlapping partial transcript merge
│   └── electron/             # Electron desktop shell
│       ├── main/
│       │   ├── main.ts       # Main process entry point
│       │   └── backend-supervisor.ts # Python process supervisor
│       ├── preload/
│       │   ├── preload.cts   # ContextBridge IPC definitions
│       │   └── types.ts      # Preload TypeScript interfaces
│       └── renderer/
│           ├── app.tsx           # Settings window React root
│           ├── overlay-app.tsx   # Overlay window React root
│           ├── index.html        # Settings window HTML shell
│           ├── overlay.html      # Overlay window HTML shell
│           ├── tailwind.config.ts
│           ├── styles/
│           │   └── globals.css
│           ├── lib/
│           │   ├── i18n.ts     # Lightweight i18n context (zh/en)
│           │   └── utils.ts    # cn() helper (clsx + tailwind-merge)
│           ├── settings/
│           │   ├── settings-window.tsx
│           │   └── types.ts    # Shared renderer/backend types
│           ├── overlay/
│           │   ├── overlay-window.tsx
│           │   └── types.ts    # Overlay-specific types
│           └── components/
│               ├── DashboardPage.tsx
│               ├── DictatePage.tsx
│               ├── HistoryPage.tsx
│               ├── OnboardingWizard.tsx  # 4-step first-run setup (Phase 8)
│               ├── SettingsPage.tsx
│               ├── PhaseIndicator.tsx
│               ├── RecordingButton.tsx
│               ├── ResultDisplay.tsx
│               ├── SessionListItem.tsx
│               ├── TabSidebar.tsx
│               ├── Toast.tsx
│               ├── WaveformVisualizer.tsx
│               ├── __tests__/            # Component unit tests
│               ├── settings/             # Settings sub-components (Phase 6-9)
│               │   ├── ApiConfigSection.tsx
│               │   ├── DiagnosticsSection.tsx
│               │   ├── DictionaryManager.tsx
│               │   ├── HotkeySection.tsx
│               │   ├── ProfileManager.tsx
│               │   ├── PromptManager.tsx
│               │   └── VadSection.tsx
│               └── ui/                   # Reusable UI primitives
│                   ├── Badge.tsx
│                   ├── BarChart.tsx       # Dashboard chart (Phase 11)
│                   ├── Button.tsx
│                   ├── Card.tsx
│                   ├── EmptyState.tsx
│                   ├── Input.tsx
│                   ├── LineChart.tsx      # Dashboard latency chart (Phase 11)
│                   └── __tests__/
├── tests/
│   ├── backend/              # Python backend tests (pytest)
│   │   ├── conftest.py
│   │   ├── test_baseline.py
│   │   ├── test_api.py
│   │   ├── test_dictation_routes.py
│   │   ├── test_websocket.py
│   │   ├── test_config.py
│   │   ├── test_config_store.py
│   │   ├── test_database.py
│   │   ├── test_audio_recorder.py
│   │   ├── test_asr_client.py
│   │   ├── test_polish_client.py
│   │   ├── test_polish_sanitizer.py
│   │   ├── test_dictation_orchestrator.py
│   │   ├── test_text_injector.py
│   │   ├── test_clipboard_manager.py
│   │   ├── test_history_store.py
│   │   ├── test_history_retry.py
│   │   ├── test_prompt_manager.py
│   │   ├── test_dictionary_manager.py
│   │   ├── test_profile_manager.py
│   │   ├── test_ring_buffer.py
│   │   ├── test_transcript_merger.py
│   │   ├── test_streaming_orchestrator.py
│   │   ├── test_history_export.py
│   │   ├── test_history_search.py
│   │   ├── test_system_deps.py
│   │   ├── test_logging.py
│   │   ├── test_diagnostics.py
│   │   └── test_retry_policy.py
│   └── electron/             # Electron/frontend tests (vitest)
│       ├── backend-supervisor.test.ts
│       ├── baseline.test.ts
│       └── renderer/
│           ├── components/
│           │   ├── DictatePage.test.tsx
│           │   ├── RecordingButton.test.tsx
│           │   ├── WaveformVisualizer.test.tsx
│           │   ├── phase-indicator.test.tsx
│           │   ├── result-display.test.tsx
│           │   ├── tab-sidebar.test.tsx
│           │   ├── toast.test.tsx
│           │   └── history-page.test.tsx
│           ├── overlay/
│           │   └── overlay-window.test.tsx
│           └── settings/
│               └── settings-window.test.tsx
├── docs/
│   └── modules.md            # Module boundary definitions
├── package.json              # Node dependencies & scripts
├── pyproject.toml            # Python dependencies & tool config
├── vite.renderer.config.ts   # Vite build config for renderer
├── tsconfig.json             # TypeScript compiler config
└── .planning/
    └── codebase/             # This directory
```

## Directory Purposes

**`src/backend/`:**
- Purpose: All Python backend code — FastAPI app, services, persistence, utilities.
- Contains: `.py` modules, no sub-packages beyond the `backend` package root.
- Key files: `main.py`, `dictation_orchestrator.py`, `audio_recorder.py`, `asr_client.py`, `polish_client.py`, `text_injector.py`.

**`src/electron/main/`:**
- Purpose: Electron main-process code (Node.js context).
- Contains: `.ts` files for app lifecycle, backend supervision, window management.
- Key files: `main.ts`, `backend-supervisor.ts`.

**`src/electron/preload/`:**
- Purpose: Electron preload scripts that define the secure IPC bridge.
- Contains: `.cts` (CommonJS) preload script and shared TypeScript interfaces.
- Key files: `preload.cts`, `types.ts`.

**`src/electron/renderer/`:**
- Purpose: All renderer-process UI code (React + Tailwind).
- Contains: Page components, reusable UI primitives, window-specific entry points, utilities.
- Key files: `app.tsx`, `overlay-app.tsx`, `components/`, `lib/`, `settings/`, `overlay/`.

**`tests/backend/`:**
- Purpose: Python test suite using `pytest` + `pytest-asyncio`.
- Contains: One test file per backend module.
- Key files: `conftest.py` (shared fixtures), `test_dictation_orchestrator.py`, `test_api.py`.

**`tests/electron/`:**
- Purpose: Electron/frontend test suite using `vitest` + `@testing-library/react`.
- Contains: Main-process and renderer tests.
- Key files: `backend-supervisor.test.ts`, renderer component tests.

**`docs/`:**
- Purpose: Project documentation and design records.
- Contains: `modules.md` defining module boundaries and responsibilities.

## Key File Locations

**Entry Points:**
- `src/electron/main/main.ts` — Electron main process startup.
- `src/backend/main.py` — FastAPI/Uvicorn backend startup.
- `src/electron/renderer/app.tsx` — Settings BrowserWindow React root.
- `src/electron/renderer/overlay-app.tsx` — Overlay BrowserWindow React root.

**Configuration:**
- `package.json` — Node dependencies, build scripts, Electron entry point.
- `pyproject.toml` — Python dependencies, pytest config, ruff lint config.
- `vite.renderer.config.ts` — Vite bundler config for renderer assets.
- `tsconfig.json` — TypeScript compiler options.
- `src/electron/renderer/tailwind.config.ts` — Tailwind CSS theme config.
- `src/backend/config.py` — Pydantic settings loaded from env vars (`ASR_LINUX_*`).

**Core Logic:**
- `src/backend/dictation_orchestrator.py` — Pipeline orchestration and state machine.
- `src/backend/audio_recorder.py` — ALSA audio capture.
- `src/backend/asr_client.py` — Cloud ASR integration.
- `src/backend/polish_client.py` — Cloud LLM polish integration.
- `src/backend/text_injector.py` — X11 text injection.
- `src/backend/clipboard_manager.py` — Clipboard save/restore with fallback.
- `src/backend/profile_manager.py` — Scene profile CRUD.
- `src/backend/ring_buffer.py` — PCM audio ring buffer for streaming ASR.
- `src/backend/transcript_merger.py` — Overlapping transcript merge.

**Persistence:**
- `src/backend/database.py` — SQLite schema initialization and migrations (profiles, dictionary_stats tables).
- `src/backend/sqlite_async.py` — Custom thin async wrapper over stdlib `sqlite3`.
- `src/backend/config_store.py` — User config persistence (SQLite + Secret Service).
- `src/backend/history_store.py` — Dictation session history CRUD.
- `src/backend/prompt_manager.py` — Prompt template CRUD.
- `src/backend/dictionary_manager.py` — Dictionary entry CRUD + relevance matching.
- `src/backend/profile_manager.py` — Profile CRUD + built-in presets.

**Testing:**
- `tests/backend/conftest.py` — Shared pytest fixtures and mocks.
- `tests/backend/test_*.py` — One test module per backend module.
- `tests/electron/renderer/components/*.test.tsx` — Component unit tests.

## Naming Conventions

**Files:**
- Python modules: `snake_case.py` (e.g., `audio_recorder.py`, `dictation_orchestrator.py`)
- TypeScript/React files: `PascalCase.tsx` for components (e.g., `DictatePage.tsx`), `camelCase.ts` for utilities (e.g., `utils.ts`)
- Test files: `test_*.py` for Python, `*.test.tsx` or `*.test.ts` for frontend

**Directories:**
- Python package: flat under `src/backend/` (no deep nesting)
- Electron code: organized by process role (`main/`, `preload/`, `renderer/`)
- Renderer components: `components/` for pages and features, `components/ui/` for reusable primitives

**Classes:**
- Python: `PascalCase` (e.g., `AudioRecorder`, `DictationOrchestrator`, `ASRClient`)
- React components: `PascalCase` function components (e.g., `DictatePage`, `WaveformVisualizer`)

**Functions / Variables:**
- Python: `snake_case` (e.g., `get_orchestrator`, `_resolve_asr_api_key`)
- TypeScript: `camelCase` (e.g., `handleStart`, `isRecording`)
- Private/internal: leading underscore in both languages

## Where to Add New Code

**New Backend Service:**
- Implementation: `src/backend/{service_name}.py`
- Tests: `tests/backend/test_{service_name}.py`
- Import in `src/backend/main.py` if it exposes HTTP routes.

**New FastAPI Route:**
- Add handler to `src/backend/main.py` (group with related routes).
- Add tests to `tests/backend/test_api.py` or `tests/backend/test_{feature}_routes.py`.

**New React Page / Screen:**
- Implementation: `src/electron/renderer/components/{Name}Page.tsx`
- Types: extend `src/electron/renderer/settings/types.ts` if needed.
- Wire into `src/electron/renderer/app.tsx` tab routing.
- Tests: `src/electron/renderer/components/__tests__/{Name}Page.test.tsx`

**New Reusable UI Component:**
- Implementation: `src/electron/renderer/components/ui/{Name}.tsx`
- Tests: `src/electron/renderer/components/ui/__tests__/{Name}.test.tsx`

**New IPC Channel:**
- Preload bridge: add method to `src/electron/preload/preload.cts`.
- Type definitions: add to `src/electron/preload/types.ts`.
- Main handler: add listener in `src/electron/main/main.ts` or `backend-supervisor.ts`.
- Renderer usage: call via `window.voiceAPI.*`.

**New Database Table / Migration:**
- Schema: add `CREATE TABLE IF NOT EXISTS` to `src/backend/database.py`.
- Migration: add `ALTER TABLE` logic under migration sections in `database.py`.
- Model/Store: create or update store module (e.g., `history_store.py` pattern).

**New Cloud API Client:**
- Implementation: follow `src/backend/asr_client.py` or `src/backend/polish_client.py` pattern.
- Error class: define `{Name}Error` with `error_category`.
- Retry: wrap calls with `RetryPolicy`.
- Tests: mock `httpx.AsyncClient` in `tests/backend/test_{name}.py`.

## Special Directories

**`.venv/`:**
- Purpose: Python virtual environment (uv/venv).
- Generated: Yes.
- Committed: No (in `.gitignore`).

**`dist/`:**
- Purpose: Compiled TypeScript + bundled renderer assets.
- Generated: Yes (`npm run build`).
- Committed: No (in `.gitignore`).

**`src/electron/renderer/components/ui/`:**
- Purpose: Design-system primitives (Button, Card, Input, Badge, EmptyState).
- Generated: No.
- Committed: Yes.
- Note: These are thin styled wrappers over standard HTML elements using Tailwind.

**`~/.local/share/asr-linux/` (runtime):**
- Purpose: User data directory (SQLite DB, log files, recordings).
- Generated: Yes at runtime.
- Committed: No.
- Location: Determined by `XDG_DATA_HOME` or fallback to `~/.local/share/asr-linux/`.

---

*Structure analysis: 2026-06-06 (refreshed)*
