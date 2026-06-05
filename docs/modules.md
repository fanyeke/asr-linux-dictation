# Module Boundaries

This document defines the intended module split. Keep the boundaries stable unless implementation proves a better split is needed.

## System Shape

The app has two main processes:

- Electron desktop shell.
- Python local backend.

Electron starts the backend, discovers its localhost port, and talks to it through HTTP and WebSocket. The backend owns dictation behavior and persistence. Electron owns windows, tray, hotkeys, and renderer state.

## Electron Modules

### App Shell

Responsibilities:

- Start and stop the desktop app.
- Start and supervise the Python backend.
- Read backend port/token from startup output.
- Own app lifecycle, tray, and main settings window.

Must not:

- Implement ASR, polish, dictionary, or history logic.
- Store API keys directly in renderer state.

### Main Process IPC

Responsibilities:

- Expose a small, typed API to renderer through preload.
- Forward renderer requests to the backend.
- Subscribe to backend status events and relay them to renderer windows.

Must not:

- Expose raw Electron or Node APIs to renderer.
- Let renderer choose arbitrary backend URLs.

### Settings Window

Responsibilities:

- Hotkey configuration.
- API connectivity tests.
- Prompt editing.
- Dictionary editing.
- History and failed-session review.
- Diagnostics actions.

Testing focus:

- Form validation.
- IPC contracts.
- State updates from backend responses.

### Overlay Window

Responsibilities:

- Bottom-screen dictation status.
- Recording level visualization.
- Pipeline state display, such as recording, transcribing, polishing, inserting, and failed.

Testing focus:

- State rendering.
- Event handling.
- Does not block normal desktop use.

Manual smoke required for final placement and always-on-top behavior.

### Hotkey Adapter

Responsibilities:

- Register configured hotkey.
- Support toggle-to-record first.
- Later support push-to-talk if feasible on the current desktop session.

Testing focus:

- Registration success/failure handling.
- Hotkey event to backend command mapping.

## Python Backend Modules

### Backend API

Responsibilities:

- FastAPI HTTP routes for configuration, tests, prompts, dictionary, history, diagnostics, and dictation commands.
- WebSocket event stream for app status and recording levels.
- Token validation for localhost requests.

Testing focus:

- Route contracts.
- Auth/token enforcement.
- WebSocket event shape.

### Dictation Orchestrator

Responsibilities:

- Own the dictation state machine.
- Create and propagate `session_id`.
- Coordinate recording, ASR, polishing, injection, history, and cleanup.
- Provide safe fallback when polishing fails.

Testing focus:

- State transitions.
- Success path.
- ASR failure path.
- Polish failure fallback.
- Cleanup rules.

### Audio Recorder

Responsibilities:

- Record microphone audio.
- Emit level events.
- Save temporary audio for a session.
- Stop by explicit command, and later by silence detection.

Testing focus:

- Generated/fixture audio processing.
- Level event computation.
- Temporary file lifecycle.

Manual smoke required for real microphone capture.

### ASR Client

Responsibilities:

- Build cloud ASR API requests.
- Parse response text.
- Apply timeouts and retry policy.
- Classify API errors.

Testing focus:

- Request body and headers without exposing secrets.
- Success response.
- Timeout/auth/rate-limit/malformed response.

Default tests must mock the provider.

### Polish Client

Responsibilities:

- Render prompt with raw transcript and selected dictionary entries.
- Call cloud LLM API.
- Parse final polished text.
- Enforce fallback behavior when response is unusable.

Testing focus:

- Prompt rendering.
- Relevant dictionary selection.
- Timeout/auth/rate-limit/malformed response.
- Output sanitization.

Default tests must mock the provider.

### Prompt Manager

Responsibilities:

- Store prompt templates.
- Mark active prompt.
- Support scenario-specific prompts.
- Version prompt changes for history readability.

Testing focus:

- CRUD.
- Active prompt selection.
- Template validation.

### Dictionary Manager

Responsibilities:

- Store canonical terms, aliases, notes, category, and enforcement level.
- Select entries relevant to a raw transcript.
- Provide entries to polish prompt.
- Apply only explicitly forced replacements in deterministic post-processing.

Testing focus:

- Relevance selection.
- Forced versus suggested behavior.
- Avoid broad accidental replacements.

### History Store

Responsibilities:

- Store dictation session metadata, raw text, polished text, status, timing, prompt id, error type, and failed audio id/path.
- Support retry from failed sessions.
- Support user review in GUI.

Testing focus:

- Success history without audio path.
- Failed history with audio path when available.
- Retry metadata.

### Text Injector

Responsibilities:

- Insert final text into focused desktop app.
- Preserve and restore clipboard where possible.
- Save text to clipboard when target input loses focus during injection.
- Use terminal-specific paste when needed.
- Report injection failure clearly.

Testing focus:

- Target app classification logic.
- Command selection.
- Focus-loss detection and clipboard fallback.
- Clipboard restore paths.

Manual smoke required for real X11 apps and terminal windows.

### Logging And Diagnostics

Responsibilities:

- Configure structured JSONL logs.
- Apply log level from CLI/env/config.
- Rotate and clean logs.
- Redact secrets and sensitive payloads.
- Export diagnostic bundle.

Testing focus:

- Level selection.
- Rotation/retention cleanup.
- Redaction.
- Session id propagation.

### Config And Secrets

Responsibilities:

- Store non-secret config in XDG config/state locations.
- Store API keys in Linux Secret Service/keyring when available.
- Provide redacted config for diagnostics.

Testing focus:

- Validation.
- Migration.
- Redaction.
- Missing secret behavior.

## Shared Contracts

Shared contracts should be explicit and versioned:

- HTTP route schemas.
- WebSocket event names and payloads.
- Error category names.
- History record schema.
- Prompt and dictionary schema.

Prefer generating TypeScript types from backend schemas later if the stack makes it practical.

## Boundary Rules

- Renderer never calls cloud APIs directly.
- Renderer never accesses local files directly.
- Backend never renders GUI.
- ASR and LLM clients never write history directly.
- Text injector never calls ASR or polishing logic.
- Logging utilities may be used everywhere, but must not introduce business logic.
- Any module touching files, APIs, database, clipboard, or desktop state must have tests and structured logs.
