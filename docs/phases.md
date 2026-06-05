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

## Phase 6: Experience Enhancements

Goal:

- Improve speed and input quality after the MVP is stable.

Possible deliverables:

- Streaming ASR preview if the provider supports it reliably.
- Better dictionary relevance ranking.
- Scenario-specific prompt switching.
- Per-app behavior profiles.
- Silence auto-stop by default after tuning.
- More polished overlay animation.
- Wayland compatibility path.

Required docs:

- Add short design notes for any behavior that changes user workflow.
- Update manual smoke tests for new desktop environments.

Exit criteria:

- Enhancements do not weaken the baseline dictation flow.
- Existing phase 4 and phase 5 smoke tests still pass.
- New feature has tests and logs.

Coverage target:

- Maintain or improve phase 5 targets.

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
