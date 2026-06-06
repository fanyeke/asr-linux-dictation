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

## Current Milestone: v1.0 Experience Enhancements

**Goal:** Transform the MVP dictation app into a reliable daily-driver with onboarding, language selection, VAD, scene profiles, history tools, dictionary insights, and polished overlay feedback.

**Target features:**
- Onboarding Wizard (first-run setup guide, 4 steps)
- ASR Language Selection (settings dropdown + tray quick-switch)
- VAD Silence Detection (configurable auto-stop + overlay countdown)
- Scene Profiles (3–5 presets with CRUD and quick-switch)
- History Record Enhancement (copy, export txt/md)
- Dictionary Matching Frequency (per-entry stats badges)
- Overlay Level Refresh & Progress Bar (WS push + continuous progress)

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
