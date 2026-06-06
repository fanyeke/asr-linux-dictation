# Phase 8: Overlay Polish + Onboarding Wizard — PLAN.md

## Goal

Fix the overlay progress bar to be truly continuous (simulated 0→100%), fix phase broadcast timing so users see distinct transcribing/polishing stages, and build the first-run onboarding wizard.

## Requirements

ONB-01, ONB-02, ONB-03, ONB-04, ONB-05, ONB-06, ONB-07, ONB-08
+ Phase 7 regression fixes (progress bar continuity, broadcast timing)

## Exit Criteria

- [ ] Overlay progress bar smoothly animates from 0→100% across the pipeline (not segmented)
- [ ] Progress is SIMULATED — each phase has a target range with smooth advancement
- [ ] Recording phase: 0-35% with mic level wave on top
- [ ] Transcribing: broadcast BEFORE ASR call + smooth advance 35-65%
- [ ] Polishing: broadcast BEFORE LLM call + smooth advance 65-90%
- [ ] Completed: 100% green, 2s, fade out
- [ ] Failed: stops at current position, turns red
- [ ] 4-step modal wizard works (step navigation, dep check, API test, trial)
- [ ] `onboarding_completed` persisted; Settings has "重新引导" link
- [ ] All new code has TDD tests and structured timing logs
- [ ] Frontend: no white-screen regression

## Workstreams

### Wave 1: Overlay Fix — Broadcast Timing

| # | Task | TDD | Files |
|---|------|-----|-------|
| 1.1 | `DictationOrchestrator.process()`: move `_broadcast("transcribing")` BEFORE `asr_client.transcribe()` | ✅ | `src/backend/dictation_orchestrator.py` |
| 1.2 | `DictationOrchestrator.process()`: move `_broadcast("polishing")` BEFORE `polish_client.polish()` | ✅ | `src/backend/dictation_orchestrator.py` |
| 1.3 | `DictationOrchestrator.retry_from_text()`: same fix (polishing broadcast before polish call) | ✅ | `src/backend/dictation_orchestrator.py` |
| 1.4 | Test: verify broadcast order in process pipeline | ✅ | `tests/backend/test_dictation_orchestrator.py` |

**Logging:** `phase_broadcast: {session_id, phase, before_ms}`

### Wave 2: Overlay Fix — True Continuous Progress Bar

| # | Task | TDD | Files |
|---|------|-----|-------|
| 2.1 | Redesign ProgressBar: replace fixed-width per-phase with simulated continuous animation | ✅ | `src/electron/renderer/overlay/ProgressBar.tsx` |
| 2.2 | Phase ranges: recording=0-35%, transcribing=35-65%, polishing=65-90%, completed=100% | ✅ | `src/electron/renderer/overlay/ProgressBar.tsx` |
| 2.3 | Smooth animation: use Framer Motion `animate` for width transitions | ✅ | `src/electron/renderer/overlay/ProgressBar.tsx` |
| 2.4 | Mic level overlays the recording progress (wave on top of smooth bar) | ✅ | `src/electron/renderer/overlay/ProgressBar.tsx` |
| 2.5 | Failed: freeze current position + flash red | ✅ | `src/electron/renderer/overlay/ProgressBar.tsx` |
| 2.6 | Test: progress animates smoothly through each phase range | ✅ | `tests/electron/renderer/overlay/overlay-window.test.tsx` |

### Wave 3: Onboarding Wizard — Backend

| # | Task | TDD | Files |
|---|------|-----|-------|
| 3.1 | UserConfig + DB: `onboarding_completed` field | ✅ | `src/backend/config_store.py`, `database.py` |
| 3.2 | API: `GET /system/deps` → detect arecord/xdotool/xsel/xclip/xprop | ✅ | `src/backend/main.py` (new route) |
| 3.3 | API: `POST /asr/probe` → test ASR with probe audio | ✅ | `src/backend/main.py` (extends `/test-asr-key`) |
| 3.4 | Test: system deps detection | ✅ | `tests/backend/test_system_deps.py` |
| 3.5 | Test: onboarding_completed persistence | ✅ | `tests/backend/test_config_store.py` |

**Logging:** `onboarding: {step, action, duration_ms}`

### Wave 4: Onboarding Wizard — Frontend

| # | Task | TDD | Files |
|---|------|-----|-------|
| 4.1 | 4-step modal wizard component (`OnboardingWizard.tsx`) | ✅ | `src/electron/renderer/components/OnboardingWizard.tsx` (new) |
| 4.2 | Step 1: DepCheckStep — system deps with green/red badges + fix instructions | ✅ | `src/electron/renderer/components/OnboardingWizard.tsx` |
| 4.3 | Step 2: ASRConfigStep — URL + key input + test-connection button + probe audio | ✅ | `src/electron/renderer/components/OnboardingWizard.tsx` |
| 4.4 | Step 3: LLMConfigStep — URL + key + model + test button | ✅ | `src/electron/renderer/components/OnboardingWizard.tsx` |
| 4.5 | Step 4: TrialStep — hotkey record, full pipeline, show result inline | ✅ | `src/electron/renderer/components/OnboardingWizard.tsx` |
| 4.6 | Prev/next/skip navigation; Framer Motion step transitions | ✅ | `src/electron/renderer/components/OnboardingWizard.tsx` |
| 4.7 | Settings page: "重新引导" link when onboarding already completed | ✅ | `src/electron/renderer/components/SettingsPage.tsx` |
| 4.8 | App entry: show wizard on first launch when `onboarding_completed=false` | ✅ | `src/electron/renderer/app.tsx` |
| 4.9 | i18n: all wizard strings (zh/en) | — | `src/electron/renderer/lib/i18n.ts` |
| 4.10 | Tests: wizard renders, navigation works, trial step | ✅ | `src/electron/renderer/components/__tests__/` |

## TDD Loop

1. Write failing test → RED
2. Implement → GREEN
3. Refactor → stay GREEN
4. Commit `phase-8: <feature>`

## Test Commands

```bash
# Backend
uv run pytest tests/backend -q

# Frontend
npm run test

# TypeScript
npx tsc --noEmit

# Build
npm run build
```

## Subagent Dispatch Plan

- **Subagent A** → Wave 1 (broadcast timing fix)
- **Orchestrator** → Wave 2 (progress bar animation)
- **Subagent B** → Wave 3 (onboarding backend)
- **Orchestrator** → Wave 4 (onboarding frontend)

## must_haves

- Phase broadcasts happen BEFORE work (not after)
- Progress bar smoothly animates 0→100% (not segmented)
- Onboarding wizard can complete full setup flow
- No frontend white-screen regression
