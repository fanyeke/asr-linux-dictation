# Phase 3 — Polish & Hardening

## Goal
Fix security issues, error handling gaps, and expose backend features to the frontend.

## Tasks

### T1 — Secure token generation
**File:** `src/electron/main/backend-supervisor.ts`
**Change:** Replace `Math.random()` token generation with `crypto.randomUUID()`.
**Rationale:** `Math.random()` is not cryptographically secure.

### T2 — Mask API keys in GET /config
**Files:**
- `src/backend/main.py` — `GET /config` returns only `*_api_key_set: boolean` instead of raw keys
- `src/backend/config.py` — add helper to check if keys are set without returning them
- `src/electron/renderer/components/settings/ApiConfigSection.tsx` — adjust to handle masked response
**Rationale:** Prevents raw API keys from being returned to the renderer in plaintext.

### T3 — Surface errors instead of silent catch
**Files:**
- `src/electron/renderer/app.tsx` — replace `catch { // ignore }` with `console.error` + optional toast
- `src/electron/renderer/components/settings/ApiConfigSection.tsx` — surface network errors
- `src/electron/renderer/components/settings/DictionaryManager.tsx` — surface CRUD errors
- `src/electron/renderer/components/HistoryPage.tsx` — surface history fetch errors
- `src/electron/main/main.ts` — surface polling and WS errors
**Rationale:** Silent failures make debugging impossible and leave users confused.

### T4 — Expose failed_audio_path to frontend
**Files:**
- `src/electron/renderer/settings/types.ts` — add `failed_audio_path?: string | null` to `HistorySession`
- `src/electron/renderer/components/HistoryPage.tsx` — show replay/locate action for failed sessions
- `src/backend/history_store.py` — ensure `failed_audio_path` is included in session dict
**Rationale:** Users can replay or locate failed audio that the backend already retains.

### T5 — Add prompt CRUD UI
**File:** `src/electron/renderer/components/settings/PromptManager.tsx` (currently read-only placeholder)
**Add:** Create/edit/activate/delete prompts, mirroring the dictionary form pattern.
**Files to update:**
- `src/electron/renderer/components/settings/PromptManager.tsx`
- `src/electron/renderer/settings/types.ts` — ensure `Prompt` type has all needed fields
**Rationale:** Backend has full prompt CRUD API, but frontend only shows a read-only list.

## Verification
- [ ] Token is generated via `crypto.randomUUID()`
- [ ] GET /config never returns raw API keys
- [ ] No `catch { // ignore }` without at least `console.error`
- [ ] Failed sessions show `failed_audio_path` with replay/locate action
- [ ] Prompt manager has full CRUD UI
- [ ] All tests pass

## Commit
`phase-3: harden security, surface errors, expose failed audio, add prompt CRUD`
