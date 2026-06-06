# Phase 7: History & Overlay — Context

**Gathered:** 2026-06-06
**Status:** Ready for planning
**Source:** Requirements + user feedback

## Phase Boundary

Phase 7 delivers three incremental enhancements on existing UI:
1. History Record Enhancement — copy button, export (txt/md)
2. Dictionary Matching Frequency — per-entry stats after polish
3. Overlay Progress Bar — continuous bar, phase colors, VAD countdown, fix transcribing/polishing merge

## Known Issues to Fix

- **Overlay status merge:** `transcribing` and `polishing` phases both display as "识别中" — WS status updates aren't properly updating the overlay phase during pipeline execution. The overlay initially shows "transcribing" immediately after stop (hardcoded in main.ts:220), and subsequent WS events for "polishing" should override but may not be working correctly.
- **Deferred from Phase 6:** VAD silence countdown visual (VAD-06) — combine with progress bar redesign.

## Implementation Decisions

### History Copy Button
- Use `navigator.clipboard.writeText()` via Electron preload bridge
- Preload: add `copyToClipboard(text)` IPC method
- Show "已复制" toast on success
- Each SessionListItem gets a copy button in expanded state

### History Export
- Backend: `GET /history/export?format=txt|md` route
- txt: `[timestamp] polished_text` per line
- md: Full markdown with timestamp, raw, polished, status
- Frontend: "导出" button in HistoryPage header + format dialog

### Dictionary Match Frequency
- New `dictionary_stats` table: entry_id, session_id, matched_count, created_at
- After polish in orchestrator, count each entry's occurrences in polished_text
- `GET /dictionary/stats/entries` — aggregate per entry (last 10 sessions)
- Frontend: each DictionaryManager entry shows stats badge

### Overlay Progress Bar
- Replace step dots + level bar with single continuous progress bar
- Phase→color mapping: recording=red, transcribing=blue, polishing=purple, completed=green, failed=red
- Non-terminal phases get pulse animation
- Completed: full green bar, 2s delay, fade out
- VAD countdown: gray tail fill during silence
- Fix WS phase update issue — ensure polishing phase is shown correctly

## Deferred Ideas

- WebSocket push for mic level (OVL-02) — still evaluating, not urgent
- History search/filter — Phase 9+
- Profile-based dictionary filtering — Phase 9

---

*Phase: 07-history-overlay*
*Context gathered: 2026-06-06*
