---
wave: 1
depends_on: []
files_modified:
  - src/renderer/styles/globals.css
  - src/renderer/components/ThemeProvider.tsx
  - src/renderer/hooks/useTheme.ts
  - src/electron/main/theme-manager.ts
  - src/electron/preload/api.ts
  - src/backend/models/user_config.py
  - src/backend/api/config.py
  - tests/renderer/theme.test.tsx
  - tests/backend/test_theme_config.py
autonomous: true
---

# Plan: Phase 15 — Theme System

## Goal

Implement warm light theme and deep blue-gray dark theme with CSS variables, persistence, and smooth transitions.

## must_haves

1. Light theme renders with `#f6f7f9` background, white cards, subtle shadows
2. Dark theme renders with `#0f172a` background, `#1e293b` cards, `#818cf8` primary
3. Theme switch takes 300ms with all CSS variables transitioning simultaneously
4. Theme preference persists across app restarts via `UserConfig` backend table
5. `prefers-reduced-motion` disables all transition animations
6. All existing shadcn/ui components respect new theme variables without modification

## Artifacts this phase produces

- `ThemeProvider` React context provider (src/renderer/components/ThemeProvider.tsx)
- `useTheme` React hook (src/renderer/hooks/useTheme.ts)
- `theme-manager.ts` Electron main process theme manager (src/electron/main/theme-manager.ts)
- CSS custom properties in globals.css (light + dark variants)
- `theme` column in `UserConfig` backend model
- `GET /api/config/theme` and `POST /api/config/theme` backend endpoints
- IPC channels: `theme:get`, `theme:set`, `theme:changed`

---

## Task 1: Define CSS Custom Properties

### <read_first>
- src/renderer/styles/globals.css (current global styles)
- tailwind.config.js or tailwind.config.ts (Tailwind configuration)
- src/renderer/components/ui/ (shadcn/ui components to understand variable usage)
</read_first>

### <action>
Add CSS custom properties to `src/renderer/styles/globals.css` for both light and dark themes.

Light theme variables:
- `--background: #f6f7f9`
- `--foreground: #0f172a`
- `--card: #ffffff`
- `--card-foreground: #0f172a`
- `--primary: #6366f1`
- `--primary-foreground: #ffffff`
- `--secondary: #f1f5f9`
- `--secondary-foreground: #0f172a`
- `--muted: #f1f5f9`
- `--muted-foreground: #64748b`
- `--border: #e2e8f0`
- `--input: #e2e8f0`
- `--ring: #6366f1`
- `--radius: 0.5rem`

Dark theme variables (inside `.dark` or `[data-theme="dark"]`):
- `--background: #0f172a`
- `--foreground: #f8fafc`
- `--card: #1e293b`
- `--card-foreground: #f8fafc`
- `--primary: #818cf8`
- `--primary-foreground: #0f172a`
- `--secondary: #1e293b`
- `--secondary-foreground: #f8fafc`
- `--muted: #334155`
- `--muted-foreground: #94a3b8`
- `--border: #334155`
- `--input: #334155`
- `--ring: #818cf8`

Add `transition: background-color 300ms ease, color 300ms ease, border-color 300ms ease` to `html` element.
Add `transition: transform 300ms ease-out` for scale breathing on theme switch.
</action>

### <acceptance_criteria>
- `globals.css` contains both light and dark CSS custom property definitions
- Light theme `--background` is `#f6f7f9`, dark theme `--background` is `#0f172a`
- Light theme `--primary` is `#6366f1`, dark theme `--primary` is `#818cf8`
- `html` element has transition properties for background-color, color, border-color
- Running the app shows light theme by default (before any theme switching)
</acceptance_criteria>

---

## Task 2: Create ThemeProvider React Context

### <read_first>
- src/renderer/App.tsx (to understand provider hierarchy)
- src/renderer/components/ (existing provider patterns)
</read_first>

### <action>
Create `src/renderer/components/ThemeProvider.tsx` with:
- `Theme` type: `'light' | 'dark' | 'system'`
- `ThemeProviderProps` interface with `children`, `defaultTheme`, `storageKey`
- `ThemeProviderState` interface with `theme`, `setTheme`
- `ThemeProviderContext` using `React.createContext`
- `ThemeProvider` component that:
  - Reads initial theme from `localStorage` (fallback to `defaultTheme` or `'light'`)
  - Applies theme class to `document.documentElement` (`light`, `dark`, or resolves `system` via `matchMedia('(prefers-color-scheme: dark)')`)
  - Watches for system theme changes when `theme === 'system'`
  - Provides `theme` and `setTheme` via context
- `useTheme` hook that consumes the context

Export both `ThemeProvider` and `useTheme`.
</action>

### <acceptance_criteria>
- `ThemeProvider.tsx` exports `ThemeProvider` component and `useTheme` hook
- `useTheme()` returns `{ theme, setTheme }` with correct types
- Wrapping app in `<ThemeProvider>` prevents FOUC (theme applied before first paint)
- `setTheme('dark')` adds `.dark` class to `html` element
- `setTheme('light')` removes `.dark` class
- `setTheme('system')` follows OS preference
- Theme choice persists in `localStorage` under key `asr-linux-theme`
</acceptance_criteria>

---

## Task 3: Add Backend Theme Persistence

### <read_first>
- src/backend/models/user_config.py (UserConfig model)
- src/backend/api/config.py (config API endpoints)
- src/backend/db/schema.py (database schema if exists)
</read_first>

### <action>
1. Add `theme: str = 'light'` field to `UserConfig` model in `src/backend/models/user_config.py`
2. Create Alembic migration or update schema to add `theme` column to `user_config` table
3. Add `GET /api/config/theme` endpoint that returns `{ theme: string }`
4. Add `POST /api/config/theme` endpoint that accepts `{ theme: string }` and persists to DB
5. Validate theme value is one of `['light', 'dark', 'system']`
</action>

### <acceptance_criteria>
- `UserConfig` model has `theme` field with default `'light'`
- Database schema includes `theme` column in `user_config` table
- `GET /api/config/theme` returns JSON `{ "theme": "light" }` (or persisted value)
- `POST /api/config/theme` with body `{ "theme": "dark" }` returns 200 and persists value
- Invalid theme value (e.g., `"red"`) returns 400 Bad Request
</acceptance_criteria>

---

## Task 4: Connect Frontend to Backend Theme Persistence

### <read_first>
- src/electron/preload/api.ts (IPC API definitions)
- src/electron/main/index.ts (main process IPC handlers)
- src/renderer/hooks/useTheme.ts (after Task 2)
</read_first>

### <action>
1. Add IPC channel definitions:
   - `theme:get` — renderer requests current theme from backend
   - `theme:set` — renderer sends theme change to backend
   - `theme:changed` — main broadcasts theme change to all renderer windows

2. In `src/electron/main/theme-manager.ts`:
   - On app startup, fetch theme from backend via HTTP
   - Store in main process state
   - Handle `theme:get` IPC — return cached theme
   - Handle `theme:set` IPC — save to backend via HTTP, broadcast `theme:changed`

3. In `src/renderer/components/ThemeProvider.tsx`:
   - On mount, call `window.api.theme.get()` to fetch persisted theme
   - On `theme:changed` event, update context state
   - On `setTheme`, call `window.api.theme.set(newTheme)`

4. Update `src/electron/preload/api.ts` to expose `theme.get()` and `theme.set()`
</action>

### <acceptance_criteria>
- `window.api.theme.get()` returns Promise<string> with persisted theme
- `window.api.theme.set('dark')` sends IPC to main, persists to backend
- Theme change in one window broadcasts to all renderer windows
- App startup loads theme from backend before first paint (no FOUC)
- Network failure during theme load falls back to `localStorage` or `'light'`
</acceptance_criteria>

---

## Task 5: Implement Reduced Motion Support

### <read_first>
- src/renderer/styles/globals.css (after Task 1)
- src/renderer/components/ThemeProvider.tsx (after Task 2)
</read_first>

### <action>
1. In `globals.css`, add `@media (prefers-reduced-motion: reduce)` block that:
   - Sets `transition: none !important` on `html` and all elements
   - Disables scale breathing animation

2. In `ThemeProvider`, add `reducedMotion` state:
   - Detect via `matchMedia('(prefers-reduced-motion: reduce)')`
   - Watch for changes
   - Apply `data-reduced-motion` attribute to `html` when active

3. Ensure Framer Motion animations also respect reduced motion (use `useReducedMotion` hook where applicable)
</action>

### <acceptance_criteria>
- When OS reduced motion is enabled, theme switch is instant (no 300ms transition)
- `document.documentElement` has `data-reduced-motion="true"` when enabled
- Framer Motion animations are disabled when reduced motion is active
- Changing OS reduced motion setting updates app in real-time
</acceptance_criteria>

---

## Task 6: Verify shadcn/ui Component Compatibility

### <read_first>
- src/renderer/components/ui/ (all shadcn components)
- src/renderer/styles/globals.css (after Task 1)
</read_first>

### <action>
1. Audit all shadcn/ui components to ensure they reference CSS variables (not hardcoded colors):
   - `Button` should use `--primary`, `--primary-foreground`
   - `Card` should use `--card`, `--card-foreground`
   - `Input` should use `--input`, `--background`
   - `Tabs` should use `--muted`, `--primary`
   - `Toast` should use `--card`, `--border`

2. Update any components with hardcoded colors to use CSS variables
3. Add visual regression test or manual checklist:
   - Light theme: all components render correctly
   - Dark theme: all components render correctly
   - No hardcoded `bg-white`, `bg-gray-900`, etc. in component files
</action>

### <acceptance_criteria>
- Zero hardcoded color values in shadcn/ui component files (all use `hsl(var(--...))` or Tailwind variable classes)
- `Button` renders with `--primary` background in both themes
- `Card` renders with `--card` background in both themes
- `Input` renders with `--input` border in both themes
- Manual/visual test: open Settings page in both themes, verify no visual regressions
</acceptance_criteria>

---

## Task 7: Add Settings UI for Theme Toggle

### <read_first>
- src/renderer/pages/SettingsPage.tsx (or current settings page)
- src/renderer/components/ui/ (available UI components)
</read_first>

### <action>
1. In Settings page, add a "Appearance" or "Theme" section
2. Add theme toggle control:
   - Three options: Light / Dark / System
   - Use radio buttons or segmented control
   - Show current selection
3. On change, call `setTheme()` from `useTheme()`
4. Display preview of current theme (small card showing background + primary color)
</action>

### <acceptance_criteria>
- Settings page has visible theme selection control with Light/Dark/System options
- Selecting a theme immediately applies it
- Selected theme persists after app restart
- Theme selection UI is accessible (keyboard navigable, screen reader friendly)
</acceptance_criteria>

---

## Task 8: Write Tests

### <read_first>
- tests/ directory structure (existing test patterns)
- src/renderer/components/ThemeProvider.tsx
- src/backend/models/user_config.py
</read_first>

### <action>
1. Frontend tests (`tests/renderer/theme.test.tsx`):
   - `test_light_theme_renders` — mount ThemeProvider, verify CSS variables match spec
   - `test_dark_theme_renders` — set theme to dark, verify dark CSS variables
   - `test_prefers_reduced_motion` — mock media query, verify instant switch
   - `test_theme_load_on_startup` — verify correct theme applied on initial render

2. Backend tests (`tests/backend/test_theme_config.py`):
   - `test_get_theme_default` — GET /api/config/theme returns `'light'`
   - `test_set_theme_persists` — POST theme, GET returns same value
   - `test_set_invalid_theme_returns_400` — POST invalid theme returns 400

3. Integration test:
   - `test_theme_persistence_roundtrip` — set theme via UI, restart app, verify persisted
</action>

### <acceptance_criteria>
- `npm test` or `pytest` passes all theme-related tests
- Frontend tests cover light theme, dark theme, reduced motion, and startup load
- Backend tests cover default value, persistence, and validation
- Test coverage for theme-related code ≥ 80%
</acceptance_criteria>

---

## Verification Criteria

- [ ] App launches with correct theme (light default, or persisted preference)
- [ ] Theme switch in Settings applies immediately with 300ms transition
- [ ] Dark theme colors match spec (`#0f172a` bg, `#818cf8` primary)
- [ ] Light theme colors match spec (`#f6f7f9` bg, `#6366f1` primary)
- [ ] Theme persists across app restarts
- [ ] `prefers-reduced-motion` disables all transitions
- [ ] All shadcn/ui components render correctly in both themes
- [ ] All tests pass
- [ ] No visual regressions in existing pages
