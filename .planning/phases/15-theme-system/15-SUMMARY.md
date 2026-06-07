# Phase 15 — Theme System: Summary

## Goal

Implement warm light theme and deep blue-gray dark theme with CSS variables, persistence, and smooth transitions.

## Tasks Completed

### Task 1: Define CSS Custom Properties ✅
- Added shadcn/ui-compatible CSS variables (`--background`, `--foreground`, `--card`, `--primary`, etc.) to `globals.css`
- Light theme defaults (`#f6f7f9` bg, `#6366f1` primary)
- Dark theme via `.dark` class (`#0f172a` bg, `#818cf8` primary)
- 300ms transitions on `html` element for `background-color`, `color`, `border-color`
- `prefers-reduced-motion: reduce` disables all transitions

### Task 2: Create ThemeProvider React Context ✅
- Created `src/electron/renderer/components/ThemeProvider.tsx` with:
  - `ThemeProvider` component and `useTheme` hook
  - Reads theme from `localStorage` on mount, then syncs with backend via IPC
  - Watches system theme preference changes when theme is `"system"`
  - Applies `.dark` class to `document.documentElement`

### Task 3: Add Backend Theme Persistence ✅
- Added `theme` field to `UserConfig` model (`str = "light"`)
- Added `theme` column migration in `database.py` (ALTER TABLE)
- Updated `config_store.py` load/save to handle `theme` field
- Updated `GET /config` and `POST /config` endpoints to return/accept `theme`
- Validation: invalid theme values return 400

### Task 4: Connect Frontend to Backend (IPC Bridge) ✅
- Created `src/electron/main/theme-manager.ts` with singleton `ThemeManager`
- Added IPC channels: `theme:get`, `theme:set`, `theme:changed`
- Updated preload (`preload.cts`) to expose `window.voiceAPI.theme.get()/set()/onChange()`
- Updated `VoiceAPI` TypeScript interfaces in both preload and overlay types
- Updated `main.ts` to initialize ThemeManager and load theme from backend on startup
- ThemeProvider syncs with backend on mount and broadcasts changes to all windows

### Task 5: Implement Reduced Motion Support ✅
- CSS: `@media (prefers-reduced-motion: reduce)` block disables all transitions/animation
- ThemeProvider: detects `prefers-reduced-motion` media query
- Sets `data-reduced-motion="true"` attribute on `<html>` when active
- Reacts to runtime changes in reduced motion preference

### Task 6: shadcn/ui Component Compatibility ✅
- Updated `Card` to use `bg-[var(--card)]` and `border-[var(--border)]`
- Updated `Input` to use `bg-[var(--background)]`, `border-[var(--input)]`, `text-[var(--foreground)]`
- Updated `Button` to use `bg-[var(--card)]`, `border-[var(--border)]`, `focus:ring-[var(--ring)]`
- Updated `TabSidebar` mobile nav to use CSS variables
- Updated `HistoryPage` export dialog and `SessionListItem` surfaces
- Added `darkMode: "class"` to Tailwind config

### Task 7: Add Settings UI for Theme Toggle ✅
- Added `ThemeSelector` component with Light/Dark/System segmented control
- Added "Appearance" section in SettingsPage with theme preview card
- Added i18n keys for theme labels (zh + en)

### Task 8: Write Tests ✅
- **Frontend** (`ThemeProvider.test.tsx`): 14 tests covering light/dark/system theme, localStorage persistence, reduced motion, custom storageKey/defaultTheme
- **Backend** (`test_theme_config.py`): 6 tests covering default value, persistence, system theme, invalid theme validation, round-trip
- All 265 frontend tests and 6 backend tests pass

## Files Modified

| File | Change |
|------|--------|
| `src/electron/renderer/styles/globals.css` | Added CSS variables for light/dark themes, transitions, reduced-motion |
| `src/electron/renderer/tailwind.config.ts` | Added `darkMode: "class"` |
| `src/electron/renderer/components/ThemeProvider.tsx` | **New** — Theme context provider with IPC sync |
| `src/electron/renderer/app.tsx` | Wrapped app with `ThemeProvider` |
| `src/electron/renderer/components/SettingsPage.tsx` | Added Appearance section with theme selector |
| `src/electron/renderer/lib/i18n.ts` | Added theme-related translation keys |
| `src/electron/renderer/components/ui/Card.tsx` | Updated to use CSS variables |
| `src/electron/renderer/components/ui/Input.tsx` | Updated to use CSS variables |
| `src/electron/renderer/components/ui/Button.tsx` | Updated to use CSS variables |
| `src/electron/renderer/components/TabSidebar.tsx` | Updated mobile nav to use CSS variables |
| `src/electron/renderer/components/HistoryPage.tsx` | Updated export dialog to use CSS variables |
| `src/electron/renderer/components/SessionListItem.tsx` | Updated surfaces to use CSS variables |
| `src/electron/renderer/overlay/types.ts` | Added `theme` to VoiceAPI interface |
| `src/electron/main/theme-manager.ts` | **New** — Main-process theme persistence manager |
| `src/electron/main/main.ts` | Register theme IPC handlers, load theme on startup |
| `src/electron/preload/preload.cts` | Added `theme` methods to exposed API |
| `src/electron/preload/types.ts` | Added `theme` interface to VoiceAPI |
| `src/backend/config_store.py` | Added `theme` field to UserConfig, SQL queries |
| `src/backend/database.py` | Added `theme` column migration |
| `src/backend/main.py` | Added `theme` to config endpoints |
| `tests/backend/test_theme_config.py` | **New** — 6 backend theme tests |
| `src/electron/renderer/components/__tests__/ThemeProvider.test.tsx` | **New** — 14 frontend theme tests |
| `src/electron/renderer/components/__tests__/SettingsPage.test.tsx` | Updated to wrap with ThemeProvider |
| `src/electron/renderer/components/ui/__tests__/Card.test.tsx` | Updated assertions for CSS variable classes |

## Verification

- Light theme: `#f6f7f9` background, `#6366f1` primary ✅
- Dark theme: `#0f172a` background, `#818cf8` primary ✅  
- 300ms CSS variable transitions ✅
- Theme persistence via UserConfig backend table ✅
- `prefers-reduced-motion` support ✅
- All shadcn/ui components use CSS variables ✅
- Settings UI has Light/Dark/System toggle ✅
- All 265 frontend tests pass ✅
- All 6 backend tests pass ✅
