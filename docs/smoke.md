# Manual Smoke Tests

This document records manual smoke test procedures for desktop behavior that cannot be fully automated in unit tests.

## Phase 3: Audio and Desktop Injection

### Prerequisites

- Linux with ALSA (`arecord` from `alsa-utils`)
- X11 desktop session
- `xdotool` plus either `xsel` or `xclip` installed
- Microphone connected and working

### Audio Recorder Smoke

```bash
uv run python scripts/smoke_dictation.py
```

Steps:
1. When prompted, press Enter to start recording
2. Speak into the microphone for 5 seconds
3. The script will show real-time audio levels
4. Recording stops automatically after 5 seconds
5. Verify the WAV file is created in `~/.local/share/asr-linux/recordings/`

Expected result:
- File size > 0 bytes
- Audio levels respond to voice input

### Text Injector Smoke

Steps:
1. Focus a text input window (e.g., gedit, Firefox address bar, terminal)
2. When prompted, press Enter to inject test text
3. Verify the text appears in the focused window

Expected results:
- Normal window: text appears via simulated Ctrl+V
- Terminal window: text appears via simulated Ctrl+Shift+V
- If focus changes during injection: text should be in clipboard

### Full Pipeline Smoke (requires API key)

```bash
export ASR_LINUX_MIMO_API_KEY="tp-..."
uv run python scripts/smoke_dictation.py
```

Steps:
1. Record audio with speech
2. The script will transcribe via MiMo ASR
3. Then polish via MiMo LLM
4. Finally inject the polished text into the focused window

Expected result:
- Spoken words are transcribed, polished, and inserted

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| arecord not found | alsa-utils not installed | `sudo apt install alsa-utils` |
| xsel/xclip/xdotool not found | tools not installed | `sudo apt install xsel xclip xdotool` |
| No audio levels | Microphone muted or wrong device | Check `alsamixer`, set `ASR_LINUX_AUDIO_DEVICE` |
| Injection fails | Window lost focus | Text is saved to clipboard as fallback |
| Terminal paste fails | Wrong terminal type detected | Check `xprop -id $(xdotool getactivewindow) WM_CLASS` |

### Known Desktop Limitations

- Automatic text injection currently targets X11 through `xsel`, `xclip`,
  `xprop`, and `xdotool`.
- Native Wayland injection is not implemented yet. On Wayland sessions, use an
  X11/XWayland target app or paste manually from the clipboard fallback until a
  `wl-copy`/`wtype` compatibility path is added and tested.

## Phase 6: API Configuration And Hotkey UX

### Prerequisites

- Electron app running in development or packaged mode
- Backend reachable from the settings window
- Valid ASR key for the selected ASR provider
- Valid OpenAI-compatible LLM key if LLM polishing is enabled

### API Settings Smoke

Steps:
1. Open Settings.
2. Fill ASR API Key, ASR Base URL, and ASR Model.
3. Fill LLM API Key, LLM Base URL, and LLM Model.
4. Toggle `Enable LLM Polish` off and on.
5. Click `Save API Settings`.
6. Restart the app and reopen Settings.
7. Verify all API fields and the LLM toggle are restored.
8. Click `Test ASR Key`.
9. Click `Test LLM Key`.

Expected results:
- API fields survive restart.
- ASR and LLM tests report separate success or failure messages.
- A failed ASR test does not imply the LLM key is invalid, and vice versa.
- When LLM polishing is disabled, dictation inserts the ASR transcript without
  waiting for an LLM request.

### Hotkey Editing Smoke

Steps:
1. Focus the Global Hotkey field.
2. Press the currently registered hotkey.
3. Press a new key combination.
4. Click `Save Hotkey`.
5. Press the new hotkey outside the field.

Expected results:
- Pressing keys while the field is focused changes the displayed accelerator.
- Recording does not start while the field is focused.
- After saving, the new hotkey toggles dictation.

### Startup Overlay Smoke

Steps:
1. Start the app.
2. Do not trigger dictation.
3. Trigger dictation once, then stop it.

Expected results:
- No bottom overlay is visible immediately after startup.
- The overlay appears only during dictation states and hides after completion or
  failure.

## Smoke Checklist Template

For each manual smoke test session, record:

- **OS/session**: e.g., Ubuntu 22.04 / X11
- **Microphone source**: e.g., Built-in microphone / USB headset
- **Target app**: e.g., gedit / Firefox / gnome-terminal
- **Expected result**: What should happen
- **Actual result**: What actually happened
- **Log file**: Path to relevant log if failure
