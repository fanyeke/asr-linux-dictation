# UI-SPEC — Phase 15: Theme System

## Design Tokens

### Light Theme

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#f6f7f9` | App main background |
| `--card` | `#ffffff` | Card/surface backgrounds |
| `--card-foreground` | `#0f172a` | Card text |
| `--primary` | `#6366f1` | Buttons, active states, accents |
| `--primary-foreground` | `#ffffff` | Text on primary |
| `--secondary` | `#f1f5f9` | Secondary surfaces |
| `--muted` | `#f1f5f9` | Muted backgrounds |
| `--muted-foreground` | `#64748b` | Secondary text |
| `--border` | `#e2e8f0` | Borders, dividers |
| `--input` | `#e2e8f0` | Input borders |
| `--ring` | `#6366f1` | Focus rings |
| `--radius` | `0.5rem` | Border radius |

### Dark Theme

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0f172a` | App main background |
| `--card` | `#1e293b` | Card/surface backgrounds |
| `--card-foreground` | `#f8fafc` | Card text |
| `--primary` | `#818cf8` | Buttons, active states (brightened) |
| `--primary-foreground` | `#0f172a` | Text on primary |
| `--secondary` | `#1e293b` | Secondary surfaces |
| `--muted` | `#334155` | Muted backgrounds |
| `--muted-foreground` | `#94a3b8` | Secondary text |
| `--border` | `#334155` | Borders, dividers |
| `--input` | `#334155` | Input borders |
| `--ring` | `#818cf8` | Focus rings |

## Theme Switch Transition

- **Duration:** 300ms
- **Properties:** All CSS custom properties (`transition: background-color 300ms ease, color 300ms ease, border-color 300ms ease`)
- **Scale breathing:** On `html` element, `transform: scale(0.98)` → `scale(1)` over 300ms with `ease-out`
- **Reduced motion:** Instant switch (no transition)

## Component Mappings

### shadcn/ui Components
All existing shadcn components must work without modification by mapping to CSS variables:
- `Button` → `--primary`, `--primary-foreground`
- `Card` → `--card`, `--card-foreground`
- `Input` → `--input`, `--background`
- `Tabs` → `--muted`, `--primary` (active)
- `Toast` → `--card`, `--border`

### Custom Components
- **TopBar**: `--background` bg, `--border` bottom border, `--primary` active indicator
- **InfoPanel**: `--card` bg, `--border` left border
- **RecordButton**: `--primary` bg, `--primary-foreground` icon

## Accessibility

- `prefers-reduced-motion`: Disable all transitions (instant theme switch)
- Contrast ratios: Light theme ≥ 4.5:1, Dark theme ≥ 4.5:1
- Focus states: `--ring` with 2px offset

## Animation Specs

| Animation | Duration | Easing |
|-----------|----------|--------|
| Theme switch | 300ms | `ease` |
| Scale breathing | 300ms | `ease-out` |
| Card hover | 150ms | `ease-out` |
| Button press | 200ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

## Assets

No new image assets required. All theming via CSS variables.
