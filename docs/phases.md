# Development Phases

This project should move in small runnable phases. Each phase must leave the app easier to run, test, and debug than before.

Coverage targets are minimums for automated code that exists in that phase. Manual-only desktop behavior still needs smoke notes.

## Phase 0: Project Baseline

Goal:

- Establish the repository shape, engineering rules, and runnable test commands.

Deliverables:

- Python backend skeleton.
- Electron app skeleton.
- Basic test setup for backend and renderer.
- Formatting/linting commands if introduced.
- Documentation index and agent entry files.

Required docs:

- `CLAUDE.md`
- `AGENTS.md`
- `docs/README.md`
- `docs/tdd.md`
- `docs/logging.md`
- `docs/modules.md`
- `docs/phases.md`

Exit criteria:

- `uv run pytest` runs, even if only baseline tests exist.
- Renderer test command runs, if renderer has been created.
- Root docs explain how agents should work.
- No feature code without a test path.

Coverage target:

- No strict percentage yet.
- New non-trivial backend logic must be tested.

## Phase 1: Backend Foundation

Goal:

- Build the local backend foundation without real dictation.

Deliverables:

- FastAPI backend with token-protected localhost routes.
- Health route.
- WebSocket event stream.
- Config loading and validation.
- Structured JSONL logging with `info` and `debug` startup modes.
- Log rotation and cleanup.
- SQLite connection and migration baseline.

Required docs:

- Update `docs/modules.md` if module boundaries change.
- Add short manual run notes if startup differs from the documented architecture.

Exit criteria:

- Backend starts on localhost.
- Electron can discover backend port/token later.
- Logs are written, rotated, redacted, and cleaned.
- Health and diagnostics routes are tested.

Coverage target:

- Backend unit/integration coverage: at least 70%.
- Logging/config modules: at least 80%.

## Phase 2: API Clients And Text Pipeline

Goal:

- Build the cloud API pipeline without microphone or GUI dependency.

Deliverables:

- ASR client with mocked tests.
- Polish client with mocked tests.
- Prompt manager.
- Dictionary manager.
- Dictation orchestrator using fixture audio.
- History store for success/failure records.
- Failed-audio retention rule.

Required docs:

- Document required environment variables or secret names.
- Document real API smoke test command if added.

Exit criteria:

- Fixture audio can pass through orchestrator to mocked ASR and mocked polishing.
- Success path stores raw/polished text and deletes successful audio.
- Failure path stores error type and failed audio when available.
- API failures are categorized.

Coverage target:

- Backend coverage: at least 75%.
- API clients, orchestrator, prompt, dictionary, and history modules: at least 80%.

## Phase 3: Audio And Desktop Injection

Goal:

- Add real microphone capture and text insertion, still callable from backend/test tools.

Deliverables:

- Audio recorder with level events.
- Explicit start/stop recording.
- Optional silence detection behind config.
- Text injector for X11 using clipboard and paste commands.
- Clipboard fallback when target input loses focus during injection.
- Terminal paste handling.
- Manual smoke script or command for real dictation without full GUI.

Required docs:

- Manual smoke test notes for microphone and text injection.
- Update diagnostics requirements if new failure types are needed.

Exit criteria:

- User can run a backend command or test route to record, transcribe, polish, and insert text.
- Overlay is not required yet.
- Successful audio cleanup and failed audio retention still pass tests.
- Injection failures are visible in history/logs.
- Text is saved to clipboard when target input loses focus during injection.

Coverage target:

- Backend coverage: at least 75%.
- Pure decision logic for recorder/injector: at least 80%.
- Real microphone and real desktop injection can be manual smoke tests.

## Phase 4: Electron GUI MVP

Goal:

- Build the usable desktop GUI shell and connect it to the backend.

Deliverables:

- Electron starts/stops backend.
- Main settings window.
- API connectivity test UI.
- Microphone level test UI.
- Prompt editor.
- Dictionary editor.
- History view.
- Diagnostics controls.
- Basic overlay window.
- Toggle hotkey for start/stop dictation.

Required docs:

- Manual smoke test notes for GUI workflows.
- Update module docs if renderer/backend contracts change.

Exit criteria:

- User can configure APIs, test connectivity, trigger dictation, see status, and get text inserted.
- Failed sessions are visible and retryable if retry is implemented.
- History shows injection status including clipboard fallback events.
- Logs can be opened from GUI.
- Renderer does not access Node/Electron APIs except through preload bridge.

Coverage target:

- Backend coverage: at least 75%.
- Renderer state/IPC contract coverage: at least 60%.
- Critical backend contracts used by GUI: at least 80%.

## Phase 5: Product Hardening

Goal:

- Make the app reliable enough for daily use.

Deliverables:

- Better error messages.
- Retry policy tuning.
- Clipboard restore hardening.
- Failed-session retry from history.
- Diagnostic bundle export.
- Config migration tests.
- Packaging/dev install path.
- Optional push-to-talk research and implementation if feasible.

Required docs:

- Update smoke checklist.
- Document known limitations, especially Wayland and push-to-talk behavior.

Exit criteria:

- Common failures are diagnosable from GUI and logs.
- Log and failed-audio cleanup are verified.
- App can be restarted without losing config/history.
- User can recover from API/microphone/injection errors.

Coverage target:

- Backend coverage: at least 80%.
- Renderer state/IPC contract coverage: at least 70%.
- Logging, config, history, and orchestrator modules: at least 85%.

## Phase 6: Core Config & UX — ✅ Done

Goal:

- Low-hanging UX improvements: ASR language dropdown, VAD user controls, level polling optimization.

Deliverables:

- ASR language selector (zh/en/auto) in settings with tray quick-switch submenu.
- VAD toggle enable/disable with threshold and duration sliders.
- Level polling optimized to 60-80ms from 100ms.
- WebSocket push evaluation for mic level.
- Overlay VAD countdown indicator.

Exit criteria met:

- Language persisted across restarts and used by dictation orchestrator.
- VAD toggle respected by AudioRecorder.
- All new code has TDD tests and structured timing logs.

Coverage target: Maintained.

## Phase 7: History & Overlay — ✅ Done

Goal:

- Make history actionable (copy/export), transparent (dictionary stats), visually polished (progress bar).

Deliverables:

- Copy button per history item with toast confirmation.
- Export button with txt/md format dialog.
- Dictionary match frequency tracking (per-entry "最近N次触发M次" badge).
- Continuous progress bar replacing step dots.
- VAD countdown as gray tail fill on progress bar.
- Completed state shows green bar for 2s then fade out.

Exit criteria met:

- All new code has TDD tests and structured timing logs.

## Phase 8: Overlay Polish + Onboarding — ✅ Done

Goal:

- True 0→100% continuous progress bar, fix phase broadcast timing, build onboarding wizard.

Deliverables:

- Progress bar smooth animates 0→100% across pipeline (simulated, not segmented).
- Recording: 0-30%, Transcribing: 30-60%, Polishing: 60-88%, Completed: 88-100%.
- Mic wave overlay during recording on progress bar.
- Broadcast `transcribing` BEFORE ASR, `polishing` BEFORE LLM (not after).
- 4-step onboarding wizard: deps check, ASR config, LLM config, trial recording.
- Onboarding persisted to DB; Settings has "重新引导" link.
- Prev/next/skip navigation.

Exit criteria met:

- All new code has TDD tests and structured timing logs.

## Phase 9: Scene Profiles — ✅ Done

Goal:

- Preset scene system with CRUD, pipeline integration, and quick-switch.

Deliverables:

- `profiles` table with 5 built-in presets (通用/编程/写作/会议记录/聊天) seeded on migration.
- CRUD API: list/get/create/update/delete profiles.
- Settings → 场景管理 panel with active profile selection.
- ProfileManager sub-component with duplicate preset functionality.
- Tray menu for quick profile switching.
- Pipeline uses active profile's prompt template and ASR language.

Exit criteria met:

- All new code has TDD tests and structured timing logs.

## Phase 10: History Redesign — ✅ Done

Goal:

- Redesign history list with preview, copy, diff view, and search API.

Deliverables:

- Expandable session detail with animated diff view (ASR vs LLM with color-coded segments).
- Framer Motion expand/collapse on session list items.
- Backend history search API (keyword filtering).
- Copy-to-clipboard button per session.

Exit criteria met:

- All new code has TDD tests and structured timing logs.

## Phase 11: Dashboard + Stats — ✅ Done

Goal:

- Build a stats dashboard with latency breakdown and charts.

Deliverables:

- Backend `/dashboard/stats` endpoint with SQL aggregates.
- DashboardPage with stat cards (active sessions, success rate, avg latency, total chars).
- Daily usage bar chart (BarChart component).
- Latency trend line chart (LineChart component with dual ASR/LLM lines).
- Empty state for no-data scenarios.

Exit criteria met:

- All new code has TDD tests and structured timing logs.

## Phase 12: Clipboard Save/Restore — ✅ Done

Goal:

- Save current clipboard before injection, restore after successful paste; leave text on clipboard on failure.

Deliverables:

- ClipboardManager with save/restore/set operations.
- `inject_with_fallback()` flow: save → paste → restore.
- FocusLostError path leaves text on clipboard.
- Polling verification that clipboard content is visible before paste.
- Bounded `xclip` loops with timeout.

Exit criteria met:

- All new code has TDD tests and structured timing logs.

## Phase 13: Pseudo-Streaming ASR — ✅ Done

Goal:

- Ring buffer for PCM capture during recording, slice-based ASR, transcript merge, partial preview in overlay.

Deliverables:

- RingBuffer with chunked PCM storage and slice read with overlap.
- pcm_to_wav() helper wrapping raw PCM in RIFF/WAV header.
- TranscriptMerger with longest-suffix overlap detection (CJK-aware).
- Streaming orchestrator tests for slice scheduling and merge.
- Integration into DictationOrchestrator (background slice scheduling during recording).
- WebSocket broadcast of `partial_transcript` events.
- Overlay partial text preview area.
- Engine selector supports streaming mode; only shows partial text when streaming is supported by the ASR engine.

## Phase 14: Connection Warmup — ✅ Done

Goal:

- Eliminate TCP+TLS handshake latency by warming ASR/LLM connections on recording start.

Deliverables:

- `ASRClient.warmup()` — minimal probe to ASR endpoint.
- `PolishClient.warmup()` — minimal probe to LLM endpoint.
- Both called fire-and-forget after `recorder.start()` in `/dictation/start`.
- Failures logged but never block the pipeline.

## Phase 15: Theme System — ✅ Done

Goal:

- Warm light theme and deep blue-gray dark theme with CSS variables, persistence, and smooth transitions.

Deliverables:

- Light theme: `#f6f7f9` background, white cards, subtle shadows.
- Dark theme: `#0f172a` background, `#1e293b` cards, `#818cf8` primary accent.
- 300ms smooth transitions between themes with `prefers-reduced-motion` support.
- Theme persistence via `UserConfig` backend table (`/config` API stores `theme` field).
- Theme applied before first paint via startup load.
- All existing components respect theme CSS variables without modification.

Exit criteria met:

- All new code has TDD tests and structured timing logs.

## Future Work (Not Yet Phased)

- Streaming ASR full integration (partial results in overlay).
- Per-app behavior profiles (auto-switch based on focused window).
- Wayland compatibility path (wl-copy/wtype).
- Push-to-talk mode.
- Profile import/export.

## Phase Gate Rules

- Do not advance a phase if core tests are failing.
- Do not build GUI workflows against unstable backend contracts.
- Do not add real API calls to default test runs.
- Do not keep successful audio as a side effect.
- Do not accept a feature as done if logs cannot explain its failure path.

## Manual Smoke Checklist Baseline

Maintain a short smoke note for any phase touching desktop behavior:

- OS/session type.
- Microphone source.
- Hotkey used.
- Target app used for insertion.
- Expected result.
- Actual result.
- Log file/session id for failures.
