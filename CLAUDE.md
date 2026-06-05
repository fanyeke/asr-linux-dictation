# CLAUDE.md

Rules for Claude Code before any development work.

## What This Is

Linux desktop voice input app. Workflow: hotkey → record → cloud ASR → cloud LLM polish → insert into focused window.

## Stack

- Electron: GUI, tray, settings, overlay, hotkeys.
- Python FastAPI: audio, API calls, persistence, logging, text injection.
- Localhost HTTP for actions; WebSocket for status/levels.
- SQLite for prompts, dictionary, history, failed-session metadata.
- Backend binds `127.0.0.1` only; ephemeral port + session token.

## Must Read First

For non-trivial work, read `docs/README.md`, `docs/tdd.md`, `docs/logging.md`, `docs/modules.md`, `docs/phases.md`.

## Rules

1. **TDD first** for non-trivial behavior. Write/update tests before implementation.
2. Mock cloud APIs in default tests.
3. GUI tests focus on state, IPC contracts, user workflows.
4. Add structured logs for start/success/failure/duration of tasks, API calls, file/db writes, desktop actions.
5. Preserve `session_id` across one dictation attempt.
6. Do not log API keys, auth headers, raw base64 audio, or full successful transcripts.
7. Respect module boundaries in `docs/modules.md`.
8. Follow phase order in `docs/phases.md` unless redirected.

## Done Means

- Behavior has tests.
- Tests pass.
- Required logs present and redacted.
- User-facing failures diagnosable from logs/history.
- Audio cleanup/retention rules preserved when touched.
- Manual smoke steps documented when automation is impractical.

## Planning Stance

Lightweight specs; do not skip engineering gates: TDD, structured logging, module boundaries, phased delivery, manual smoke for desktop behavior.
