# Phase 6: Core Config & UX — PLAN.md

## Goal

Deliver three low-hanging UX improvements: ASR language selection, user-configurable VAD auto-stop, and level polling optimization.

## Requirements

ASR-01, ASR-02, ASR-03, ASR-04, ASR-05, VAD-01, VAD-02, VAD-03, VAD-04, VAD-05, VAD-06, VAD-07, OVL-01, OVL-02

## Exit Criteria

- [ ] User can select zh/en/auto ASR language from Settings dropdown — persisted across restarts
- [ ] Tray menu shows current language with quick-switch submenu
- [ ] All 223+ backend tests + 255+ frontend tests still pass
- [ ] New code has TDD tests covering all changes
- [ ] Structured timing logs added for all new operations
- [ ] User can enable/disable VAD and adjust threshold/duration from Settings
- [ ] VAD toggle respected by AudioRecorder — existing silence detection continues working
- [ ] VAD countdown shown in overlay during active silence detection
- [ ] Level polling rate benchmarked and optimized (target 60–80ms)
- [ ] WebSocket push evaluated for mic level (performance comparison documented)
- [ ] Frontend: no white-screen regression — defensive rendering on all new components

## Workstreams

---

### Wave 1: ASR Language Selection

**TDD approach:** Write failing test → implement → refactor → commit.

| # | Task | TDD | Files |
|---|------|-----|-------|
| 1.1 | Add `asr_language` field to `UserConfig` dataclass (default `"auto"`) + `from_dict`/`to_dict` | ✅ | `src/backend/config_store.py` |
| 1.2 | DB migration: `ALTER TABLE user_config ADD COLUMN asr_language TEXT DEFAULT 'auto'` | ✅ | `src/backend/database.py` |
| 1.3 | Accept `asr_language` in `POST /config` route | ✅ | `src/backend/main.py` |
| 1.4 | Return `asr_language` in `GET /config` route | ✅ | `src/backend/main.py` |
| 1.5 | Tests: config_store persists/loads asr_language | ✅ | `tests/backend/test_config_store.py` |
| 1.6 | Tests: API accepts and returns asr_language | ✅ | `tests/backend/test_api.py` |
| 1.7 | Verify `DictationOrchestrator.process()` already passes `settings.asr_language` to `ASRClient.transcribe()` — no-op if already working, add if missing | ✅ | `src/backend/dictation_orchestrator.py` |
| 1.8 | Frontend: add `asrLanguage: string` to `UserConfig` interface in `settings/types.ts` | - | `src/electron/renderer/settings/types.ts` |
| 1.9 | Frontend: add ASR language `<select>` dropdown to Settings → API Config area | ✅ | `src/electron/renderer/components/SettingsPage.tsx` |
| 1.10 | Frontend: tray menu submenu for language quick-switch | ✅ | `src/electron/main/main.ts` |
| 1.11 | Frontend tests: language dropdown renders and submits | ✅ | `src/electron/renderer/components/__tests__/` |

**Logging:**
- `language_switch`: `{source: "settings"|"tray", language: "zh"|"en"|"auto", timestamp}`
- Add to `POST /config` handler — log changed fields

**Frontend safety:**
- Language dropdown: default to "auto" if value is missing/undefined
- Tray menu: rebuild gracefully if backend unreachable
- Test: verify Settings page doesn't crash with missing `asrLanguage`

---

### Wave 2: VAD Silence Detection

**TDD approach:** Write failing test → implement → refactor → commit.

| # | Task | TDD | Files |
|---|------|-----|-------|
| 2.1 | Add `vad_enabled` (bool, default True) to `UserConfig` + `from_dict`/`to_dict` | ✅ | `src/backend/config_store.py` |
| 2.2 | DB migration: `ALTER TABLE user_config ADD COLUMN vad_enabled INTEGER DEFAULT 1` | ✅ | `src/backend/database.py` |
| 2.3 | Accept `vad_enabled` + `vad_threshold` + `vad_duration_ms` in `POST /config` | ✅ | `src/backend/main.py` |
| 2.4 | Return VAD fields in `GET /config` | ✅ | `src/backend/main.py` |
| 2.5 | **Key change:** `AudioRecorder.start()` checks `vad_enabled` → only launches `_detect_silence()` when True | ✅ | `src/backend/audio_recorder.py` |
| 2.6 | Tests: config_store persists/loads VAD fields | ✅ | `tests/backend/test_config_store.py` |
| 2.7 | Tests: recorder respects VAD toggle (starts silence task only when enabled) | ✅ | `tests/backend/test_audio_recorder.py` |
| 2.8 | Tests: API accepts and returns VAD fields | ✅ | `tests/backend/test_api.py` |
| 2.9 | Frontend: add VAD fields to `UserConfig` interface | - | `src/electron/renderer/settings/types.ts` |
| 2.10 | Frontend: Settings → new "静音检测" card with toggle + threshold slider + duration slider | ✅ | `src/electron/renderer/components/settings/` |
| 2.11 | Tests: Settings VAD card renders and submits | ✅ | `src/electron/renderer/components/__tests__/` |
| 2.12 | Backend: broadcast `silence_countdown` via WebSocket during active silence detection | ✅ | `src/backend/audio_recorder.py`, `src/backend/main.py` |
| 2.13 | Overlay: receive `silence_countdown` event → render gray countdown tail on progress bar | ✅ | `src/electron/renderer/overlay/overlay-window.tsx` |
| 2.14 | Tests: overlay renders countdown properly | ✅ | `tests/electron/renderer/overlay/overlay-window.test.tsx` |

**Logging:**
- `vad_state`: `{enabled, threshold, duration_ms, silence_start, silence_elapsed_ms, session_id}` at silence detection
- `vad_config_change`: `{old_enabled, new_enabled, old_threshold, new_threshold}` in `POST /config`

**Frontend safety:**
- VAD card: default to enabled if config value missing
- Sliders: clamp to valid ranges (threshold 0.001–0.05, duration 500–5000)
- Overlay: no `silence_countdown` event → don't render countdown tail (graceful degradation)
- Test: Settings page doesn't crash with missing VAD fields

---

### Wave 3: Level Polling Optimization

**TDD approach:** Benchmark-driven — measure, change, re-measure.

| # | Task | TDD | Files |
|---|------|-----|-------|
| 3.1 | Benchmark current 100ms polling: CPU usage + average response_time per poll over 1 min (manual) | - | docs |
| 3.2 | Reduce interval from 100ms to 60ms | - | `src/electron/main/main.ts` line 202 |
| 3.3 | Re-benchmark: CPU + response_time at 60ms (manual) | - | docs |
| 3.4 | Add response_time logging to `/dictation/level` handler | ✅ | `src/backend/main.py` |
| 3.5 | Add polling interval logging in main process | - | `src/electron/main/main.ts` |
| 3.6 | Evaluate WebSocket push for mic level: design doc (brief) | - | `docs/phase-6-ws-eval.md` |
| 3.7 | Tests: verify response_time logging works | ✅ | `tests/backend/test_api.py` |

**Logging:**
- `/dictation/level` handler: `level_poll: {response_time_ms, level}`
- Main process: `level_poll_interval: {interval_ms}` on change

**Frontend safety:**
- Level value is 0.0–1.0 float; handle NaN/undefined defensively
- If level endpoint fails, overlay still shows phase text (no crash)

---

## Logging Instrumentation Summary

| Point | Log Key | Fields |
|-------|---------|--------|
| Language changed | `language_switch` | source, language, timestamp |
| Config updated | `config_update` | changed_fields: [...] |
| VAD state | `vad_state` | enabled, threshold, duration_ms, silence_start, silence_elapsed_ms, session_id |
| Level poll | `level_poll` | response_time_ms, level |
| Polling interval | `level_poll_interval` | interval_ms |

## TDD Loop

For each task marked TDD:
1. Write the smallest failing test
2. Run `uv run pytest tests/backend/test_<module>.py -v` → confirm RED
3. Implement → GREEN
4. Refactor if needed → stay GREEN
5. Commit with message `phase-6: <feature>`

## Test Commands

```bash
# Backend
uv run pytest tests/backend -q

# Frontend
npm run test

# Type check (frontend safety)
npx tsc --noEmit

# Build check (frontend safety)
npm run build
```

## Subagent Dispatch Plan

- **Subagent A** → Wave 1 (ASR Language: backend + frontend + tray)
- **Subagent B** → Wave 2 (VAD: backend toggle + Settings UI + overlay countdown)
- **Orchestrator** → Wave 3 (level optimization) + integration + final test run

## must_haves

(What cannot be cut — these define "done" for Phase 6)

- ASR language persisted and used in transcription
- VAD can be disabled by user
- New tests pass
- New logs enable performance analysis
- Frontend survives missing config values (no white screen)
