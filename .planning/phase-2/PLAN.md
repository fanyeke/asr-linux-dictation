# Phase 2 — Frontend Refactor

## Goal
Clean up frontend technical debt: split monolithic SettingsPage, remove dead code, clean up ghost inserting phase.

## Tasks

### T1 — Extract SettingsPage sub-components
**File:** `src/electron/renderer/components/SettingsPage.tsx` (964 lines)
**Extract into:**
- `src/electron/renderer/components/settings/ApiConfigSection.tsx` — ASR/LLM API keys, base URLs, models, connection test
- `src/electron/renderer/components/settings/HotkeySection.tsx` — global hotkey input
- `src/electron/renderer/components/settings/PromptManager.tsx` — prompt list, create/edit/delete
- `src/electron/renderer/components/settings/DictionaryManager.tsx` — dictionary CRUD
- `src/electron/renderer/components/settings/DiagnosticsSection.tsx` — backend address, token, hotkey, export

**Rationale:** SettingsPage is 964 lines, mixing 5 unrelated concerns. Hard to test in isolation, violates module boundaries.

### T2 — Remove dead settings-window.tsx
**Files:**
- `src/electron/renderer/settings/settings-window.tsx` (dead code, 1477 lines)
- `src/electron/renderer/settings/types.ts` (if only used by settings-window)
- `tests/electron/renderer/settings/settings-window.test.tsx`

**Rationale:** Dead code imported only by its own test. Bloats bundle, confuses contributors.

### T3 — Remove ghost inserting phase
**Files to update:**
- `src/electron/renderer/settings/types.ts` — remove `inserting` from `PipelinePhase`
- `src/electron/renderer/overlay/overlay-window.tsx` — remove inserting handling (already mapped to polishing)
- `src/electron/renderer/overlay/types.ts` — remove inserting from types if present
- `src/electron/renderer/app.tsx` — remove inserting → polishing mapping
- `tests/electron/renderer/overlay/overlay-window.test.tsx` — remove inserting test cases

**Rationale:** Backend never broadcasts "inserting". Dead code, misleading types, wasted test coverage.

## Verification
- [ ] SettingsPage < 200 lines, delegates to sub-components
- [ ] settings-window.tsx removed from tree
- [ ] No "inserting" references in frontend code
- [ ] All tests pass

## Commit
`phase-2: refactor SettingsPage, remove dead code and inserting phase`
