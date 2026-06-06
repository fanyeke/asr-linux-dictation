# Phase 9: Scene Profiles — PLAN.md

## Goal

5 preset scene system with CRUD, pipeline integration, and quick-switch.

## Requirements

PRO-01, PRO-02, PRO-03, PRO-04, PRO-05, PRO-06, PRO-07

## Exit Criteria

- [ ] `profiles` table created; 5 presets seeded on migration
- [ ] CRUD API operational (list/get/create/update/delete)
- [ ] Settings → "场景管理" panel with tab/dropdown for active profile
- [ ] Dictation pipeline uses active profile's prompt + dictionary association
- [ ] User can duplicate a preset and customize
- [ ] Tray menu has profile quick-switch submenu
- [ ] All new code has TDD tests and structured timing logs
- [ ] Frontend: no white-screen regression

## Workstreams

### Wave 1: Profiles Backend

| # | Task | TDD | Files |
|---|------|-----|-------|
| 1.1 | `profile_manager.py` — CRUD (create/get/list/update/delete) + seed_profiles() | ✅ | `src/backend/profile_manager.py` (new) |
| 1.2 | `database.py` — profiles table + seed 5 presets | ✅ | `src/backend/database.py` |
| 1.3 | `main.py` — CRUD routes (GET/POST/PUT/DELETE /profiles) | ✅ | `src/backend/main.py` |
| 1.4 | `dictation_orchestrator.py` — use active profile's prompt + dictionary + language | ✅ | `src/backend/dictation_orchestrator.py` |
| 1.5 | Tests: CRUD + seed + pipeline integration | ✅ | `tests/backend/test_profile_manager.py` |

### Wave 2: Profiles Frontend

| # | Task | TDD | Files |
|---|------|-----|-------|
| 2.1 | `ProfileManager.tsx` — settings tab with profile list + CRUD + active switch | ✅ | `src/electron/renderer/components/settings/ProfileManager.tsx` (new) |
| 2.2 | Wire ProfileManager into SettingsPage | — | `src/electron/renderer/components/SettingsPage.tsx` |
| 2.3 | Tray menu: profile quick-switch submenu | ✅ | `src/electron/main/main.ts` |
| 2.4 | i18n: profile strings (zh/en) | — | `src/electron/renderer/lib/i18n.ts` |

## TDD Loop

RED → GREEN → REFACTOR → commit `phase-9: <feature>`

## Test Commands

```
uv run pytest tests/backend -q
npm run test
npx tsc --noEmit
npm run build
```
