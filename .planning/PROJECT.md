# ASR Linux

Linux desktop voice input application.

## What

Hotkey-triggered voice dictation that records audio, sends it to cloud ASR, polishes the transcript via LLM, and inserts the result into the currently focused window.

## Stack

- **Frontend:** Electron 30 + React 18 + TypeScript 5.4 + Tailwind CSS 3.4
- **Backend:** Python 3.11 + FastAPI + Uvicorn
- **Persistence:** SQLite (prompts, dictionary, history, config)
- **Communication:** HTTP localhost (actions) + WebSocket (status/mic levels)
- **Build:** Vite (renderer), npm (frontend), uv (Python)

## Model Preference

- **Default LLM:** opencode-go/deepseek-v4-flash (fast, cheap)
- **Fallback:** gpt-4o-mini

## GSD Config

- **Phase naming:** `phase-N`
- **Commit prefix:** `phase-N:`
- **Branch naming:** `phase-N-short-description`

## Current Milestone: v1.3 UI/UX Refinement

**Goal:** Redesign the visual language and interaction patterns — minimalist warm palette, top-tab layout, floating orb overlay, refined animations, and dark mode.

**Target features:**
- Warm-toned light theme + deep blue-gray dark theme with smooth 300ms transitions
- Top tab bar (32px) replacing sidebar, freeing 72px of horizontal space
- Dual-pane layout: main content + collapsible 240px right info panel
- Floating orb overlay (16px idle → animated states) with complete 4-state animation cycle
- 48px refined record button with hover glow, press compression, and subtle pulse
- Framer Motion page transitions (book-flip feel) and staggered list entrances
- Dictation page: split upper/lower layout (current status + recent 5 sessions)
- Dashboard: animated number counters, stroke-drawn charts, floating empty-state
- Systematic animation principles: ≤300ms functional, consistent easing, graceful degradation

## Previous Milestones

### v1.2 Speed & Reliability ✅
- Clipboard Save/Restore with fallback
- Connection Warmup (fire-and-forget probe)
- Streaming ASR Core (RingBuffer, TranscriptMerger)
- Streaming ASR Pipeline Integration

### v1.1 History & Dashboard Redesign ✅
- History Redesign (search, preview, diff view, copy, failed highlight)
- Dashboard + Stats (timing breakdown, stats API, trend charts, heatmap)

### v1.0 Experience Enhancements ✅
- Onboarding Wizard (first-run setup guide, 4 steps)
- ASR Language Selection (settings dropdown + tray quick-switch)
- VAD Silence Detection (configurable auto-stop + overlay countdown)
- Scene Profiles (5 presets with CRUD and quick-switch)
- History Record Enhancement (copy, export txt/md, diff view)
- Dictionary Matching Frequency (per-entry stats badges)
- Overlay Progress Bar (continuous 0→100% animation)
- Dashboard + Stats (latency charts, stats API)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
