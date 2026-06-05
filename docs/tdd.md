# TDD Requirements

This project uses test-driven development for behavior that can affect dictation correctness, reliability, or user data. The goal is not to maximize test count. The goal is to make each change reproducible before it is implemented and safe to refactor later.

## Core Rule

Every non-trivial feature starts with a failing test.

The normal loop is:

1. Write or update the smallest test that describes the expected behavior.
2. Run the test and confirm it fails for the right reason.
3. Implement the smallest change that makes it pass.
4. Run the relevant test set.
5. Refactor only while tests stay green.

Do not implement feature logic first and add tests afterward unless the change is explicitly a spike or prototype. If a spike becomes product code, replace it with tested code before continuing.

## Scope

TDD is required for:

- API client request building, response parsing, timeout handling, and retry decisions.
- ASR and polish pipeline state transitions.
- Prompt rendering and dictionary/term replacement behavior.
- History persistence, failed-audio retention, and cleanup rules.
- Logging configuration, log rotation, and log redaction.
- Text injection decision logic, such as normal app paste versus terminal paste.
- Configuration validation and migration.

TDD is recommended but not always required for:

- GUI layout details.
- Visual animation timing.
- Small copy changes.
- One-off setup scripts.

GUI behavior should still have targeted tests around state, data binding, and IPC contracts. Pixel-perfect visual checks can be manual until the UI stabilizes.

## Test Layers

Use focused layers instead of testing everything through the GUI.

- Unit tests: pure functions and state machines. These should be fast and run often.
- Integration tests: SQLite, local backend routes, WebSocket events, file cleanup, and mocked cloud APIs.
- Contract tests: Electron-to-backend API shape, request/response schemas, and event names.
- Manual smoke tests: microphone capture, global hotkey, overlay placement, and text injection into real apps.

Cloud ASR and LLM APIs must be mocked in default test runs. Real API tests should be opt-in and skipped unless explicit environment variables are present.

## Suggested Python Test Stack

Use this unless the implementation later gives a strong reason to change:

- `pytest` for tests.
- `pytest-asyncio` for async backend behavior.
- `respx` or `httpx.MockTransport` for HTTP API mocks.
- Temporary directories for audio/log/history cleanup tests.
- SQLite temporary databases for persistence tests.

Default test command:

```bash
uv run pytest
```

Optional real API test command:

```bash
ASR_LINUX_RUN_REAL_API=1 uv run pytest -m real_api
```

## Suggested Electron Test Stack

Use this unless the UI stack changes:

- `vitest` for renderer logic.
- `@testing-library/react` if the renderer uses React.
- Playwright only for end-to-end GUI smoke tests after the app shell exists.

Renderer tests should mock `window.voiceAPI`; they should not call Python directly.

## Mocking Rules

Mocks should preserve behavior that matters:

- Mock cloud services at the HTTP boundary, not deep inside the pipeline.
- Mock audio input with small fixture WAV files or generated PCM data.
- Mock clocks when testing retention, rotation, and timeout behavior.
- Mock text injection commands when running automated tests.

Do not mock the code under test just to make a test easy. If a test becomes awkward, split the production code at a real boundary.

## Required Test Cases By Feature

### Recording Pipeline

- Starts from idle and enters recording state.
- Emits level events while recording.
- Stops by user action.
- Stops by silence only when silence detection is enabled.
- Deletes successful audio files.
- Keeps failed audio files with metadata.

### ASR Client

- Sends the configured model, language, and audio payload.
- Handles success response.
- Handles authentication failure.
- Handles timeout.
- Handles malformed response.
- Does not log raw API keys or full audio payloads.

### Polishing Client

- Sends raw transcript, active prompt, and relevant dictionary entries.
- Returns only final text when the model follows instructions.
- Handles empty input.
- Handles model returning explanation text by applying the configured sanitization rule.
- Handles timeout and preserves raw ASR text as fallback when configured.

### Dictionary

- Stores canonical term, aliases, notes, and enforcement level.
- Selects relevant entries for a transcript.
- Does not apply broad replacements blindly.
- Applies forced replacements only where configured.

### History

- Records raw text, polished text, status, timing, prompt id, and error category.
- Does not store successful audio.
- Stores failed audio path only when a file exists.
- Supports retrying a failed session.

### Logging

- Applies debug/info mode at startup.
- Rotates logs by size.
- Cleans old logs by age or total size.
- Redacts secrets.
- Includes correlation ids across one dictation session.

## Definition Of Done

A feature is done only when:

- The intended behavior has tests.
- Failure paths have tests when the feature touches API, files, persistence, or user input.
- The relevant test command passes.
- Manual smoke steps are documented when automation is not practical.
- Logs for the feature include enough context to debug failure without exposing secrets or full audio contents.

## Exceptions

Allowed exceptions:

- Exploratory spike code.
- UI-only experiments.
- Emergency one-line fixes.

Each exception must be marked in the task notes or commit message, and product code must receive tests before more dependent work is built on top of it.
