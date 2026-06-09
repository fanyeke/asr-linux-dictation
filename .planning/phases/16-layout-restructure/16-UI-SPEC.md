# UI-SPEC — Phase 16: Layout Restructure

## Layout System

### Top Tab Bar

- **Height:** 32px
- **Background:** `--background` (theme-aware)
- **Bottom border:** 1px `--border`
- **Tabs:** Dashboard · 听写 · 历史 · 设置
- **Active state:** thin indigo underline (2px `--primary`) + font-weight 600
- **Inactive state:** font-weight 400, `--muted-foreground`
- **Tab switching:** 200ms cross-fade transition

### Dual-Pane Layout

```
┌─────────────────────────────────────────────────────┬──────────────┐
│  Top Tab Bar (32px)                                 │              │
├─────────────────────────────────────────────────────┤  Info Panel  │
│                                                     │  (240px)     │
│  Main Content Area                                  │  collapsible │
│  (flex: 1)                                          │              │
│                                                     │  Today's     │
│                                                     │  overview:   │
│                                                     │  - Sessions  │
│                                                     │  - Success   │
│                                                     │  - Latency   │
│                                                     │              │
└─────────────────────────────────────────────────────┴──────────────┘
```

- **Main content:** flex: 1, min-width: 0 (prevents overflow)
- **Right panel:** width: 240px, collapsible
- **Panel toggle:** button in top-right, smooth horizontal收缩 animation (200ms ease-out)
- **Collapsed state:** panel hidden, main content expands to full width

### Responsive Behavior

- **Minimum width:** 800px (below this, panel auto-collapses)
- **Mobile (< 768px):** single column, panel becomes bottom sheet or modal

## Component Specs

### TopBar Component

```typescript
interface TopBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: Array<{ id: string; label: string }>;
}
```

- Fixed at top (position: sticky, top: 0, z-index: 50)
- Tab items spaced evenly or left-aligned with 24px gap
- Active indicator: absolutely positioned bottom border, animated via CSS transition

### InfoPanel Component

```typescript
interface InfoPanelProps {
  collapsed: boolean;
  onToggle: () => void;
  metrics: {
    sessions: number;
    successRate: number;
    latency: number;
  };
}
```

- Collapse button: 24px × 24px, `--muted` background, rounded
- Panel content padding: 16px
- Metric cards: stacked vertically, 12px gap
- Each metric: label (small, `--muted-foreground`) + value (large, `--foreground`)

### Page Container

- Padding: 24px
- Max-width: none (fills available space)
- Scrollable independently of panel

## Animation Specs

| Animation | Duration | Easing | Details |
|-----------|----------|--------|---------|
| Tab switch (content) | 200ms | ease-out | opacity 0→1 + translateX(8px→0) |
| Panel collapse | 200ms | ease-out | width 240px→0, opacity 1→0 |
| Panel expand | 200ms | ease-out | width 0→240px, opacity 0→1 |
| Content reflow | 200ms | ease-out | flex-grow transition |

## Accessibility

- Tab bar: `role="tablist"`, each tab `role="tab"`
- Panel toggle: `aria-expanded`, `aria-controls`
- Keyboard: Tab navigation through tabs, Enter/Space to activate
- Focus visible: `--ring` outline on all interactive elements

## Theme Compatibility

- All backgrounds use `--background`, `--card`
- All text uses `--foreground`, `--muted-foreground`
- Borders use `--border`
- Active states use `--primary`
- Must work correctly in both light and dark themes (verified in Phase 15)
