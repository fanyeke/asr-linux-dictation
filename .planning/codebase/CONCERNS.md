# Codebase Concerns

**Analysis Date:** 2026-06-05

## Tech Debt

### Legacy Monolith Still in Tree
- **Issue:** `src/electron/renderer/settings/settings-window.tsx` (1477 lines) is a monolithic component that was supposed to be gutted/replaced by `SettingsPage.tsx`. It is now dead code, imported only by its own test file (`tests/electron/renderer/settings/settings-window.test.tsx`).
- **Files:** `src/electron/renderer/settings/settings-window.tsx`, `tests/electron/renderer/settings/settings-window.test.tsx`
- **Impact:** Confuses new contributors; double maintenance risk; bloats bundle.
- **Fix approach:** Remove the file and its test after verifying `SettingsPage.tsx` covers all features.

### New SettingsPage Still Too Large
- **Issue:** `src/electron/renderer/components/SettingsPage.tsx` is 964 lines, mixing API config, hotkey editing, dictionary CRUD, prompt display, diagnostics, and i18n logic in one file.
- **Files:** `src/electron/renderer/components/SettingsPage.tsx`
- **Impact:** Hard to test in isolation; violates module boundaries from `docs/modules.md`.
- **Fix approach:** Extract `ApiConfigCard`, `HotkeyCard`, `DictionaryManager`, `PromptManager`, `DiagnosticsCard` into separate components under `src/electron/renderer/components/settings/`.

### Ghost `inserting` Phase in Frontend
- **Issue:** The frontend type system, overlay, app state, and tests all recognize an `"inserting"` phase, but the backend never broadcasts it. `DictationOrchestrator` transitions directly from `polishing` to `completed`/`failed`. The frontend maps `"inserting"` to `"polishing"` as a workaround.
- **Files:** `src/electron/renderer/settings/types.ts` (`PipelinePhase`), `src/electron/renderer/overlay/overlay-window.tsx`, `src/electron/renderer/overlay/types.ts`, `src/electron/renderer/app.tsx:144-146`, `tests/electron/renderer/overlay/overlay-window.test.tsx`
- **Impact:** Dead code, misleading types, and wasted test coverage on a phase that never occurs.
- **Fix approach:** Remove `"inserting"` from all frontend types, components, and tests. Update `docs/modules.md` if it mentions the phase.

### `failed_audio_path` Not Exposed to Frontend
- **Issue:** The backend `history_store.py` stores `failed_audio_path`, but the frontend `HistorySession` type does not include the field, so users cannot replay or locate failed audio from the GUI.
- **Files:** `src/backend/history_store.py`, `src/electron/renderer/settings/types.ts`
- **Impact:** Feature gap; failed-audio retention rule exists but is not user-accessible.
- **Fix approach:** Add `failed_audio_path?: string | null` to `HistorySession`, expose a "Play/Replay" or "Open folder" action in `HistoryPage`.

### Prompt CRUD Backend Exists but Frontend is Read-Only
- **Issue:** Backend has full `POST/PUT/DELETE /dictionary` and prompt management functions, but `SettingsPage` only shows a read-only list of prompts with an empty-state placeholder. No UI to create, edit, activate, or delete prompts.
- **Files:** `src/backend/main.py` (prompt routes), `src/electron/renderer/components/SettingsPage.tsx` (Prompt Management card)
- **Impact:** Users cannot manage prompts without direct API calls.
- **Fix approach:** Add prompt CRUD UI mirroring the dictionary form pattern, or explicitly defer to Phase 6.

---

## Security Considerations

### Weak Backend Auth Token Generation
- **Risk:** `BackendSupervisor.start()` generates the localhost auth token using `Math.random().toString(36).substring(2, 15)`. `Math.random()` is not cryptographically secure.
- **Files:** `src/electron/main/backend-supervisor.ts:68`
- **Current mitigation:** Token is localhost-only and ephemeral per session.
- **Recommendations:** Replace with `crypto.randomBytes(16).toString('hex')` or `crypto.randomUUID()`.

### API Keys Returned in Plaintext by `/config` GET
- **Risk:** `GET /config` returns the raw `asr_api_key` and `llm_api_key` strings in JSON. The frontend fetches this on every settings load and stores keys in React state.
- **Files:** `src/backend/main.py:153-175`, `src/electron/renderer/components/SettingsPage.tsx:111-130`
- **Current mitigation:** Backend binds to `127.0.0.1`; token required.
- **Recommendations:** Remove raw keys from the `GET /config` response. Return only `asr_api_key_set: boolean` and `llm_api_key_set: boolean`. The settings form can keep its local state for new key entry, but should not receive existing keys back from the server. If key display is needed, return a masked version.

### Renderer Accesses `process.env` Directly
- **Risk:** `settings-window.tsx` and `SettingsPage.tsx` read `process.env.HOME` / `process.env.USERPROFILE` directly in the renderer process. This breaks Electron context isolation assumptions and exposes Node APIs to the renderer.
- **Files:** `src/electron/renderer/settings/settings-window.tsx:952`, `src/electron/renderer/components/SettingsPage.tsx:382`
- **Current mitigation:** Used only for opening the log directory; `contextIsolation: true` is set.
- **Recommendations:** Expose a `openLogsFolder()` method through the preload bridge instead.

### WebSocket Token Passed in URL Query Parameter
- **Risk:** The auth token is sent as a query param (`/ws?token=...`) when opening the WebSocket in `main.ts`. URL query strings may be logged by proxies, crash dumps, or electron DevTools network history.
- **Files:** `src/electron/main/main.ts:222`
- **Current mitigation:** localhost-only.
- **Recommendations:** Use a `Sec-WebSocket-Protocol` header or send the token in the first WebSocket message after connection.

---

## Error Handling Gaps

### Silent `catch` Blocks Swallow Failures
- **Issue:** Numerous `catch { // ignore }` patterns across the renderer hide network errors, config load failures, and history fetch failures from both users and logs.
- **Files:**
  - `src/electron/renderer/app.tsx:89` (language config load)
  - `src/electron/renderer/app.tsx:104` (history load)
  - `src/electron/renderer/app.tsx:193` (stop-dictation error swallowed in `handleStopRecording` partially, though some are surfaced)
  - `src/electron/renderer/components/SettingsPage.tsx:96`, `214`, `298`, `324`, `374` (config save, test, dictionary CRUD)
  - `src/electron/renderer/components/HistoryPage.tsx:67`
- **Impact:** Users see stale data or silent failures; debugging requires manual log inspection.
- **Fix approach:** Log caught errors via a minimal logger (or console.error in dev) and surface user-facing toasts for actionable failures.

### Main Process Silently Ignores Polling and WS Errors
- **Issue:** `main.ts` ignores WebSocket connection failures (`catch { // WebSocket connection failure … }`) and microphone level polling errors (`catch { // ignore polling errors }`).
- **Files:** `src/electron/main/main.ts:222-228`, `main.ts:198-204`
- **Impact:** If the backend crashes or becomes unreachable during dictation, the overlay may stay in "recording" state indefinitely.
- **Fix approach:** Add error counters or health checks; force-stop recording overlay after N consecutive polling failures.

### Hardcoded Timing Magic Numbers Without Retry
- **Issue:** `stop-dictation` in `main.ts` waits exactly 300ms after hiding the overlay before calling the backend, assuming the window manager will refocus. There is no verification that focus actually returned, and no retry if it didn't.
- **Files:** `src/electron/main/main.ts:185-190`
- **Impact:** On slow window managers or under load, the 300ms may be insufficient, causing injection into the overlay window or the wrong target.
- **Fix approach:** Query the active window via `xdotool` after the delay to verify focus changed, or make the delay configurable.

---

## Test Coverage Gaps

### Canvas Rendering Not Mocked in Tests
- **Issue:** `WaveformVisualizer` uses `HTMLCanvasElement.getContext('2d')`, which is not implemented in the test environment (jsdom). Vitest prints warnings for every `DictatePage` test.
- **Files:** `src/electron/renderer/components/WaveformVisualizer.tsx`, `tests/electron/renderer/components/DictatePage.test.tsx`
- **Risk:** Canvas logic (EMA smoothing, colors, bar counts) has zero automated coverage.
- **Priority:** Medium
- **Fix approach:** Install `canvas` npm package for jsdom, or mock `getContext` with a spy to assert drawing calls.

### Main Process IPC Handlers Lack Unit Tests
- **Issue:** `src/electron/main/main.ts` contains ~500 lines of critical IPC logic (start/stop dictation, hotkey registration, overlay lifecycle, WS bridging) but has no dedicated unit tests.
- **Files:** `src/electron/main/main.ts`
- **Risk:** Regressions in stop-dictation flow, hotkey fallback logic, or overlay focus timing are caught only by manual smoke tests.
- **Priority:** High
- **Fix approach:** Extract IPC handler functions into a testable module (e.g., `src/electron/main/ipc-handlers.ts`) and write vitest tests with mocked `BrowserWindow` and `globalShortcut`.

### No E2E or Integration Tests for Full Pipeline
- **Issue:** There is no automated test that exercises the full flow: hotkey → start → audio → stop → ASR mock → polish mock → inject mock → history update.
- **Files:** N/A
- **Risk:** Breaks in the orchestrator-to-main-to-renderer contract are only caught manually.
- **Priority:** Medium
- **Fix approach:** Add a backend integration test that mocks `AudioRecorder` and `TextInjector`, and optionally an Electron E2E test with Playwright/Spectron.

---

## Frontend/UI Concerns

### Duplicate Frontend Refactor Plans
- **Issue:** Two competing frontend refactor documents exist: `.planning/frontend-refactor-plan.md` (tabbed layout + phase indicators) and `docs/frontend-redesign-plan.md` (Tailwind + Framer Motion redesign with risk registry R1-R8). The redesign plan is more recent but references the refactor plan's work.
- **Files:** `.planning/frontend-refactor-plan.md`, `docs/frontend-redesign-plan.md`
- **Impact:** Risk of conflicting guidance for agents; some "risks" in the redesign plan (e.g., R1 auth header) appear to already be fixed in code.
- **Fix approach:** Consolidate into a single document, mark completed risks as resolved, and archive the older plan.

### Dashboard Lacks Backend Stats Endpoint
- **Issue:** `DashboardPage` computes statistics (success rate, avg duration, total chars) entirely on the client from `/history` data. There is no `/stats` endpoint.
- **Files:** `src/electron/renderer/components/DashboardPage.tsx`, `docs/frontend-redesign-plan.md`
- **Impact:** Inaccurate or slow for large histories; frontend must load all history to compute aggregates.
- **Fix approach:** Add a lightweight `GET /stats` backend endpoint with SQL aggregates.

### Language Config Ignored by Frontend
- **Issue:** Backend supports `asr_language` and `ui_language`, but the frontend only uses `ui_language`. The ASR language setting has no UI control.
- **Files:** `src/backend/config.py`, `src/electron/renderer/components/SettingsPage.tsx`
- **Impact:** Users cannot change dictation language without editing environment variables.
- **Fix approach:** Add an ASR language selector to the API Configuration card.

### Silence Detection Parameters Have No UI
- **Issue:** `silence_threshold` and `silence_duration_ms` are configurable only via environment variables (`ASR_LINUX_SILENCE_THRESHOLD`, `ASR_LINUX_SILENCE_DURATION_MS`).
- **Files:** `src/backend/config.py`, `src/backend/audio_recorder.py`
- **Impact:** Users cannot tune auto-stop behavior from the GUI.
- **Fix approach:** Expose sliders/inputs in Settings and persist via `/config`.

---

## Platform Limitations

### Wayland Not Supported
- **Issue:** Text injection and clipboard operations rely exclusively on X11 tools (`xdotool`, `xsel`, `xclip`, `xprop`). The app will not work on native Wayland sessions.
- **Files:** `src/backend/text_injector.py`, `src/backend/clipboard_manager.py`, `docs/smoke.md`
- **Impact:** Growing number of Linux distributions default to Wayland (Fedora, Ubuntu 24.04+). Users must manually switch to X11 or use XWayland target apps.
- **Fix approach:** Research and implement `wl-copy` / `wtype` compatibility path, gated by session detection.

### Push-to-Talk Not Implemented
- **Issue:** Phase 5 plan lists "Optional push-to-talk research and implementation if feasible" as a deliverable, but only toggle-to-record exists.
- **Files:** `src/electron/main/main.ts` (hotkey registration), `.planning/phase-5/PLAN.md`
- **Impact:** Some users prefer hold-to-speak behavior; toggle can accidentally leave recording on.
- **Fix approach:** Add `push-to-talk` mode where hotkey-down starts and hotkey-up stops dictation.

---

## Coupling & Architecture

### App.tsx is a God Component
- **Issue:** `app.tsx` (411 lines) manages state for all four tabs (dictate, history, dashboard, settings), all backend subscriptions, toast timing, hotkey refs, and tab animation. It passes deeply nested props to children.
- **Files:** `src/electron/renderer/app.tsx`
- **Impact:** Changes to one tab's data requirements can cause re-renders across the entire app; hard to unit test.
- **Fix approach:** Introduce a lightweight context or Zustand store for backend config, dictation state, and history. Keep `App` as a layout shell.

### Backend Orchestrator Broadcasts Status But Not Session ID to Renderer
- **Issue:** `DictationOrchestrator._broadcast()` sends `session_id` over WebSocket, but `main.ts` strips it when relaying to renderer windows. The renderer only receives `{ phase, raw_text, polished_text, error }` without the session ID.
- **Files:** `src/backend/dictation_orchestrator.py`, `src/electron/main/main.ts:237-260`
- **Impact:** The renderer cannot correlate a dictation result with its backend session, making retry-from-history or deep-linking to a session impossible from the frontend.
- **Fix approach:** Include `session_id` in the status update payload forwarded to renderer windows.

### Tight Coupling Between Main Process and Backend Timing
- **Issue:** `main.ts` encodes assumptions about backend behavior: 300ms focus delay, 100ms mic polling interval, 2000ms overlay hide delay. These are not contractually enforced.
- **Files:** `src/electron/main/main.ts:185-190`, `main.ts:198-204`, `main.ts:293-296`
- **Impact:** Backend changes to pipeline timing can break overlay UX.
- **Fix approach:** Document these constants in a shared IPC contract file; consider having the backend drive overlay visibility via explicit events.

---

## Missing Critical Features

### No Backend `/stats` Endpoint
- **Problem:** Dashboard computes aggregates client-side. No server-side aggregation exists.
- **Blocks:** Accurate stats for large histories; future analytics features.

### No Prompt Activation UI
- **Problem:** Users can view prompts but cannot mark one as active from the GUI.
- **Blocks:** Scenario-specific prompt switching (Phase 6 goal).

### No Per-App Behavior Profiles
- **Problem:** No mechanism to vary dictionary/prompt/injection behavior based on the active window class.
- **Blocks:** Phase 6 "Per-app behavior profiles" feature.

---

*Concerns audit: 2026-06-05*
