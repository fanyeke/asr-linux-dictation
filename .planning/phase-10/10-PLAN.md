# Phase 10: History Redesign — PLAN.md

## Goal

Transform history from "expand-to-see" to "scan-and-use" — higher information density, shorter operation paths.

## Features

1. **Collapsed preview**: Show first ~30 chars of polished_text in list item
2. **Always-visible copy**: Copy button on header, no expansion needed
3. **Diff-style ASR/LLM view**: Side-by-side or diff-highlight in expanded state
4. **Failed highlight**: Red background for failed entries in list
5. **Search/filter**: Text search + status filter bar on top

## Wave Breakdown

### Wave 1: Backend — History Search API

| # | Task | TDD | Files |
|---|------|-----|-------|
| 1.1 | `GET /history/search?q=&status=` — SQL LIKE search on raw_text/polished_text, optional status filter | ✅ | `src/backend/main.py` |
| 1.2 | Tests: search by text, search by status, combined, empty results | ✅ | `tests/backend/test_history_search.py` |

### Wave 2: Frontend — List item redesign

| # | Task | TDD | Files |
|---|------|-----|-------|
| 2.1 | SessionListItem: show text preview in header (first 30 chars of polished/raw) | ✅ | `src/electron/renderer/components/SessionListItem.tsx` |
| 2.2 | Always-visible copy icon button on header right | ✅ | `src/electron/renderer/components/SessionListItem.tsx` |
| 2.3 | Failed entries: light red background on the card | ✅ | `src/electron/renderer/components/SessionListItem.tsx` |
| 2.4 | Frontend tests: preview text, copy, failed bg | ✅ | tests |

### Wave 3: Frontend — Diff view

| # | Task | TDD | Files |
|---|------|-----|-------|
| 3.1 | Simple word-level diff function (split by space/char, compare) | ✅ | `src/electron/renderer/lib/diff.ts` (new) |
| 3.2 | Diff rendering in expanded state: green=added, red=deleted, yellow=changed | ✅ | `src/electron/renderer/components/SessionListItem.tsx` |
| 3.3 | Fallback: side-by-side view when diff is empty or same | ✅ | `src/electron/renderer/components/SessionListItem.tsx` |

### Wave 4: Frontend — Search/filter bar

| # | Task | TDD | Files |
|---|------|-----|-------|
| 4.1 | HistoryPage: search input + status filter dropdown above list | ✅ | `src/electron/renderer/components/HistoryPage.tsx` |
| 4.2 | Wire search to backend API with debounce | ✅ | `src/electron/renderer/components/HistoryPage.tsx` |
| 4.3 | i18n: search/filter strings | — | i18n |
