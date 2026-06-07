# Research Summary — v1.3 UI/UX Refinement

## Stack Additions

No new dependencies required. Current stack fully supports the design:

- **Tailwind CSS 3.4** — CSS variables for light/dark theme switching (300ms transitions on `html` element)
- **Framer Motion** — Already in stack; handles AnimatePresence page transitions, staggered entrances, and overlay orb animations
- **Lucide React** — Already used; provides icons for overlay states (check, x, circle)
- **shadcn/ui** — Already used; components support theming via CSS variables

## Architecture Integration Points

### Theme System
- Implement via Tailwind `dark` class on root element
- Persist preference to `UserConfig` table (backend)
- Load on app startup via `ipcRenderer.invoke('get-theme')`
- All components reference CSS variables (`--background`, `--foreground`, `--primary`, etc.)

### Layout Restructure
- Remove sidebar (`src/components/Sidebar.tsx` → archive)
- Add top tab bar (`src/components/TopBar.tsx`) — 32px height
- Add right info panel (`src/components/InfoPanel.tsx`) — 240px, collapsible
- Update `App.tsx` routing logic from sidebar-based to tab-based

### Overlay Refactor
- Replace bottom bar (`OverlayWindow` / `OverlayBar`) with floating orb
- Orb is a separate Electron `BrowserWindow` (frameless, always-on-top, click-through)
- Window size: 16px idle → 40px active; positioned bottom-right with 16px margin
- State machine: idle → recording → processing → completed/failed

### Animation Performance
- Framer Motion `layoutId` for smooth layout transitions
- `will-change: transform` on animated elements
- Reduced motion: `prefers-reduced-motion` media query support
- Low-performance detection: fallback to simpler animations

## Pitfalls to Avoid

1. **Z-Index / Window Management** — Orb window must not steal focus from main app or desktop. Use `focusable: false`, `skipTaskbar: true`.
2. **Theme Flash on Load** — Read theme preference BEFORE first render to avoid FOUC (flash of unstyled content).
3. **Animation Jank** — Overlay orb runs in separate window; IPC overhead for state updates must be minimal (batch state changes).
4. **Cross-Process State Sync** — Theme state lives in main process; renderer and overlay windows must subscribe to changes via IPC events.
5. **Accessibility** — All animations must respect `prefers-reduced-motion`. Overlay orb needs ARIA live region for screen readers.
6. **Testing Animations** — Framer Motion animations are hard to unit test; rely on visual regression (screenshot diff) and integration tests.

## Build Order Recommendation

1. Theme system (CSS variables + persistence) — foundational
2. Top tab bar + layout restructure — structural
3. Overlay orb (window + state machine) — complex, isolated
4. Page transitions + micro-interactions — polish
5. Dashboard polish + data animations — final pass
