# Phase 8: Overlay Polish + Onboarding Wizard — Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

## Phase Boundary

Phase 8 delivers two user-facing improvements:
1. **Overlay polish** — fix two regression-level issues from Phase 7
2. **Onboarding Wizard** — first-run setup guide (ONB-01..08)

## Overlay Issues to Fix (from user feedback)

### Issue A: Progress bar not truly continuous
**Current behavior:** The Phase 7 progress bar is still segmented — each phase has a fixed width percentage (recording=40%, transcribing=55%, polishing=80%, completed=100%). When transitioning between phases, the bar jumps instead of smoothly animating.

**Desired behavior:** True simulated continuous progress bar. Each phase advances smoothly within its range:
- Recording: 0–35% (mic level wave overlay on top of smooth progress)
- Transcribing: 35–65% (smooth advance + pulse, higher speed at start)
- Polishing: 65–90% (smooth advance + pulse)
- Completed: 100% (green, 2s hold, fade out)
- Failed: stop at current position, flash red

The progress is SIMULATED — it doesn't reflect real API progress. The psychological effect is what matters: giving the user a sense that "something is happening".

### Issue B: Phase broadcast timing inverted
**Root cause:** In `dictation_orchestrator.py`, status broadcasts happen AFTER the work completes:

```python
# Current (wrong):
raw_text = await asr_client.transcribe(...)
await _broadcast("transcribing", ...)  # AFTER ASR done

polished = await polish_client.polish(...)
await _broadcast("polishing", ...)  # AFTER polish done
```

**Fix:** Broadcast BEFORE the work:

```python
# Fixed:
await _broadcast("transcribing", ...)
raw_text = await asr_client.transcribe(...)

await _broadcast("polishing", ...)
polished = await polish_client.polish(...)
```

This way the overlay shows "识别中" while ASR is running, and "润色中" while LLM is running.

## Onboarding Wizard (ONB-01..08)

First-run modal wizard with 4 steps:
1. System dependency check (arecord, xdotool, xsel/xclip, xprop)
2. ASR configuration (URL + key + test)
3. LLM configuration (URL + key + model + test)
4. Trial recording (full pipeline demo)

## Implementation Decisions

### Overlay
- `ProgressBar.tsx`: replace fixed-width per-phase with continuous animation using `requestAnimationFrame` or Framer Motion
- Phase timer starts when broadcast happens (not when work completes)
- `DictationOrchestrator.process()`: swap broadcast/work order for transcribing and polishing

### Wizard
- Modal overlay in Settings window (not separate BrowserWindow)
- 4 steps with prev/next/skip navigation
- Framer Motion for step transitions
- `onboarding_completed` flag in user_config

## Deferred Ideas

- Scene Profiles → Phase 9
- History search/filter → Phase 9+

---

*Phase: 08-overlay-onboarding*
*Context gathered: 2026-06-06*
