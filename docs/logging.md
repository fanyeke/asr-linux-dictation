# Logging And Diagnostics Requirements

Logging is a product feature for this project. The app runs in the background, touches microphone input, cloud APIs, local files, and the active desktop window. When something fails, the logs must show what happened without leaking secrets or storing unnecessary user content.

## Goals

- Make dictation failures diagnosable.
- Keep normal logs small and quiet.
- Allow debug mode when reproducing a problem.
- Prevent log growth from filling disk.
- Preserve failed-session context without keeping successful audio.
- Avoid logging API keys, bearer tokens, full audio payloads, or large transcripts by default.

## Runtime Modes

The app supports at least two startup modes:

- `info`: default mode for daily use.
- `debug`: verbose mode for development and troubleshooting.

Optional later mode:

- `trace`: short-lived deep debugging for audio levels, IPC events, and request timing.

Startup examples:

```bash
asr-linux
asr-linux --log-level debug
ASR_LINUX_LOG_LEVEL=debug asr-linux
```

The effective log level should be visible in the first startup log entry.

## Log Locations

Use XDG paths on Linux:

```text
~/.local/state/asr-linux/logs/app.log
~/.local/state/asr-linux/logs/backend.log
~/.local/state/asr-linux/logs/electron.log
~/.local/state/asr-linux/failed-audio/
```

If the app is packaged, Electron and Python can write separate files. If the app is run in development mode, stdout is allowed, but file logs must still be available.

## Log Format

Use structured JSON Lines for backend logs.

Required fields:

```json
{
  "ts": "2026-06-04T20:00:00.000+08:00",
  "level": "INFO",
  "component": "backend",
  "event": "dictation_started",
  "session_id": "01J...",
  "message": "Dictation started"
}
```

Recommended fields when relevant:

- `request_id`
- `duration_ms`
- `status`
- `error_type`
- `retry_count`
- `audio_duration_ms`
- `audio_size_bytes`
- `api_provider`
- `model`
- `target_app`
- `target_window_class`

Do not rely only on free-form messages. Important values must be separate fields.

## Session Correlation

Each dictation attempt gets one `session_id`.

The same `session_id` must appear in logs for:

- Hotkey trigger.
- Recording start/stop.
- Audio file creation.
- ASR request.
- ASR response or failure.
- Polishing request.
- Polishing response or failure.
- Text injection.
- History write.
- Cleanup.

This is required so one failed dictation can be reconstructed from logs.

## Redaction Rules

Never log:

- API keys.
- Authorization headers.
- Raw base64 audio.
- Full audio file paths if they include sensitive names.
- Full successful transcript by default.
- Full polished text by default.

Allowed by default:

- Transcript length.
- First and last few characters only when useful, with a strict maximum.
- Hash of audio content for correlation.
- Failed audio file id.

Debug mode may log short transcript previews, but not full successful transcripts unless a user explicitly enables a separate diagnostic export.

## Retention And Rotation

Logs must rotate by size and clean by age.

Default policy:

- Max single log file: `10 MB`.
- Max rotated files per log: `5`.
- Max log age: `14 days`.
- Max total log directory size: `100 MB`.
- Cleanup runs at startup and then once per day while the app is running.

Failed audio policy:

- Successful dictation audio is deleted after the session finishes.
- Failed dictation audio is kept for retry/debugging.
- Failed audio max age: `7 days`.
- Failed audio max total size: `500 MB`.
- If limits are exceeded, delete oldest failed audio first.

The cleanup process itself must log what it deleted using counts and bytes, not every file path unless debug mode is enabled.

## Event Taxonomy

Use stable event names so logs can be searched reliably.

Startup:

- `app_starting`
- `config_loaded`
- `logging_configured`
- `backend_ready`
- `app_shutdown`

Hotkey and UI:

- `hotkey_registered`
- `hotkey_registration_failed`
- `hotkey_pressed`
- `overlay_shown`
- `overlay_hidden`

Recording:

- `recording_started`
- `recording_level`
- `recording_stopped`
- `recording_failed`
- `silence_detected`

ASR:

- `asr_request_started`
- `asr_request_succeeded`
- `asr_request_failed`
- `asr_response_invalid`

Polishing:

- `polish_request_started`
- `polish_request_succeeded`
- `polish_request_failed`
- `polish_fallback_used`

Text injection:

- `injection_started`
- `injection_succeeded`
- `injection_failed`
- `clipboard_restored`
- `clipboard_restore_failed`

Persistence and cleanup:

- `history_record_created`
- `failed_audio_saved`
- `successful_audio_deleted`
- `cleanup_started`
- `cleanup_completed`
- `cleanup_failed`

## Error Categories

Use stable `error_type` values:

- `config_error`
- `microphone_unavailable`
- `recording_error`
- `asr_auth_error`
- `asr_timeout`
- `asr_rate_limited`
- `asr_invalid_response`
- `polish_auth_error`
- `polish_timeout`
- `polish_rate_limited`
- `polish_invalid_response`
- `network_error`
- `injection_error`
- `clipboard_error`
- `database_error`
- `unknown_error`

Every failed history record should store one of these categories.

## User-Facing Diagnostics

The GUI should expose:

- Current log level.
- Open logs directory.
- Run ASR connectivity test.
- Run LLM connectivity test.
- Run microphone test.
- Export diagnostic bundle.
- Clear old logs now.

Diagnostic export should include:

- Recent logs.
- App version.
- OS/session type.
- Config with secrets redacted.
- Failed-session metadata.
- Failed audio only when the user explicitly selects it.

## Development Requirements

New code that introduces a background task, API request, file write, database write, or desktop action must add logs for:

- Start.
- Success.
- Failure.
- Duration when meaningful.

Tests must cover:

- Log level selection.
- Rotation/cleanup policy.
- Redaction of secrets.
- Session id propagation for dictation pipeline events.

Logging changes are not complete until they have tests or a documented manual verification step.
