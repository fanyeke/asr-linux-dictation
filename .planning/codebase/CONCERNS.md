# Codebase Concerns

**Analysis Date:** 2026-06-06

## Tech Debt

### Legacy Monolith Still in Tree
- **Issue:** `src/electron/renderer/settings/settings-window.tsx` (1477 lines) is a monolithic component that was supposed to be gutted/replaced by `SettingsPage.tsx`. It is now dead code, imported only by its own test file (`tests/electron/renderer/settings/settings-window.test.tsx`).
- **Files:** `src/electron/renderer/settings/settings-window.tsx`, `tests/electron/renderer/settings/settings-window.test.tsx`
- **Impact:** Confuses new contributors; double maintenance risk; bloats bundle.
- **Fix approach:** Remove the file and its test after verifying `SettingsPage.tsx` covers all features.

### New SettingsPage Still Too Large
- **Status:** ✅ **RESOLVED** — SettingsPage was split into 7 sub-components under `src/electron/renderer/components/settings/`: ApiConfigSection, VadSection, HotkeySection, DictionaryManager, PromptManager, ProfileManager, DiagnosticsSection.
- **Evidence:** Each sub-component is a focused, testable module.

### Ghost `inserting` Phase in Frontend
- **Status:** ✅ **RESOLVED** — PipelinePhase type was reduced to: `"idle" | "recording" | "transcribing" | "polishing" | "completed" | "failed"`. No "inserting" phase exists.

### `failed_audio_path` Not Exposed to Frontend
- **Status:** ✅ **RESOLVED** — `HistorySession.failed_audio_path` is now typed. SessionListItem shows "Open Audio" button and "revealFile" IPC action for failed sessions.

### Prompt CRUD Backend Exists but Frontend is Read-Only
- **Status:** ✅ **RESOLVED** — PromptManager.tsx provides full CRUD UI (create, edit, delete, activate prompts).

---

## Security Considerations

### Weak Backend Auth Token Generation
- **Risk:** `BackendSupervisor.start()` generates the localhost auth token using `Math.random().toString(36).substring(2, 15)`. `Math.random()` is not cryptographically secure.
- **Files:** `src/electron/main/backend-supervisor.ts:68`
- **Current mitigation:** Token is localhost-only and ephemeral per session.
- **Recommendations:** Replace with `crypto.randomBytes(16).toString('hex')` or `crypto.randomUUID()`.

### API Keys Returned in Plaintext by `/config` GET
- **Status:** ✅ **RESOLVED** — `ApiConfigSection.tsx` now uses `asr_api_key_set: boolean` and `llm_api_key_set: boolean` flags. Existing keys are never returned as raw values — the form shows `"••••••••"` placeholder for configured keys.
- **Evidence:** `src/electron/renderer/components/settings/ApiConfigSection.tsx:126-128`

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

### Dashboard Uses Both Client and Server Stats
- **Issue:** `DashboardPage` fetches `/dashboard/stats` backend endpoint (Phase 11) but also computes client-side aggregates from `/history`. The two sources may disagree.
- **Files:** `src/electron/renderer/components/DashboardPage.tsx`, `src/backend/main.py`
- **Impact:** Potential inconsistency between server-computed and client-computed stats.
- **Fix approach:** Unify to single source — prefer the `/dashboard/stats` endpoint and deprecate client-side computation.

### Streamlined SettingsPage Still Large
- **Issue:** After splitting into sub-components, `SettingsPage.tsx` still orchestrates 7 sub-components with per-component state loading, which creates complex coupling.
- **Files:** `src/electron/renderer/components/SettingsPage.tsx`
- **Impact:** Each sub-component re-fetches config independently, causing redundant network calls.
- **Fix approach:** Centralize config fetching in the parent; pass data down via props or context.

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

## New Features (Recently Added)

### Backend Stats Endpoint
- **Status:** ✅ Added in Phase 11 — `GET /dashboard/stats` returns `daily_usage`, `hourly_distribution`, `avg_latency`, `latency_trend`.
- **Evidence:** `src/backend/main.py`, `src/electron/renderer/components/DashboardPage.tsx`

### Prompt Activation UI
- **Status:** ✅ Added — `PromptManager.tsx` provides full CRUD with activate/deactivate.
- **Evidence:** `src/electron/renderer/components/settings/PromptManager.tsx`

### Scene Profiles (Profile Manager)
- **Status:** ✅ Added in Phase 9 — CRUD API + 5 built-in presets (通用/编程/写作/会议记录/聊天) + settings UI + tray switch.
- **Evidence:** `src/backend/profile_manager.py`, `src/electron/renderer/components/settings/ProfileManager.tsx`

### Onboarding Wizard
- **Status:** ✅ Added in Phase 8 — 4-step modal (deps check, ASR config, LLM config, trial recording).
- **Evidence:** `src/electron/renderer/components/OnboardingWizard.tsx`

### Clipboard Save/Restore
- **Status:** ✅ Added in Phase 12 — `ClipboardManager` with save/restore, fallback, polling verification.
- **Evidence:** `src/backend/clipboard_manager.py`

### Streaming ASR Infrastructure
- **Status:** ✅ Core infrastructure added — `RingBuffer` for PCM slicing, `TranscriptMerger` for overlap detection.
- **Evidence:** `src/backend/ring_buffer.py`, `src/backend/transcript_merger.py`

### Connection Warmup
- **Status:** ✅ Added in Phase 14 — Fire-and-forget warmup probes to ASR/LLM on recording start.
- **Evidence:** `src/backend/asr_client.py`, `src/backend/polish_client.py`

### History Diff View
- **Status:** ✅ Added in Phase 10 — `SessionListItem` shows diff (ASR vs LLM) with color-coded segments.
- **Evidence:** `src/electron/renderer/lib/diff.ts`, `SessionListItem.tsx`

---

*Concerns audit: 2026-06-06 (refreshed)*
