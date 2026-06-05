# Requirements

## Active: Bug Fix Sprint

### R1 — Right Sidebar Artifact
**Problem:** All pages show an unwanted dark sidebar on the right edge.
**Root cause:** `OverlayWindow` component is rendered inside `app.tsx` DOM tree, but it should only exist in the separate overlay BrowserWindow.
**Acceptance:** Main window shows only TabSidebar (left) + content area. No dark artifact on right.

### R2 — Overlay Disappears During Pipeline
**Problem:** After recording stops, the overlay window hides for ~300ms+ while the backend processes ASR/polish. Users cannot see intermediate phases (transcribing → polishing).
**Root cause:** `main.ts` `stop-dictation` handler calls `overlayWindow.hide()` before calling backend, and only re-shows after the API returns.
**Acceptance:** Overlay remains visible throughout the entire pipeline (recording → transcribing → polishing → completed/failed), with smooth phase transitions.

### R3 — Rounded Corner White Bleed
**Problem:** The overlay window has rounded corners (`rounded-xl`) but the parent BrowserWindow background is white, causing white pixels at the corners.
**Root cause:** BrowserWindow default background is opaque white; no `transparent: true` set.
**Acceptance:** Overlay corners are fully transparent, blending with desktop wallpaper.

### R4 — Dictionary Replacement Not Applied
**Problem:** Setting a dictionary entry (e.g., canonical="claude code", pronunciation="cloud code") does not cause the LLM to replace "cloud code" with "claude code" in transcripts.
**Root cause:** `find_relevant_entries` uses pinyin-based fuzzy matching which is unreliable for English terms. The matching logic is overly complex and misses matches.
**Decision:** Simplify dictionary lookup — pass all dictionary entries to the LLM system prompt and let the LLM handle replacement based on context. Remove pinyin matching complexity.
**Acceptance:** Any dictionary entry defined in settings is considered by the LLM during polish. No manual matching logic required.
