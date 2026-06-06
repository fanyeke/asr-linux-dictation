# Phase 7: History & Overlay — PLAN.md

## Goal

Make history actionable, dictionary transparent, and overlay feedback polished.

## Requirements

HST-01, HST-02, HST-03, HST-04, HST-05, HST-06, DIC-01, DIC-02, DIC-03, DIC-04, OVL-03, OVL-04, OVL-05, OVL-06

## Exit Criteria

- [ ] Each history item has a copy button that copies polished_text and shows "已复制" toast
- [ ] History page has export button with txt/md format dialog
- [ ] Each dictionary entry shows match frequency badge
- [ ] Overlay step dots replaced with continuous progress bar
- [ ] Progress bar shows per-phase color and pulse animation
- [ ] "Transcribing" and "polishing" display as distinct states in overlay
- [ ] VAD countdown renders as gray tail fill on progress bar
- [ ] Completed state shows green bar for 2s then fade out
- [ ] All new code has TDD tests and structured timing logs
- [ ] Frontend: no white-screen regression — defensive rendering
- [ ] 255+ frontend + 236+ backend tests still pass

## Workstreams

### Wave 1: History Copy & Export

| # | Task | TDD | Files |
|---|------|-----|-------|
| 1.1 | Preload: add `copyToClipboard(text: string)` IPC handler | — | `src/electron/preload/preload.cts`, `types.ts` |
| 1.2 | Main: handle `copy-to-clipboard` IPC using Electron clipboard module | — | `src/electron/main/main.ts` |
| 1.3 | SessionListItem: add copy button in expanded state, show toast | ✅ | `src/electron/renderer/components/SessionListItem.tsx` |
| 1.4 | Test: copy button appears and copies text | ✅ | `src/electron/renderer/components/__tests__/SessionListItem.test.tsx` |
| 1.5 | Backend: `GET /history/export?format=txt` — `[timestamp] polished_text` | ✅ | `src/backend/main.py` |
| 1.6 | Backend: `GET /history/export?format=md` — structured markdown | ✅ | `src/backend/main.py` |
| 1.7 | Test: export txt format | ✅ | `tests/backend/test_history_export.py` |
| 1.8 | Test: export md format | ✅ | `tests/backend/test_history_export.py` |
| 1.9 | HistoryPage: add "导出" button + format select dialog | ✅ | `src/electron/renderer/components/HistoryPage.tsx` |
| 1.10 | Test: export button renders and triggers download | ✅ | `src/electron/renderer/components/__tests__/HistoryPage.test.tsx` |
| 1.11 | i18n: strings for export dialog | — | `src/electron/renderer/lib/i18n.ts` |

**Logging:** `history_export: {format, count, size_bytes}`

### Wave 2: Dictionary Match Stats

| # | Task | TDD | Files |
|---|------|-----|-------|
| 2.1 | DB: create `dictionary_stats` table (entry_id, session_id, matched_count, created_at) | ✅ | `src/backend/database.py` |
| 2.2 | Function: `count_dictionary_matches(entries, polished_text)` returns match counts | ✅ | `src/backend/dictionary_manager.py` |
| 2.3 | Write stats: call after polish completes in orchestrator | ✅ | `src/backend/dictation_orchestrator.py` |
| 2.4 | API: `GET /dictionary/stats/entries` — aggregate per entry (last 10 sessions) | ✅ | `src/backend/main.py` |
| 2.5 | Test: match counting logic | ✅ | `tests/backend/test_dictionary_manager.py` |
| 2.6 | Test: stats persistence and aggregation | ✅ | `tests/backend/test_dictionary_manager.py` |
| 2.7 | Frontend: DictionaryManager — each entry shows stats badge | ✅ | `src/electron/renderer/components/settings/DictionaryManager.tsx` |
| 2.8 | i18n: strings for stats display | — | `src/electron/renderer/lib/i18n.ts` |

**Logging:** `dict_stats: {session_id, entries: [{id, term, count}]}`

### Wave 3: Overlay Progress Bar + Fix Status Merge

| # | Task | TDD | Files |
|---|------|-----|-------|
| 3.1 | **Fix:** Debug WS status update for polishing phase — ensure overlay shows distinct transcribing/polishing states | ✅ | `src/electron/main/main.ts` |
| 3.2 | Create ProgressBar component (replaces step dots + level bar) | ✅ | `src/electron/renderer/overlay/ProgressBar.tsx` (new) |
| 3.3 | Phase→color/width/pulse mapping: recording=red/waving, transcribing=blue/pulse(40%), polishing=purple/pulse(75%), completed=green(100%), failed=red(100%) | ✅ | `src/electron/renderer/overlay/ProgressBar.tsx` |
| 3.4 | VAD countdown: receive silence_countdown WS event → gray tail fill | ✅ | `src/electron/renderer/overlay/ProgressBar.tsx` |
| 3.5 | Completed: full green bar, 2s timeout, fade out | ✅ | `src/electron/renderer/overlay/ProgressBar.tsx` |
| 3.6 | Wire ProgressBar into OverlayWindow | — | `src/electron/renderer/overlay/overlay-window.tsx` |
| 3.7 | Test: ProgressBar renders each phase correctly | ✅ | `tests/electron/renderer/overlay/overlay-window.test.tsx` |
| 3.8 | Test: completed fade out after 2s | ✅ | `tests/electron/renderer/overlay/overlay-window.test.tsx` |

**Logging:** `overlay_progress: {phase, timestamp, transition_ms}`

### Wave 4: Integration & Final Verification

| # | Task | TDD | Files |
|---|------|-----|-------|
| 4.1 | Full test suite run (backend + frontend) | — | — |
| 4.2 | TypeScript type check | — | — |
| 4.3 | Build verification | — | — |
| 4.4 | Manual smoke: export, copy, overlay visual | — | — |

## TDD Loop

1. Write the smallest failing test
2. Run → RED
3. Implement → GREEN
4. Refactor → stay GREEN
5. Commit `phase-7: <feature>`

## Test Commands

```bash
# Backend
uv run pytest tests/backend -q

# Frontend
npm run test

# TypeScript check
npx tsc --noEmit

# Build
npm run build
```

## Subagent Dispatch Plan

- **Subagent A** → Wave 1 (History copy + export backend)
- **Subagent B** → Wave 2 (Dictionary stats backend)
- **Orchestrator** → Wave 3 (Overlay) + Wave 4 (Integration) + frontend for 1 & 2

## must_haves

- Copy button works on each history item
- Export produces valid txt/md
- Dictionary stats persist and display
- Overlay shows distinct phase states (recording/transcribing/polishing/completed/failed)
- No frontend white-screen regression
