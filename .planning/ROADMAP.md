# Roadmap — v1.0 Experience Enhancements

4 phases | 33 requirements mapped | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 6 | Core Config & UX | ASR language selection, VAD auto-stop with settings UI, level polling optimization | ASR-01..05, VAD-01..07, OVL-01..02 | 15 |
| 7 | History & Overlay | Copy/export history, dictionary match stats, continuous progress bar | HST-01..06, DIC-01..04, OVL-03..06 | 13 |
| 8 | Overlay Polish + Onboarding | True 0→100% progress bar, fix broadcast timing, 4-step onboarding wizard | ONB-01..08, overlay fixes | 10 |
| 9 | Scene Profiles | Profile DB/CRUD, 5 presets, settings UI, pipeline integration, quick-switch | PRO-01..07 | 7 |

---

## Phase 6: Core Config & UX

**Goal:** Low-hanging UX improvements — ASR language dropdown, VAD user controls, level polling optimization.

**Requirements:** ASR-01, ASR-02, ASR-03, ASR-04, ASR-05, VAD-01, VAD-02, VAD-03, VAD-04, VAD-05, VAD-06, VAD-07, OVL-01, OVL-02

**Success criteria:**
1. User can select zh/en/auto ASR language from Settings dropdown — persisted across restarts
2. Tray menu shows current language with quick-switch submenu
3. User can enable/disable VAD and adjust threshold/duration from Settings
4. VAD toggle respected by AudioRecorder — existing silence detection works
5. VAD countdown shown in overlay during active silence detection
6. Level polling rate benchmarked and optimized (target 60–80ms)
7. WebSocket push evaluated for mic level (performance comparison documented)
8. All new code has TDD tests and structured timing logs

**Logging instrumentation:**
- `vad_state`: log VAD start/stop with threshold, duration, silence_start/silence_end timestamps
- `level_polling`: log polling interval, response times per request
- `language_switch`: log language change events with timestamp and source (settings/tray)

---

## Phase 7: History & Overlay

**Goal:** Make history actionable (copy/export), transparent (dictionary stats), and visually polished (progress bar).

**Requirements:** HST-01, HST-02, HST-03, HST-04, HST-05, HST-06, DIC-01, DIC-02, DIC-03, DIC-04, OVL-03, OVL-04, OVL-05, OVL-06

**Success criteria:**
1. Each history item has a copy button that copies polished_text and shows toast
2. History page has export button with txt/md format dialog
3. Each dictionary entry shows match frequency badge ("最近N次触发M次" / "未触发")
4. Overlay step dots replaced with continuous progress bar
5. Progress bar shows per-phase color and pulse animation
6. VAD countdown renders as gray tail fill on progress bar
7. Completed state shows green bar for 2s then fade out
8. All new code has TDD tests and structured timing logs

**Logging instrumentation:**
- `dict_stats`: log per-session dictionary match counts, entry IDs
- `history_export`: log export format, count, file size
- `overlay_progress`: log phase transition timestamps (for animation smoothness analysis)

---

## Phase 8: Overlay Polish + Onboarding

**Goal:** Fix overlay progress bar to true 0→100% continuous animation, fix phase broadcast timing, build first-run onboarding wizard.

**Requirements:** ONB-01..08 + overlay fixes (broadcast timing, continuous progress)

**Success criteria:**
- [ ] Broadcast `transcribing` BEFORE ASR, `polishing` BEFORE LLM (not after)
- [ ] Progress bar smoothly animates 0→100% across pipeline (simulated, not segmented)
- [ ] Recording: 0-35% with mic wave overlay
- [ ] Transcribing: 35-65% smooth advance + pulse
- [ ] Polishing: 65-90% smooth advance + pulse
- [ ] Completed: 100% green, 2s, fade out
- [ ] Failed: freeze current position + red flash
- [ ] Fresh install → modal wizard appears on first launch
- [ ] Step 1: system deps detected with green/red badges, fix instructions shown
- [ ] Step 2: ASR URL + key input with test-connection button using probe audio
- [ ] Step 3: LLM URL + key + model with test-connection button
- [ ] Step 4: trial recording runs full pipeline, shows result in wizard
- [ ] Prev/next/skip navigation works, skip defers to later
- [ ] After completion, `onboarding_completed` flag persisted; Settings has "重新引导" link
- [ ] All new code has TDD tests and structured timing logs

**Logging instrumentation:**
- `phase_broadcast`: log broadcast timing (before/after API call)
- `onboarding_start/complete`: log step timestamps, completion status
- `dep_check`: log each dep result (found/missing) per check
- `probe_asr/llm`: log probe timing, success/failure, error category

---

## Phase 9: Scene Profiles

**Goal:** Preset scene system with CRUD, pipeline integration, and quick-switch.

**Requirements:** PRO-01, PRO-02, PRO-03, PRO-04, PRO-05, PRO-06, PRO-07

**Success criteria:**
1. `profiles` table created; 5 presets seeded on migration
2. CRUD API operational (list/get/create/update/delete)
3. Settings → 场景管理 panel shows profiles with active selection
4. Dictation pipeline uses active profile's prompt and dictionary association
5. User can duplicate a preset and customize
6. Tray menu or hotkey can switch active profile
7. All new code has TDD tests and structured timing logs

**Logging instrumentation:**
- `profile_switch`: log profile id, name, source (settings/tray/hotkey)
- `profile_pipeline`: log which profile and prompt_template used per session
- `profile_crud`: log all CRUD operations with affected profile id
