# Phase 1 — Bug Fix Sprint

## Goal
Fix 4 UI/UX and backend bugs in one sprint.

## Tasks

### T1 — Remove OverlayWindow from main window DOM
**File:** `src/electron/renderer/app.tsx`
**Change:** Delete line 401 `<OverlayWindow />` and its import (line 20).
**Rationale:** OverlayWindow is only for the separate overlay BrowserWindow (`overlay.html`). Rendering it inside `app.tsx` causes a dark sidebar artifact in the main window.

### T2 — Keep overlay visible during pipeline
**File:** `src/electron/main/main.ts`
**Change:** In the WebSocket `onmessage` handler (lines 233-269), add `overlayWindow.showInactive()` after sending `status-update` (around line 263).
**Rationale:** Currently overlay is hidden at stop-dictation (line 216) and only re-shown after the API returns (line 330). Intermediate phases (transcribing, polishing) are invisible. Re-showing on every WS status update keeps the user informed.

### T3 — Transparent overlay window background
**File:** `src/electron/main/main.ts`
**Change:** Add `transparent: true` to `BrowserWindow` config in `createOverlayWindow()` (around line 93).
**Also check:** `src/electron/renderer/overlay.html` body background — ensure it does not force an opaque color.
**Rationale:** Without `transparent: true`, the BrowserWindow has a white background that leaks through the `rounded-xl` corners of the overlay content.

### T4 — Simplify dictionary lookup
**Files:** `src/backend/dictation_orchestrator.py`
**Change:** Replace `find_relevant_entries(raw_text)` with `list_entries()` in both `process()` and `retry_from_text()`. All dictionary entries are mapped and passed to `polish_client.polish()`.
**Rationale:** Pinyin-based fuzzy matching is unreliable for English terms. Passing all entries to the LLM lets it decide replacements based on context, removing brittle matching logic.

## Verification
- [ ] Main window has no right-edge dark bar
- [ ] Overlay stays visible through transcribing → polishing → completed/failed
- [ ] Overlay corners are transparent (no white pixels)
- [ ] Dictionary entries are passed to LLM regardless of transcript content

## Commit
`phase-1: fix ui artifacts, overlay visibility, and dictionary lookup`
