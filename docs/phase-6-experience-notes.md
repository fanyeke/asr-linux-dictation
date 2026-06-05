# Phase 6 Experience Notes

This note records workflow changes made during the experience-enhancement pass.

## API And LLM Configuration

The settings window separates ASR and LLM configuration because the two services
can use different providers, keys, base URLs, and models.

- ASR keeps the MiMo-compatible defaults and is tested through `Test ASR Key`.
- LLM uses an OpenAI-compatible `/chat/completions` request and is tested through
  `Test LLM Key`.
- `Enable LLM Polish` allows raw ASR output to be inserted without LLM polishing.
- `Save API Settings` persists ASR and LLM keys, URLs, models, and the LLM toggle
  together so a restart does not lose partial API configuration.
- API keys are stored through Linux Secret Service via `secret-tool` when it is
  available. If Secret Service is unavailable or rejects the write, the app falls
  back to SQLite so the settings workflow still works.
- `Save Hotkey` remains separate because global shortcut registration is owned by
  Electron and can fail independently of backend config persistence.

The design intent is to make failures diagnosable before a full dictation run:
users can verify ASR and LLM independently and see which provider rejected the
configuration.

## Hotkey Editing

The global hotkey field captures keyboard events instead of accepting text input.
While the field is focused, dictation toggle events are ignored so pressing the
current hotkey during editing does not start recording.

## Startup Overlay

The overlay window is created hidden at startup. It should appear only when a
dictation state event needs it, avoiding a stale bottom-screen status bar after
launch.

## Desktop Injection Robustness

X11 clipboard writes prefer `xsel` because it commits synchronously in the
tested desktop session. `xclip` remains supported as a fallback through bounded
clipboard-owner loops. Desktop helper commands have timeouts so a stuck
`xclip`, `xprop`, or `xdotool` process cannot keep a dictation attempt from
finishing.

Local X11 smoke on 2026-06-05:

- Target: temporary `zenity --entry` window.
- Result: `TextInjector` returned `success=True`, `method=paste`.
- Verification: copied the target input content back from the temporary window;
  it matched the injected smoke text.
