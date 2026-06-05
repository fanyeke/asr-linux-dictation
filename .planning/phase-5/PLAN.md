# Phase 5: Product Hardening — PLAN.md

## Goal

Make the app reliable enough for daily use by hardening failure paths, adding retry logic, and improving diagnostics.

## Exit Criteria

- [ ] ASR and LLM failures are retried with backoff before surfacing to the user.
- [ ] Clipboard is saved before injection and restored afterward.
- [ ] Failed sessions can be retried from history without re-recording.
- [ ] Diagnostic bundle can be exported from the GUI.
- [ ] Polish output is sanitized to remove unwanted greetings/explanations.
- [ ] All new behavior has tests (TDD).
- [ ] Manual smoke checklist is updated.

## Workstreams

### W1: Retry Policy for ASR and LLM

**TDD approach:**
1. Write tests for `RetryPolicy` class:
   - Retries on 5xx and timeout, not on 4xx (except 429).
   - Exponential backoff with jitter.
   - Max 3 attempts default.
   - Final failure returns raw text as fallback for polish, raises for ASR.
2. Implement `RetryPolicy`.
3. Wire into `ASRClient.transcribe()` and `PolishClient.polish()`.

**Files:**
- `src/backend/retry_policy.py` (new)
- `tests/backend/test_retry_policy.py` (new)
- `src/backend/asr_client.py`
- `src/backend/polish_client.py`

---

### W2: Clipboard Save/Restore

**TDD approach:**
1. Write tests for `ClipboardManager`:
   - `save()` stores current clipboard content.
   - `restore()` puts it back.
   - `inject_with_fallback()` saves → injects → restores; if focus lost, copies to clipboard.
2. Implement `ClipboardManager`.
3. Replace direct xdotool calls in `TextInjector` with `ClipboardManager`.

**Files:**
- `src/backend/clipboard_manager.py` (new)
- `tests/backend/test_clipboard_manager.py` (new)
- `src/backend/text_injector.py`

---

### W3: Polish Output Sanitization

**TDD approach:**
1. Write tests for `sanitize_polish_output()`:
   - Removes common greeting prefixes ("你好", "您好", "Sure", "Here is").
   - Removes markdown code fences if present.
   - Removes trailing explanations after the polished text.
   - Preserves the text when no sanitization is needed.
2. Implement `sanitize_polish_output()`.
3. Call it in `PolishClient.polish()` before returning.

**Files:**
- `src/backend/polish_sanitizer.py` (new)
- `tests/backend/test_polish_sanitizer.py` (new)
- `src/backend/polish_client.py`

---

### W4: Failed-Session Retry

**TDD approach:**
1. Write tests for retry endpoint:
   - `POST /history/{id}/retry` re-runs polish+inject using stored raw_text.
   - Returns new history record with updated status.
   - Handles case where raw_text is missing (returns error).
2. Implement retry endpoint.
3. Add "Retry" button to history items in settings UI.

**Files:**
- `src/backend/main.py` (retry route)
- `src/backend/history_store.py` (get session by id)
- `tests/backend/test_history_retry.py` (new)
- `src/electron/renderer/settings/settings-window.tsx`

---

### W5: Diagnostic Bundle Export

**TDD approach:**
1. Write tests for `export_diagnostics()`:
   - Includes latest log file.
   - Includes user_config (with api_key redacted).
   - Includes last 20 history records.
   - Produces a valid zip file.
2. Implement bundle export.
3. Add "Export Diagnostics" button to settings UI.

**Files:**
- `src/backend/diagnostics.py` (new)
- `tests/backend/test_diagnostics.py` (new)
- `src/backend/main.py` (export route)
- `src/electron/renderer/settings/settings-window.tsx`

---

### W6: Prompt/Dictionary Editor UI Polish

**Not TDD-critical** (GUI layout), but should have contract tests:
- Activate/deactivate prompts.
- Better input styling for dictionary entries.
- Validation feedback.

**Files:**
- `src/electron/renderer/settings/settings-window.tsx`

---

## TDD Loop for Each Workstream

1. Write the smallest failing test.
2. Run `uv run pytest tests/backend/test_<module>.py -v` → confirm red.
3. Implement the smallest change → green.
4. Refactor if needed → stay green.
5. Commit.

## Test Commands

```bash
# Backend
uv run pytest tests/backend -q

# Frontend
npm run test

# Build check
npm run build
```

## Subagent Dispatch Plan

- **Subagent A** → W1 (Retry Policy) + W3 (Polish Sanitization)
- **Subagent B** → W2 (Clipboard Manager)
- **Subagent C** → W4 (History Retry) + W5 (Diagnostics)
- **Orchestrator** → W6 (UI polish) + final integration + test run

Each subagent receives this PLAN.md and the relevant file paths.
