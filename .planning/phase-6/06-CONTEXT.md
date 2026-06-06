# Phase 6: Core Config & UX — Context

**Gathered:** 2026-06-06
**Status:** Ready for planning
**Source:** Discussion with user

## Phase Boundary

Phase 6 delivers three low-hanging UX improvements that build on existing infrastructure:
1. ASR language selection (dropdown + tray quick-switch)
2. VAD silence detection (user-configurable switch + params + overlay countdown)
3. Level polling optimization (benchmark + WebSocket push evaluation)

## Implementation Decisions

### ASR Language Selection
- Backend `Settings.asr_language` already exists — no infra needed
- Need to add `asr_language` to `UserConfig` dataclass and `user_config` DB table
- `POST /config` handler already accepts dynamic fields — wire in
- Frontend: dropdown in Settings API Config area (zh/en/auto)
- Tray: submenu under tray context menu for quick language switching
- Frontend types: add `uiLanguage` to `UserConfig` in `settings/types.ts`
- Logging: `language_switch` with source + language

### VAD Silence Detection
- `AudioRecorder._detect_silence()` already exists and works
- Current behavior: enabled when `settings.silence_duration_ms > 0`
- Need to add `vad_enabled` toggle to UserConfig
- When VAD disabled: `start()` should NOT launch `_detect_silence()`
- When VAD enabled: behavior same as today (threshold + duration from config)
- Settings UI: toggle + two sliders (threshold 0.001-0.05, duration 500-5000ms)
- Overlay: WebSocket event `silence_countdown` → gray tail on progress bar
- Logging: `vad_state` with silence_start/elapsed timestamps

### Level Polling Optimization
- Current: `setInterval` 100ms in main process → HTTP GET `/dictation/level`
- Phase 6: reduce to 60ms, benchmark CPU/network impact
- Phase 6: evaluate WebSocket push approach
- Phase 7 (not this phase): implement WS push if decision is made
- Logging: `level_poll_response_ms` per request

## Specific Ideas

- VAD default = enabled (backward compatible with current behavior)
- ASR language default = "auto" (backward compatible)
- Level polling at 60ms target (40% improvement over current 100ms)
- Language can be switched from tray without opening Settings window

## Deferred Ideas

- Scene profiles (Phase 9) may later override ASR language per profile
- WebSocket mic level push deferred to Phase 7 decision point
- VAD countdown visual indicator requires overlay changes (Phase 6, Wave 2)

---

*Phase: 06-core-config-ux*
*Context gathered: 2026-06-06*
