# Requirements — v1.0 Experience Enhancements

## Priority Legend

- **[P0]** — Blocking / must have
- **[P1]** — Important
- **[P2]** — Nice to have

---

### ONB — Onboarding Wizard

| ID | Priority | Requirement | TDD | Logging |
|----|----------|-------------|-----|---------|
| ONB-01 | P1 | System auto-detects `arecord`, `xdotool`, `xsel`/`xclip`, `xprop` on first launch | ✅ | ✅ |
| ONB-02 | P1 | Unmet deps displayed with red/green labels + fix instructions (apt install) | ✅ | — |
| ONB-03 | P1 | ASR config step: Base URL + API Key input + test-connection button with probe audio | ✅ | ✅ |
| ONB-04 | P1 | LLM config step: Base URL + API Key + model name + test button | ✅ | ✅ |
| ONB-05 | P1 | Trial recording step: hotkey record, run full pipeline, show result inline | ✅ | ✅ |
| ONB-06 | P1 | Wizard is a modal (not embedded in Settings), 4 steps with prev/next/skip | ✅ | — |
| ONB-07 | P1 | `onboarding_completed` persisted to DB; Settings page shows "rerun" link | ✅ | ✅ |
| ONB-08 | P2 | Skip button allows deferring wizard; can be re-triggered later | ✅ | ✅ |

### ASR — ASR Language Selection

| ID | Priority | Requirement | TDD | Logging |
|----|----------|-------------|-----|---------|
| ASR-01 | P0 | Settings → API Config area: dropdown with zh/en/auto options | ✅ | — |
| ASR-02 | P0 | Selection persisted to `UserConfig` and `user_config` DB table | ✅ | ✅ |
| ASR-03 | P0 | `dictation_orchestrator.py` passes selected language to `asr_client.transcribe()` | ✅ | ✅ |
| ASR-04 | P1 | Tray right-click menu: language quick-switch submenu | ✅ | ✅ |
| ASR-05 | P2 | Language setting reflected in overlay status text | — | — |

### VAD — VAD Silence Detection

| ID | Priority | Requirement | TDD | Logging |
|----|----------|-------------|-----|---------|
| VAD-01 | P0 | Settings toggle to enable/disable VAD auto-stop | ✅ | ✅ |
| VAD-02 | P0 | Settings slider: silence threshold (0.001–0.05, default 0.005) | ✅ | — |
| VAD-03 | P0 | Settings slider: silence duration (500–5000ms, default 2000ms) | ✅ | — |
| VAD-04 | P0 | `AudioRecorder.start()` respects VAD toggle | ✅ | ✅ |
| VAD-05 | P1 | Settings for these values persisted to `UserConfig` | ✅ | ✅ |
| VAD-06 | P1 | Overlay: silence countdown indicator when VAD detects silence | ✅ | — |
| VAD-07 | P2 | Default VAD state matches current behavior (enabled with 2000ms/0.005) | ✅ | ✅ |

### PRO — Scene Profiles

| ID | Priority | Requirement | TDD | Logging |
|----|----------|-------------|-----|---------|
| PRO-01 | P1 | New `profiles` DB table: id, name, prompt_template, dictionary_ids, asr_language, timestamps | ✅ | — |
| PRO-02 | P1 | CRUD API: list/get/create/update/delete profiles | ✅ | ✅ |
| PRO-03 | P1 | 5 built-in presets seeded on first migration: 通用, 编程, 写作, 会议记录, 聊天 | ✅ | ✅ |
| PRO-04 | P1 | Settings → "场景管理" panel: tab/dropdown to switch active profile | ✅ | — |
| PRO-05 | P1 | Active profile's prompt_template + dictionary_ids used during dictation pipeline | ✅ | ✅ |
| PRO-06 | P2 | User can duplicate preset and customize prompt/associations | ✅ | — |
| PRO-07 | P2 | Tray menu or hotkey for quick profile switching | ✅ | ✅ |

### HST — History Record Enhancement

| ID | Priority | Requirement | TDD | Logging |
|----|----------|-------------|-----|---------|
| HST-01 | P0 | Each history item has a copy button → copies `polished_text` to clipboard + "已复制" toast | ✅ | — |
| HST-02 | P0 | History page header: "导出" button | ✅ | — |
| HST-03 | P1 | Export format: `.txt` — `[timestamp] polished_text` per line | ✅ | ✅ |
| HST-04 | P1 | Export format: `.md` — structured with timestamp, raw, polished, status | ✅ | ✅ |
| HST-05 | P1 | Format selection dialog before download | ✅ | — |
| HST-06 | P2 | Expandable detail already exists — verify no regression | ✅ | — |

### DIC — Dictionary Matching Frequency

| ID | Priority | Requirement | TDD | Logging |
|----|----------|-------------|-----|---------|
| DIC-01 | P1 | New `dictionary_stats` DB table: entry_id, session_id, matched_count, created_at | ✅ | — |
| DIC-02 | P1 | After polish completes, count dictionary entries appearing in polished_text and write stats | ✅ | ✅ |
| DIC-03 | P1 | `DictionaryManager`: each entry shows "last 10 runs: N hits" or "未触发" badge | ✅ | — |
| DIC-04 | P2 | Zero-hit entries shown in gray | ✅ | — |

### OVL — Overlay Level Refresh & Progress Bar

| ID | Priority | Requirement | TDD | Logging |
|----|----------|-------------|-----|---------|
| OVL-01 | P0 | Audit current level polling rate (100ms) and optimize to 60–80ms | ✅ | ✅ |
| OVL-02 | P1 | Evaluate WebSocket push for mic level (replace HTTP polling) | ✅ | ✅ |
| OVL-03 | P1 | Replace step dots with continuous progress bar | ✅ | — |
| OVL-04 | P1 | Progress bar colors: idle=hidden, recording=red/waving, transcribing=blue/pulse, polishing=purple/pulse, completed=green, failed=red | ✅ | — |
| OVL-05 | P1 | VAD countdown integrated into progress bar (gray tail fill) | ✅ | — |
| OVL-06 | P2 | Completed bar stays briefly then fade out (2s delay) | ✅ | — |

### DSH — Dashboard & Stats (Phase 11)

| ID | Priority | Requirement | TDD | Logging |
|----|----------|-------------|-----|---------|
| DSH-01 | P1 | Backend `/dashboard/stats` endpoint with SQL aggregates | ✅ | ✅ |
| DSH-02 | P1 | Dashboard page with stat cards (active sessions, success rate, avg latency, total chars) | ✅ | — |
| DSH-03 | P2 | Daily usage bar chart (7-day view) | ✅ | — |
| DSH-04 | P2 | Latency trend line chart with dual ASR/LLM lines | ✅ | — |
| DSH-05 | P2 | Empty state for no-data scenarios | ✅ | — |

### CLP — Clipboard Save/Restore (Phase 12)

| ID | Priority | Requirement | TDD | Logging |
|----|----------|-------------|-----|---------|
| CLP-01 | P0 | Save clipboard before injection, restore after successful paste | ✅ | ✅ |
| CLP-02 | P0 | On paste failure or focus loss, injected text stays as clipboard fallback | ✅ | ✅ |
| CLP-03 | P1 | `ClipboardManager.inject_with_fallback()` used instead of hand-written flow | ✅ | — |

### STR — Pseudo-Streaming ASR (Phase 13)

| ID | Priority | Requirement | TDD | Logging |
|----|----------|-------------|-----|---------|
| STR-01 | P1 | AudioRecorder captures PCM to in-memory ring buffer | ✅ | — |
| STR-02 | P1 | Background task slices 3s chunks (1s overlap) from ring buffer | 🚧 | — |
| STR-03 | P1 | Each slice sent to ASR asynchronously; partial results stored | 🚧 | ✅ |
| STR-04 | P1 | Partial results broadcast via WebSocket as `partial_transcript` events | 🚧 | — |
| STR-05 | P1 | After recording stops, partial results merged via longest-suffix matching | ✅ | ✅ |
| STR-06 | P2 | Overlay shows accumulating partial text in preview area | 🚧 | — |

### WUP — Connection Warmup (Phase 14)

| ID | Priority | Requirement | TDD | Logging |
|----|----------|-------------|-----|---------|
| WUP-01 | P1 | `ASRClient.warmup()` issues minimal probe to ASR endpoint | ✅ | ✅ |
| WUP-02 | P1 | `PolishClient.warmup()` issues minimal probe to LLM endpoint | ✅ | ✅ |
| WUP-03 | P1 | Warmup called after `recorder.start()`; failures logged but never block | ✅ | ✅ |

---

## Traceability

| Phase | REQ-IDs |
|-------|---------|
| Phase 6 — Core Config & UX | ASR-01, ASR-02, ASR-03, ASR-04, ASR-05, VAD-01, VAD-02, VAD-03, VAD-04, VAD-05, VAD-06, VAD-07, OVL-01, OVL-02 |
| Phase 7 — History & Overlay | HST-01, HST-02, HST-03, HST-04, HST-05, HST-06, DIC-01, DIC-02, DIC-03, DIC-04, OVL-03, OVL-04, OVL-05, OVL-06 |
| Phase 8 — Onboarding Wizard | ONB-01, ONB-02, ONB-03, ONB-04, ONB-05, ONB-06, ONB-07, ONB-08 |
| Phase 9 — Scene Profiles | PRO-01, PRO-02, PRO-03, PRO-04, PRO-05, PRO-06, PRO-07 |
| Phase 11 — Dashboard & Stats | DSH-01, DSH-02, DSH-03, DSH-04, DSH-05 |
| Phase 12 — Clipboard Save/Restore | CLP-01, CLP-02, CLP-03 |
| Phase 13 — Pseudo-Streaming ASR | STR-01, STR-02, STR-03, STR-04, STR-05, STR-06 |
| Phase 14 — Connection Warmup | WUP-01, WUP-02, WUP-03 |

---

## Out of Scope (v1.2)

- Wayland compatibility — deferred to future milestone
- Push-to-talk mode beyond current toggle behavior
- Cloud sync of config/profiles
- Per-app behavior profiles (auto-switch based on focused window)

## Future Considerations

- Per-app behavior profiles (auto-switch profile based on focused window)
- Profile import/export
- History search/filter by date
