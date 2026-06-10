# Roadmap — v1.3 UI/UX Refinement

5 phases | requirements mapped

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 15 | Theme System | Warm light + deep dark themes with CSS variables and smooth transitions | THEME-01..06 | 6 ✅ |
| 16 | Layout Restructure | Top tab bar, dual-pane layout, sidebar removal | LAYOUT-01..05 | 5 |
| 17 | Overlay Orb | Floating orb overlay with 4-state animation cycle | OVERLAY-01..08 | 8 |
| 18 | Animation & Components | Page transitions, staggered lists, refined record button, waveform | ANIM-01..05, COMP-01..02 | 7 |
| 19 | Dashboard & Polish | Animated counters, chart drawing, empty states, dictation page polish | DASH-01..04, COMP-03..05 | 7 |

---

## Phase 15: Theme System — ✅ Done

**Goal:** Implement warm light theme and deep blue-gray dark theme with CSS variables, persistence, and smooth transitions.

**Requirements:** THEME-01, THEME-02, THEME-03, THEME-04, THEME-05, THEME-06

**Success criteria:**
1. Light theme renders with `#f6f7f9` background, white cards, subtle shadows — ✅
2. Dark theme renders with `#0f172a` background, `#1e293b` cards, `#818cf8` primary — complete remapping — ✅
3. Theme switch takes 300ms with all CSS variables transitioning simultaneously + subtle scale breathing — ✅
4. Theme preference persists across app restarts via `UserConfig` backend table — ✅
5. `prefers-reduced-motion` disables all transition animations (instant switch) — ✅
6. All existing shadcn/ui components respect new theme variables without modification — ✅

**Logging instrumentation:**
- `theme_switch`: log old→new theme, transition duration, source (settings/system/default) — ✅
- `theme_load`: log loaded theme on startup, source (persisted/system-default) — ✅

**TDD plan:**
1. `test_light_theme_renders` — ✅
2. `test_dark_theme_renders` — ✅
3. `test_theme_persistence` — ✅
4. `test_prefers_reduced_motion` — ✅
5. `test_theme_load_on_startup` — ✅

---

## Phase 16: Layout Restructure

**Goal:** Replace sidebar with top tab bar, implement dual-pane layout with collapsible right info panel.

**Requirements:** LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05

**Success criteria:**
1. Sidebar component removed; no 72px dark sidebar visible anywhere
2. Top tab bar (32px) shows Dashboard · 听写 · 历史 · 设置 with active state (indigo underline + bold)
3. Tab switching has 200ms cross-fade transition
4. Main content area + 240px right panel visible by default; panel shows session count, success rate, latency
5. Right panel collapsible with smooth horizontal收缩 animation; toggle button in top-right
6. Routing updated from sidebar-based to tab-based; all existing routes work

**Logging instrumentation:**
- `tab_switch`: log from→to tab, transition duration
- `panel_toggle`: log expand/collapse action

**TDD plan:**
1. `test_top_bar_renders_tabs` — verify 4 tabs render with correct labels
2. `test_tab_switch_triggers_route_change` — verify navigation works
3. `test_right_panel_shows_metrics` — verify panel displays data
4. `test_panel_collapsible` — verify toggle button works, animation completes
5. `test_sidebar_absent` — verify old sidebar component not in DOM

---

## Phase 17: Overlay Orb

**Goal:** Replace bottom bar overlay with floating orb, implement complete 4-state animation cycle.

**Requirements:** OVERLAY-01, OVERLAY-02, OVERLAY-03, OVERLAY-04, OVERLAY-05, OVERLAY-06, OVERLAY-07, OVERLAY-08

**Success criteria:**
1. 16px orb visible bottom-right, does not interfere with desktop interaction (click-through)
2. Idle→Recording: 200ms expansion to 40px, red pulse ring (1.5s period) begins
3. Recording→Processing: 300ms transition, red→indigo via HSL, rotating ring (2s/rotation)
4. Completed: green checkmark + soft flash, 2s display, then 400ms fade+shrink back to idle
5. Failed: red X appears, stays until clicked; click opens main window to failed record
6. All state transitions complete within 300ms; no jank or dropped frames
7. Window options: `focusable: false`, `skipTaskbar: true`, no focus theft
8. State changes announced to screen readers via ARIA live region

**Logging instrumentation:**
- `overlay_state_change`: log old→new state, transition duration
- `overlay_orb_click`: log click action (open main window, retry, etc.)

**TDD plan:**
1. `test_orb_window_created` — verify Electron window with correct options
2. `test_idle_to_recording_animation` — verify size, opacity, pulse ring
3. `test_recording_to_processing_transition` — verify color interpolation, rotation
4. `test_completed_sequence` — verify checkmark, flash, dismiss timing
5. `test_failed_state_persistent` — verify red X stays, click opens main window
6. `test_focus_not_stolen` — verify other windows retain focus during orb transitions

---

## Phase 18: Animation & Components

**Goal:** Implement page transitions, staggered list animations, refined record button, and waveform visualization.

**Requirements:** ANIM-01, ANIM-02, ANIM-03, ANIM-04, ANIM-05, COMP-01, COMP-02

**Success criteria:**
1. Tab switch: 200ms opacity + 8px horizontal slide (book-flip); exit left, enter from right
2. List items: 50ms stagger, `translateY(12px)→0` + `opacity(0)→1`, 300ms easeOut
3. Toast: slide from bottom-right, `cubic-bezier(0.22, 1, 0.36, 1)`, 300ms; stack 8px apart
4. Record button: 48px, hover 2px glow, click `scale(0.92)` + elastic rebound
5. Waveform: 14 bars, EMA smoothing, idle at 4px baseline, active during recording
6. All animations use consistent easing functions; documented in code

**Logging instrumentation:**
- `page_transition`: log tab, duration, easing used
- `list_render`: log item count, stagger interval

**TDD plan:**
1. `test_page_transition_animation` — verify AnimatePresence with correct variants
2. `test_staggered_list_entrance` — verify interval and motion values
3. `test_toast_stack_behavior` — verify stacking and push animation
4. `test_record_button_interactions` — verify hover, active, recording states
5. `test_waveform_ema_smoothing` — verify smoothing formula output

---

## Phase 19: Dashboard & Polish

**Goal:** Polish Dashboard with animated counters and chart drawing, refine dictation page, and finalize empty states.

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, COMP-03, COMP-04, COMP-05

**Success criteria:**
1. Dashboard numbers animate from 0→target in 600ms easeOut on data load
2. Trend chart lines draw from left to right via `strokeDashoffset` animation, 800ms
3. Empty state shows floating icon + "Start your first dictation..." guidance
4. Dictation page upper: status line with left border color transition (200ms)
5. Recent 5 sessions: timestamp + 40-char preview + status icon; hover reveals actions
6. All cards consistent: border-radius, shadow, hover states across themes

**Logging instrumentation:**
- `dashboard_number_animation`: log target values, duration
- `chart_draw_animation`: log chart type, duration

**TDD plan:**
1. `test_number_counter_animation` — verify increment timing and final value
2. `test_chart_line_draw` — verify strokeDashoffset animation
3. `test_empty_state_renders` — verify placeholder and guidance text
4. `test_dictation_status_transition` — verify border color change on state change
5. `test_recent_sessions_list` — verify 5-item limit, hover actions
