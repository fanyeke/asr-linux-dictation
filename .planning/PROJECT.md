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

## State

- Phase 5 plan exists but not yet completed
- Codebase map generated in `.planning/codebase/`
- Current focus: bug fix sprint (right sidebar, overlay transition, rounded corner bleed, dictionary replacement)
