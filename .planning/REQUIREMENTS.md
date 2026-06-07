# Requirements — v1.3 UI/UX Refinement

## Priority Legend

- **[P0]** — Blocking / must have
- **[P1]** — Important
- **[P2]** — Nice to have

---

### THEME — Theme System

| ID | Priority | Requirement | TDD | Notes |
|----|----------|-------------|-----|-------|
| THEME-01 | P0 | Light theme: warm gray-white `#f6f7f9` background, white `#ffffff` cards, subtle shadows/borders for depth | ✅ | Replace current dark sidebar aesthetic |
| THEME-02 | P0 | Dark theme: deep blue-gray `#0f172a` background, `#1e293b` cards, brightened indigo `#818cf8` primary | ✅ | Complete re-mapping, not just inversion |
| THEME-03 | P0 | 300ms smooth CSS variable transition on theme switch with subtle `scale(0.98)→scale(1)` breathing animation | ✅ | All colors transition simultaneously |
| THEME-04 | P1 | Theme preference persisted to `UserConfig` backend table, loaded before first render to prevent FOUC | ✅ | IPC: `get-theme` on startup |
| THEME-05 | P1 | `prefers-reduced-motion` respected — instant switch, no animations | ✅ | Accessibility |
| THEME-06 | P2 | Low-performance mode: auto-detect and reduce animation complexity | — | Nice-to-have |

### LAYOUT — Layout Restructure

| ID | Priority | Requirement | TDD | Notes |
|----|----------|-------------|-----|-------|
| LAYOUT-01 | P0 | Remove 72px dark sidebar; replace with 32px top tab bar: Dashboard · 听写 · 历史 · 设置 | ✅ | "Tool" feel vs "management system" feel |
| LAYOUT-02 | P0 | Active tab: thin indigo underline + slightly bold text, 200ms cross-fade transition | ✅ | Framer Motion |
| LAYOUT-03 | P0 | Dual-pane layout: main content area + 240px right info panel (collapsible with smooth horizontal收缩 animation) | ✅ | Panel shows today's overview |
| LAYOUT-04 | P1 | Right panel content: session count, success rate, latency — always-visible monitoring | ✅ | Collapsible toggle |
| LAYOUT-05 | P1 | Update routing logic from sidebar-based to tab-based in `App.tsx` | ✅ | Structural change |

### OVERLAY — Floating Orb Overlay

| ID | Priority | Requirement | TDD | Notes |
|----|----------|-------------|-----|-------|
| OVERLAY-01 | P0 | Replace bottom bar with 16px floating orb, bottom-right position, 16px margin | ✅ | Frameless, always-on-top, click-through window |
| OVERLAY-02 | P0 | Idle → Recording (200ms): 16px → 40px, semi-transparent → full opacity, red pulse ring (1.5s period) | ✅ | Cubic easing |
| OVERLAY-03 | P0 | Recording → Processing (300ms): Red pulse → indigo rotating ring via HSL interpolation, 2s/rotation | ✅ | Color transition: red→purple→blue |
| OVERLAY-04 | P0 | Completed (2s): Rotating ring → green checkmark with soft flash, then fadeOut+scale(0.8) in 400ms back to idle | ✅ | `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoot |
| OVERLAY-05 | P0 | Failed: Red X appears quietly, stays until user clicks (opens main window to failed record) | ✅ | No auto-dismiss |
| OVERLAY-06 | P1 | State transitions ≤300ms, no perceptible delay to user | ✅ | Performance |
| OVERLAY-07 | P1 | Window management: `focusable: false`, `skipTaskbar: true`, does not steal focus | ✅ | Electron window opts |
| OVERLAY-08 | P2 | ARIA live region for screen readers announcing state changes | — | Accessibility |

### ANIMATION — Animation System

| ID | Priority | Requirement | TDD | Notes |
|----|----------|-------------|-----|-------|
| ANIM-01 | P0 | Page transitions (tab switch): Framer Motion AnimatePresence, 200ms opacity + 8px horizontal slide (book-flip feel) | ✅ | Enter: right→center; Exit: center→left |
| ANIM-02 | P0 | Staggered list entrance: 50ms interval per item, `translateY(12px)→0` + `opacity(0)→1`, 300ms easeOut | ✅ | Sequential waterfall effect |
| ANIM-03 | P1 | Toast notifications: slide in from bottom-right, `cubic-bezier(0.22, 1, 0.36, 1)`, 300ms; stack 8px apart | ✅ | Push old toasts up |
| ANIM-04 | P1 | Consistent easing: entry=`easeOut`, exit=`easeIn`, elastic=`cubic-bezier(0.34, 1.56, 0.64, 1)` | ✅ | Documented in code |
| ANIM-05 | P2 | Functional animations ≤300ms; decorative animations up to 600ms | — | Performance guideline |

### COMPONENTS — Refined Components

| ID | Priority | Requirement | TDD | Notes |
|----|----------|-------------|-----|-------|
| COMP-01 | P0 | Record button: 48px (down from 80px), hover 2px glow, click `scale(0.92)` compression + 200ms elastic rebound | ✅ | Less dominant visually |
| COMP-02 | P0 | Waveform bars: 14 thin bars, EMA smoothing (`smooth = old×0.7 + new×0.3`), idle at 4px baseline | ✅ | Soft, water-like movement |
| COMP-03 | P1 | Dictation page upper section: minimal status line — "就绪 · Alt+= 开始录音", transitions to "🎤 录音中 · 12s" with left border color change | ✅ | 200ms continuous border transition |
| COMP-04 | P1 | Recent sessions list (last 5): timestamp + 40-char preview + status icon; hover reveals retry/copy buttons | ✅ | Clean default, actions on hover |
| COMP-05 | P2 | All card components: consistent border-radius, shadow, and hover states across light/dark themes | — | Visual consistency |

### DASHBOARD — Dashboard Polish

| ID | Priority | Requirement | TDD | Notes |
|----|----------|-------------|-----|-------|
| DASH-01 | P1 | Animated number counters: 0→target in 600ms easeOut on data load | ✅ | Subtle but engaging |
| DASH-02 | P1 | Trend chart line animation: `strokeDasharray` + `strokeDashoffset`, left-to-right growth, 800ms | ✅ | Narrative chart appearance |
| DASH-03 | P1 | Empty state: floating placeholder icon + guiding text instead of blank area | ✅ | "Start your first dictation..." |
| DASH-04 | P2 | Four data cards with 80ms staggered entrance animation | — | Consistent with list animation |

---

## Future Requirements (Deferred)

- Custom theme editor (user-defined colors)
- Additional animation themes (e.g., "minimal" vs "playful")
- Orb position customization (drag to reposition)

## Out of Scope

- Backend API changes (this is a frontend-only milestone)
- New dictation pipeline features
- Multi-window support beyond main + overlay
- Mobile/responsive layout (desktop-only app)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| (To be filled after roadmap creation) | | |
