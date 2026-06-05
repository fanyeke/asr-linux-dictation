# Frontend Refactoring Plan: Tabbed Layout + Phase Indicators + ASR/LLM Logging

## Context

The current `SettingsWindow` is a 1478-line monolithic component with all UI sections stacked in a single scrollable page. The user wants:

1. **Tabbed navigation** — separate pages for different functional areas
2. **Enhanced phase indicators** — recording shows red, ASR phase shows blue, LLM phase shows blue with distinct label
3. **ASR/LLM result logging** — display raw text and polished text in the UI after each dictation

## Architecture

### Tab Structure

Three tabs with left sidebar navigation (desktop-app pattern):

| Tab | Icon | Content |
|-----|------|---------|
| **Dictate** | Mic icon | Recording controls, waveform, phase pipeline indicator, result display |
| **History** | Clock icon | Session list with status badges, expandable detail showing raw/polished text |
| **Settings** | Gear icon | API config, hotkey, prompts, dictionary, diagnostics |

### New File Structure

```
src/electron/renderer/
  app.tsx                          — Updated: tab routing + sidebar
  components/
    TabSidebar.tsx                 — NEW: left sidebar with tab buttons
    Toast.tsx                      — NEW: extracted toast component
    DictatePage.tsx                — NEW: main dictation page
    HistoryPage.tsx                — NEW: history page with detail expansion
    SettingsPage.tsx               — NEW: extracted settings (API, hotkey, prompts, dict, diagnostics)
    DictationPanel.tsx             — NEW: recording controls + phase pipeline display
    PhaseIndicator.tsx             — NEW: animated phase pipeline (idle→recording→ASR→LLM→done)
    ResultDisplay.tsx              — NEW: shows ASR raw text and LLM polished text
  settings/
    settings-window.tsx            — KEPT but gutted (re-exports SettingsPage for backward compat)
    types.ts                       — Updated: add new types for phase pipeline display
  overlay/
    overlay-window.tsx             — Updated: enhanced ASR/LLM phase colors
    types.ts                       — Unchanged
```

### Phase Pipeline Component Design

Based on research findings (Carbon Design System, Google dictation UX):

```
┌─────────────────────────────────────────────────────┐
│  ● Recording    ○ Transcribing    ○ Polishing    ○ Done │
│  [red pulse]    [blue spinner]    [blue+LLM]    [green] │
│                                                          │
│  ▌▌▌▌▌▌▌▌▌▌▌▌ (waveform bars during recording)         │
│                                                          │
│  ASR Result: "你好世界..."                                │
│  LLM Result: "Hello, world!"                             │
└─────────────────────────────────────────────────────┘
```

Color mapping (from Carbon Design System):
- **Idle**: Gray `#888`
- **Recording**: Red `#ff4444` with CSS pulse animation
- **Transcribing (ASR)**: Blue `#4488ff` with spinner
- **Polishing (LLM)**: Indigo `#6366f1` with spinner
- **Completed**: Green `#22c55e` with checkmark
- **Failed**: Red `#ef4444` with X mark

### DictationStatus Type Changes

The existing `DictationStatus` union type in `overlay/types.ts` already has `transcribing` and `polishing` phases. No changes needed to the type — the UI just needs to display them differently.

### History Session Enhancement

The backend already returns `raw_text` and `polished_text` in history sessions. The History page will show these in an expandable detail row. No backend changes needed.

### Result Display After Dictation

When `stopDictation()` returns a `DictationResult` with `raw_text` and `polished_text`, the DictatePage will display both texts in a result panel below the phase indicator. This gives immediate feedback on ASR quality vs LLM quality.

## Implementation Steps

### Step 1: Extract shared utilities and types
- Move common styles, helpers (`maskToken`, `formatAccelerator`, `EyeIcon`, etc.) to shared files
- Update `types.ts` with any new types needed

### Step 2: Create TabSidebar and Toast components
- `TabSidebar.tsx` — vertical icon+label sidebar
- `Toast.tsx` — reusable toast notification

### Step 3: Create DictatePage with PhaseIndicator and ResultDisplay
- Phase pipeline with animated step indicators
- Recording controls (start/stop/quick test)
- Waveform level display
- Result panel showing ASR raw text and LLM polished text

### Step 4: Create HistoryPage
- Session list with status badges
- Expandable detail showing raw_text, polished_text, timing, error info
- Retry button for failed sessions

### Step 5: Create SettingsPage
- Extract API config, hotkey, prompts, dictionary, diagnostics from settings-window.tsx
- Reuse existing handlers and state management patterns

### Step 6: Update app.tsx with tab routing
- Sidebar + content area layout
- Tab state management

### Step 7: Update overlay-window.tsx
- Add ASR vs LLM phase distinction in labels
- Update colors for polishing phase to indigo `#6366f1`

### Step 8: Update main.ts to broadcast intermediate phases
- Currently the main process only broadcasts `recording`, `completed`, and `failed`
- Need to also broadcast `transcribing` and `polishing` phases
- The backend already updates session status through these phases; the main process can broadcast them when stop-dictation returns, or we add intermediate status callbacks

### Step 9: Update existing tests and add new tests
- Update `settings-window.test.tsx` for new component structure
- Add tests for PhaseIndicator, ResultDisplay, TabSidebar
- Add tests for DictatePage and HistoryPage

## Key Design Decisions

1. **No routing library** — Simple tab state via `useState<tab>` in app.tsx. No need for react-router for 3 tabs.
2. **Inline styles** — Continue the existing pattern of inline `React.CSSProperties` to match codebase conventions.
3. **No CSS animations library** — Use `@keyframes` injected via a `<style>` tag for the pulse animation.
4. **Shared state via props** — Continue the existing pattern of lifting state up. The backend config and status subscriptions live in app.tsx and are passed down.
5. **Backward compatibility** — Keep `settings-window.tsx` exporting `SettingsWindow` for the overlay test, but have it delegate to `SettingsPage`.

## Files Modified

| File | Action |
|------|--------|
| `src/electron/renderer/app.tsx` | Rewrite: sidebar + tab routing |
| `src/electron/renderer/settings/settings-window.tsx` | Rewrite: thin wrapper or removed |
| `src/electron/renderer/settings/types.ts` | Update: add ResultData type |
| `src/electron/renderer/overlay/overlay-window.tsx` | Update: ASR/LLM phase labels and colors |
| `src/electron/renderer/components/TabSidebar.tsx` | New |
| `src/electron/renderer/components/Toast.tsx` | New |
| `src/electron/renderer/components/DictatePage.tsx` | New |
| `src/electron/renderer/components/HistoryPage.tsx` | New |
| `src/electron/renderer/components/SettingsPage.tsx` | New |
| `src/electron/renderer/components/DictationPanel.tsx` | New |
| `src/electron/renderer/components/PhaseIndicator.tsx` | New |
| `src/electron/renderer/components/ResultDisplay.tsx` | New |
| `src/electron/main/main.ts` | Update: broadcast intermediate phases |
| `tests/electron/renderer/settings/settings-window.test.tsx` | Update |
| `tests/electron/renderer/overlay/overlay-window.test.tsx` | Update |
| `tests/electron/renderer/components/*.test.tsx` | New test files |

## Verification

1. `npm run build` compiles without errors
2. `npx vitest run` — all existing + new tests pass
3. Manual smoke: tabs switch correctly, recording shows red pulse, ASR shows blue, LLM shows indigo, results display after dictation
