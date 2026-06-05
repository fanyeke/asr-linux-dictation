import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppState,
  BackendConfig,
  ConnectionStatus,
  DictionaryEntry,
  HistorySession,
  Prompt,
} from "./types.js";
import type { VoiceAPI } from "../overlay/types.js";

// ---------------------------------------------------------------------------
// voiceAPI is declared as optional on Window in overlay/types.ts.
// In the Settings window (Electron renderer) it is always present,
// so we use non-null assertions.
// ---------------------------------------------------------------------------

/** Safe accessor for the voiceAPI bridge. */
function getVoiceAPI(): VoiceAPI {
  return window.voiceAPI!;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: "14px",
    color: "#1a1a1a",
    padding: "20px",
    maxWidth: "720px",
    margin: "0 auto",
  },
  heading: {
    fontSize: "22px",
    fontWeight: 600,
    marginBottom: "20px",
  },
  section: {
    background: "#f7f7f8",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: 600,
    marginBottom: "12px",
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontWeight: 500,
    fontSize: "13px",
  },
  input: {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "14px",
    boxSizing: "border-box" as const,
  },
  passwordField: {
    position: "relative",
    flex: 1,
  },
  passwordToggle: {
    position: "absolute" as const,
    top: "50%",
    right: "8px",
    transform: "translateY(-50%)",
    width: "28px",
    height: "28px",
    border: "none",
    borderRadius: "4px",
    background: "transparent",
    color: "#666",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  button: {
    padding: "8px 16px",
    border: "none",
    borderRadius: "4px",
    fontSize: "14px",
    cursor: "pointer",
    fontWeight: 500,
  },
  buttonPrimary: {
    background: "#0066cc",
    color: "#fff",
  },
  buttonSecondary: {
    background: "#e0e0e0",
    color: "#333",
  },
  buttonDanger: {
    background: "#d32f2f",
    color: "#fff",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
  },
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: 600,
  },
  badgeSuccess: {
    background: "#e8f5e9",
    color: "#2e7d32",
  },
  badgeFailed: {
    background: "#ffebee",
    color: "#c62828",
  },
  badgeUnknown: {
    background: "#fff3e0",
    color: "#e65100",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  listItem: {
    padding: "6px 0",
    borderBottom: "1px solid #eee",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  maskedToken: {
    fontFamily: "monospace",
    color: "#666",
  },
  levelBarOuter: {
    width: "100%",
    height: "12px",
    background: "#e0e0e0",
    borderRadius: "6px",
    overflow: "hidden",
  },
  levelBarInner: {
    height: "100%",
    background: "linear-gradient(90deg, #4caf50, #8bc34a)",
    borderRadius: "6px",
    transition: "width 150ms ease",
  },
  error: {
    color: "#d32f2f",
    fontSize: "13px",
    marginTop: "6px",
  },
  textMuted: {
    color: "#888",
    fontSize: "12px",
  },
  toast: {
    position: "fixed" as const,
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#333",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: "6px",
    fontSize: "14px",
    zIndex: 1000,
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    transition: "opacity 0.3s ease",
  },
  toastVisible: {
    opacity: 1,
  },
  toastHidden: {
    opacity: 0,
    pointerEvents: "none" as const,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskToken(token: string): string {
  if (token.length <= 8) return "••••••••";
  return token.slice(0, 4) + "••••" + token.slice(-4);
}

function statusBadgeStyle(status: string): React.CSSProperties {
  switch (status) {
    case "completed":
      return { ...styles.badge, ...styles.badgeSuccess };
    case "failed":
      return { ...styles.badge, ...styles.badgeFailed };
    default:
      return { ...styles.badge, ...styles.badgeUnknown };
  }
}

function connectionBadgeText(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "failed":
      return "Disconnected";
    default:
      return "Unknown";
  }
}

function connectionBadgeStyle(status: ConnectionStatus): React.CSSProperties {
  switch (status) {
    case "connected":
      return { ...styles.badge, ...styles.badgeSuccess };
    case "failed":
      return { ...styles.badge, ...styles.badgeFailed };
    default:
      return { ...styles.badge, ...styles.badgeUnknown };
  }
}

function EyeIcon({ crossed }: { crossed: boolean }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  );
}

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

function normalizeAcceleratorKey(
  event: React.KeyboardEvent<HTMLInputElement>,
): string | null {
  if (MODIFIER_KEYS.has(event.key)) {
    return null;
  }
  if (event.key === " ") {
    return "Space";
  }
  if (event.key === "Escape") {
    return "Esc";
  }
  if (event.key.startsWith("Arrow")) {
    return event.key.replace("Arrow", "");
  }
  if (event.key.length === 1) {
    return event.key.toUpperCase();
  }
  return event.key;
}

function formatAccelerator(
  event: React.KeyboardEvent<HTMLInputElement>,
): string | null {
  const key = normalizeAcceleratorKey(event);
  if (!key) {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Super");
  parts.push(key);
  return parts.join("+");
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const initialState: AppState = {
  asrApiKey: "",
  asrBaseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
  asrModel: "mimo-v2.5-asr",
  llmApiKey: "",
  llmEnabled: true,
  llmBaseUrl: "https://api.openai.com/v1",
  llmModel: "gpt-4o-mini",
  hotkey: "Alt+=",
  connectionStatus: "unknown",
  llmConnectionStatus: "unknown",
  isRecording: false,
  isProcessing: false,
  micLevel: 0,
  prompts: [],
  dictionary: [],
  history: [],
  backendConfig: null,
  loading: true,
  error: null,
  dictationError: null,
  toast: null,
};

function buildConfigPayload(state: AppState): Record<string, unknown> {
  return {
    asr_api_key: state.asrApiKey,
    asr_base_url: state.asrBaseUrl,
    asr_model: state.asrModel,
    llm_api_key: state.llmApiKey,
    llm_enabled: state.llmEnabled,
    llm_base_url: state.llmBaseUrl,
    llm_model: state.llmModel,
    hotkey: state.hotkey,
  };
}

async function readErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = await response.json() as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail) {
        return body.detail;
      }
    } catch {
      // Fall through to text body.
    }
  }
  return response.text().catch(() => "");
}

// ---------------------------------------------------------------------------
// SettingsWindow component
// ---------------------------------------------------------------------------

export function SettingsWindow(): JSX.Element {
  const [state, setState] = useState<AppState>(initialState);
  const [showAsrApiKey, setShowAsrApiKey] = useState(false);
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isCapturingHotkeyRef = useRef(false);

  // Keep ref in sync with state for hotkey handler
  useEffect(() => {
    isRecordingRef.current = state.isRecording;
    isProcessingRef.current = state.isProcessing;
  }, [state.isRecording, state.isProcessing]);

  // ---- Data loading -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadData(): Promise<void> {
      try {
        const config = await getVoiceAPI().getBackendConfig();
        if (cancelled) return;

        if (!config) {
          setState((prev: AppState) => ({
            ...prev,
            loading: false,
            error: "Failed to load backend configuration",
          }));
          return;
        }

        const headers = {
          "x-token": config.token,
          "Content-Type": "application/json",
        };

        const [promptsRes, dictRes, historyRes, configRes] = await Promise.all([
          fetch(`${config.url}/prompts`, { headers }),
          fetch(`${config.url}/dictionary`, { headers }),
          fetch(`${config.url}/history`, { headers }),
          fetch(`${config.url}/config`, { headers: { "x-token": config.token } }),
        ]);

        if (cancelled) return;

        const prompts: Prompt[] = promptsRes.ok ? await promptsRes.json() : [];
        const dictionary: DictionaryEntry[] = dictRes.ok
          ? await dictRes.json()
          : [];
        const history: HistorySession[] = historyRes.ok
          ? await historyRes.json()
          : [];

        let userCfg: Partial<AppState> = {};
        try {
          if (configRes.ok) {
            const cfg = await configRes.json();
            userCfg = {
              asrApiKey: cfg.asr_api_key || cfg.api_key || "",
              asrBaseUrl: cfg.asr_base_url || initialState.asrBaseUrl,
              asrModel: cfg.asr_model || initialState.asrModel,
              llmApiKey: cfg.llm_api_key || "",
              llmEnabled: cfg.llm_enabled ?? initialState.llmEnabled,
              llmBaseUrl: cfg.llm_base_url || initialState.llmBaseUrl,
              llmModel: cfg.llm_model || initialState.llmModel,
              hotkey: cfg.hotkey || initialState.hotkey,
            };
          }
        } catch {
          // Config endpoint optional; ignore parse errors
        }

        setState((prev: AppState) => ({
          ...prev,
          ...userCfg,
          prompts,
          dictionary,
          history,
          backendConfig: config,
          loading: false,
          error: null,
        }));
      } catch (err) {
        if (!cancelled) {
          setState((prev: AppState) => ({
            ...prev,
            loading: false,
            error:
              err instanceof Error ? err.message : "An unknown error occurred",
          }));
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Microphone level subscription -------------------------------------
  useEffect(() => {
    const unsub = getVoiceAPI().onMicrophoneLevel((level: number) => {
      setState((prev: AppState) => ({ ...prev, micLevel: level }));
    });
    return unsub;
  }, []);

  // ---- Status update subscription -----------------------------------------
  useEffect(() => {
    const unsub = getVoiceAPI().onStatusUpdate((status) => {
      setState((prev: AppState) => {
        const next: AppState = { ...prev };
        if (status.phase === "recording") {
          next.isRecording = true;
          next.isProcessing = false;
          isRecordingRef.current = true;
          isProcessingRef.current = false;
        } else if (
          status.phase === "transcribing" ||
          status.phase === "polishing" ||
          status.phase === "inserting"
        ) {
          next.isRecording = false;
          next.isProcessing = true;
          isRecordingRef.current = false;
          isProcessingRef.current = true;
        } else if (
          status.phase === "completed" ||
          status.phase === "failed"
        ) {
          next.isRecording = false;
          next.isProcessing = false;
          isRecordingRef.current = false;
          isProcessingRef.current = false;
          if (status.phase === "failed" && "error" in status) {
            next.error = status.error;
          } else if (status.phase === "completed") {
            next.error = null;
          }
        }
        return next;
      });
    });
    return unsub;
  }, []);

  // ---- Handlers ----------------------------------------------------------
  const handleAsrApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev: AppState) => ({ ...prev, asrApiKey: e.target.value }));
    },
    [],
  );

  const handleLlmApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev: AppState) => ({ ...prev, llmApiKey: e.target.value }));
    },
    [],
  );

  const handleAsrBaseUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev: AppState) => ({ ...prev, asrBaseUrl: e.target.value }));
    },
    [],
  );

  const handleAsrModelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev: AppState) => ({ ...prev, asrModel: e.target.value }));
    },
    [],
  );

  const handleLlmEnabledChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev: AppState) => ({ ...prev, llmEnabled: e.target.checked }));
    },
    [],
  );

  const handleLlmBaseUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev: AppState) => ({ ...prev, llmBaseUrl: e.target.value }));
    },
    [],
  );

  const handleLlmModelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev: AppState) => ({ ...prev, llmModel: e.target.value }));
    },
    [],
  );

  const handleHotkeyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();
      isCapturingHotkeyRef.current = true;
      const nextHotkey = formatAccelerator(e);
      if (!nextHotkey) {
        return;
      }
      setState((prev: AppState) => ({ ...prev, hotkey: nextHotkey }));
    },
    [],
  );

  const handleSaveApiKey = useCallback(async () => {
    const config = state.backendConfig;
    if (!config) return;

    try {
      const res = await fetch(`${config.url}/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-token": config.token,
        },
        body: JSON.stringify(buildConfigPayload(state)),
      });
      if (res.ok) {
        setState((prev: AppState) => ({
          ...prev,
          toast: "Configuration saved successfully",
        }));
        // Auto-clear toast after 3s
        setTimeout(() => {
          setState((prev: AppState) => ({ ...prev, toast: null }));
        }, 3000);
      } else {
        const body = await readErrorDetail(res);
        setState((prev: AppState) => ({
          ...prev,
          toast: `Failed to save config: ${res.status} ${body}`,
        }));
      }
    } catch (err) {
      setState((prev: AppState) => ({
        ...prev,
        toast: `Failed to save config: ${err instanceof Error ? err.message : "network error"}`,
      }));
    }
  }, [
    state.backendConfig,
    state.asrApiKey,
    state.asrBaseUrl,
    state.asrModel,
    state.llmApiKey,
    state.llmEnabled,
    state.llmBaseUrl,
    state.llmModel,
    state.hotkey,
  ]);

  const handleTestConnection = useCallback(async () => {
    const config = state.backendConfig;
    if (!config) return;

    setState((prev: AppState) => ({ ...prev, connectionStatus: "unknown" }));

    try {
      const saveRes = await fetch(`${config.url}/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-token": config.token,
        },
        body: JSON.stringify(buildConfigPayload(state)),
      });
      if (!saveRes.ok) {
        const body = await readErrorDetail(saveRes);
        setState((prev: AppState) => ({
          ...prev,
          connectionStatus: "failed",
          toast: `Failed to save config before ASR test: ${saveRes.status} ${body}`,
        }));
        return;
      }

      const res = await fetch(`${config.url}/test-asr-key`, {
        headers: { "x-token": config.token },
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev: AppState) => ({
          ...prev,
          connectionStatus: "connected",
          toast: data.message || "ASR key is valid",
        }));
      } else {
        const body = await readErrorDetail(res);
        setState((prev: AppState) => ({
          ...prev,
          connectionStatus: "failed",
          toast: `ASR test failed: ${res.status} ${body}`,
        }));
      }
      // Auto-clear toast after 5s
      setTimeout(() => {
        setState((prev: AppState) => ({ ...prev, toast: null }));
      }, 5000);
    } catch (err) {
      setState((prev: AppState) => ({
        ...prev,
        connectionStatus: "failed",
        toast: `ASR test failed: ${err instanceof Error ? err.message : "network error"}`,
      }));
      setTimeout(() => {
        setState((prev: AppState) => ({ ...prev, toast: null }));
      }, 5000);
    }
  }, [
    state.backendConfig,
    state.asrApiKey,
    state.asrBaseUrl,
    state.asrModel,
    state.llmApiKey,
    state.llmEnabled,
    state.llmBaseUrl,
    state.llmModel,
    state.hotkey,
  ]);

  const handleTestLlmConnection = useCallback(async () => {
    const config = state.backendConfig;
    if (!config) return;

    setState((prev: AppState) => ({ ...prev, llmConnectionStatus: "unknown" }));

    try {
      const saveRes = await fetch(`${config.url}/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-token": config.token,
        },
        body: JSON.stringify(buildConfigPayload(state)),
      });
      if (!saveRes.ok) {
        const body = await readErrorDetail(saveRes);
        setState((prev: AppState) => ({
          ...prev,
          llmConnectionStatus: "failed",
          toast: `Failed to save config before LLM test: ${saveRes.status} ${body}`,
        }));
        return;
      }

      const res = await fetch(`${config.url}/test-llm-key`, {
        headers: { "x-token": config.token },
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev: AppState) => ({
          ...prev,
          llmConnectionStatus: "connected",
          toast: data.message || "LLM key is valid",
        }));
      } else {
        const body = await readErrorDetail(res);
        setState((prev: AppState) => ({
          ...prev,
          llmConnectionStatus: "failed",
          toast: `LLM test failed: ${res.status} ${body}`,
        }));
      }
      setTimeout(() => {
        setState((prev: AppState) => ({ ...prev, toast: null }));
      }, 5000);
    } catch (err) {
      setState((prev: AppState) => ({
        ...prev,
        llmConnectionStatus: "failed",
        toast: `LLM test failed: ${err instanceof Error ? err.message : "network error"}`,
      }));
      setTimeout(() => {
        setState((prev: AppState) => ({ ...prev, toast: null }));
      }, 5000);
    }
  }, [
    state.backendConfig,
    state.asrApiKey,
    state.asrBaseUrl,
    state.asrModel,
    state.llmApiKey,
    state.llmEnabled,
    state.llmBaseUrl,
    state.llmModel,
    state.hotkey,
  ]);

  const handleSaveHotkey = useCallback(async () => {
    try {
      const registered = await getVoiceAPI().setHotkey(state.hotkey);
      setState((prev: AppState) => ({
        ...prev,
        hotkey: registered || prev.hotkey,
        toast: registered
          ? `Hotkey changed to ${registered}`
          : `Failed to register hotkey: ${state.hotkey}`,
      }));
      setTimeout(() => {
        setState((prev: AppState) => ({ ...prev, toast: null }));
      }, 3000);
    } catch (err) {
      setState((prev: AppState) => ({
        ...prev,
        toast: `Failed to set hotkey: ${err instanceof Error ? err.message : "unknown error"}`,
      }));
      setTimeout(() => {
        setState((prev: AppState) => ({ ...prev, toast: null }));
      }, 3000);
    }
  }, [state.hotkey]);

  const refreshHistory = useCallback(async () => {
    const config = state.backendConfig;
    if (!config) return;
    try {
      const res = await fetch(`${config.url}/history`, {
        headers: {
          "x-token": config.token,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const history: HistorySession[] = await res.json();
        setState((prev: AppState) => ({ ...prev, history }));
      }
    } catch {
      // ignore refresh errors
    }
  }, [state.backendConfig]);

  const handleStartRecording = useCallback(async () => {
    // Guard against double-start and starting while the previous stop is processing.
    if (isRecordingRef.current || isProcessingRef.current) {
      return;
    }
    try {
      await getVoiceAPI().startDictation();
      // Overlay is shown by the main process start-dictation handler;
      // do NOT call showOverlay() here or it will race and reset the status.
      isRecordingRef.current = true;
      isProcessingRef.current = false;
      setState((prev: AppState) => ({
        ...prev,
        isRecording: true,
        isProcessing: false,
        error: null,
        dictationError: null,
      }));
    } catch (err) {
      isRecordingRef.current = false;
      isProcessingRef.current = false;
      setState((prev: AppState) => ({
        ...prev,
        isRecording: false,
        isProcessing: false,
        error: err instanceof Error ? err.message : "Failed to start recording",
      }));
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    // Guard against double-stop during long pipeline (pipeline can take
    // 5-10s; user may press hotkey again thinking the first stop failed).
    if (!isRecordingRef.current || isProcessingRef.current) {
      return;
    }
    // Flip refs immediately so subsequent hotkey presses are ignored.
    isRecordingRef.current = false;
    isProcessingRef.current = true;
    setState((prev: AppState) => ({
      ...prev,
      isRecording: false,
      isProcessing: true,
      error: null,
    }));

    let result: Awaited<ReturnType<VoiceAPI["stopDictation"]>> | null = null;
    let errorMessage: string | null = null;
    try {
      result = await getVoiceAPI().stopDictation();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    isProcessingRef.current = false;

    setState((prev: AppState) => {
      const next: AppState = { ...prev, isRecording: false, isProcessing: false };
      if (errorMessage) {
        next.error = errorMessage;
        next.dictationError = { message: errorMessage };
      } else if (result) {
        if (result.status === "completed") {
          next.error = null;
          next.dictationError = null;
        } else if (result.status === "idle") {
          // Backend was not recording (idempotent stop) — no UI change needed.
          next.error = null;
        } else if (result.error) {
          next.error = result.error;
          next.dictationError = {
            message: result.error,
            error_type: result.error_type,
            raw_text: result.raw_text,
            polished_text: result.polished_text,
          };
        }
      }
      return next;
    });
    // Refresh history after a completed or failed session
    await refreshHistory();
  }, [refreshHistory]);

  const handleTestMicrophone = useCallback(async () => {
    // For MVP: start+stop quickly as a test
    if (isRecordingRef.current || isProcessingRef.current) {
      return;
    }
    try {
      await getVoiceAPI().startDictation();
      // Overlay is shown by the main process; do NOT call showOverlay() here.
      isRecordingRef.current = true;
      isProcessingRef.current = false;
      setState((prev: AppState) => ({
        ...prev,
        isRecording: true,
        isProcessing: false,
        error: null,
        dictationError: null,
      }));
      setTimeout(async () => {
        let result: Awaited<ReturnType<VoiceAPI["stopDictation"]>> | null = null;
        isRecordingRef.current = false;
        isProcessingRef.current = true;
        setState((prev: AppState) => ({
          ...prev,
          isRecording: false,
          isProcessing: true,
        }));
        try {
          result = await getVoiceAPI().stopDictation();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes("409")) {
            setState((prev: AppState) => ({
              ...prev,
              isRecording: false,
              isProcessing: false,
              error: msg,
              dictationError: { message: msg },
            }));
          }
        }
        isRecordingRef.current = false;
        isProcessingRef.current = false;
        setState((prev: AppState) => {
          const next: AppState = { ...prev, isRecording: false, isProcessing: false };
          if (result?.error) {
            next.error = result.error;
            next.dictationError = {
              message: result.error,
              error_type: result.error_type,
              raw_text: result.raw_text,
              polished_text: result.polished_text,
            };
          } else if (result?.status === "completed") {
            next.error = null;
            next.dictationError = null;
          }
          return next;
        });
        await refreshHistory();
      }, 2000);
    } catch (err) {
      isRecordingRef.current = false;
      isProcessingRef.current = false;
      setState((prev: AppState) => ({
        ...prev,
        isRecording: false,
        isProcessing: false,
        error: err instanceof Error ? err.message : "Failed to start recording",
      }));
    }
  }, [refreshHistory]);

  const handleOpenLogs = useCallback(() => {
    const logDir = `${process.env.HOME || process.env.USERPROFILE || "/tmp"}/.local/share/asr-linux/logs`;
    window.open(`file://${logDir}`, "_blank");
    setState((prev: AppState) => ({
      ...prev,
      toast: `Log folder: ${logDir}`,
    }));
    setTimeout(() => {
      setState((prev: AppState) => ({ ...prev, toast: null }));
    }, 5000);
  }, []);

  // ---- Hotkey toggle subscription ----------------------------------------
  // Use refs so the effect only registers once; the latest handler refs are
  // always current without needing to re-subscribe on dependency changes.
  const handleStartRecordingRef = useRef(handleStartRecording);
  const handleStopRecordingRef = useRef(handleStopRecording);
  useEffect(() => {
    handleStartRecordingRef.current = handleStartRecording;
    handleStopRecordingRef.current = handleStopRecording;
  }, [handleStartRecording, handleStopRecording]);

  useEffect(() => {
    const unsub = getVoiceAPI().onToggleDictation(() => {
      if (isCapturingHotkeyRef.current) {
        return;
      }
      if (isProcessingRef.current) {
        return;
      }
      if (isRecordingRef.current) {
        handleStopRecordingRef.current();
      } else {
        handleStartRecordingRef.current();
      }
    });
    return unsub;
  }, []);

  // ---- Render helpers ----------------------------------------------------
  const renderApiConfigSection = () => (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>API Configuration</h2>
      <div style={styles.row}>
        <label htmlFor="asr-api-key-input" style={{ ...styles.label, margin: 0 }}>
          ASR API Key
        </label>
        <span style={connectionBadgeStyle(state.connectionStatus)}>
          {connectionBadgeText(state.connectionStatus)}
        </span>
      </div>
      <div style={styles.row}>
        <div style={styles.passwordField}>
          <input
            id="asr-api-key-input"
            type={showAsrApiKey ? "text" : "password"}
            value={state.asrApiKey}
            onChange={handleAsrApiKeyChange}
            placeholder="Enter ASR API key"
            style={{ ...styles.input, paddingRight: "42px" }}
          />
          <button
            type="button"
            aria-label={showAsrApiKey ? "Hide ASR API Key" : "Show ASR API Key"}
            title={showAsrApiKey ? "Hide ASR API Key" : "Show ASR API Key"}
            onClick={() => setShowAsrApiKey((value) => !value)}
            style={styles.passwordToggle}
          >
            <EyeIcon crossed={showAsrApiKey} />
          </button>
        </div>
        <button
          type="button"
          onClick={handleTestConnection}
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            whiteSpace: "nowrap",
          }}
        >
          Test ASR Key
        </button>
      </div>

      <div style={{ ...styles.row, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div style={styles.row}>
            <label htmlFor="llm-api-key-input" style={{ ...styles.label, margin: 0 }}>
              LLM API Key
            </label>
            <span style={connectionBadgeStyle(state.llmConnectionStatus)}>
              {connectionBadgeText(state.llmConnectionStatus)}
            </span>
          </div>
          <div style={styles.passwordField}>
            <input
              id="llm-api-key-input"
              type={showLlmApiKey ? "text" : "password"}
              value={state.llmApiKey}
              onChange={handleLlmApiKeyChange}
              placeholder="Enter OpenAI-compatible LLM API key"
              style={{ ...styles.input, paddingRight: "42px" }}
            />
            <button
              type="button"
              aria-label={showLlmApiKey ? "Hide LLM API Key" : "Show LLM API Key"}
              title={showLlmApiKey ? "Hide LLM API Key" : "Show LLM API Key"}
              onClick={() => setShowLlmApiKey((value) => !value)}
              style={styles.passwordToggle}
            >
              <EyeIcon crossed={showLlmApiKey} />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleTestLlmConnection}
          disabled={!state.llmEnabled}
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            whiteSpace: "nowrap",
            opacity: state.llmEnabled ? 1 : 0.6,
            cursor: state.llmEnabled ? "pointer" : "not-allowed",
          }}
        >
          Test LLM Key
        </button>
        <label
          htmlFor="llm-enabled-input"
          style={{
            ...styles.row,
            marginBottom: "8px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <input
            id="llm-enabled-input"
            type="checkbox"
            checked={state.llmEnabled}
            onChange={handleLlmEnabledChange}
          />
          Enable LLM Polish
        </label>
      </div>

      <div style={{ ...styles.row, marginTop: "12px" }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="asr-base-url-input" style={styles.label}>
            ASR Base URL
          </label>
          <input
            id="asr-base-url-input"
            type="text"
            value={state.asrBaseUrl}
            onChange={handleAsrBaseUrlChange}
            placeholder="https://token-plan-cn.xiaomimimo.com/v1"
            style={styles.input}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="asr-model-input" style={styles.label}>
            ASR Model
          </label>
          <input
            id="asr-model-input"
            type="text"
            value={state.asrModel}
            onChange={handleAsrModelChange}
            placeholder="mimo-v2.5-asr"
            style={styles.input}
          />
        </div>
      </div>

      <div style={styles.row}>
        <div style={{ flex: 1 }}>
          <label htmlFor="llm-base-url-input" style={styles.label}>
            LLM Base URL
          </label>
          <input
            id="llm-base-url-input"
            type="text"
            value={state.llmBaseUrl}
            onChange={handleLlmBaseUrlChange}
            placeholder="https://api.openai.com/v1"
            style={styles.input}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="llm-model-input" style={styles.label}>
            LLM Model
          </label>
          <input
            id="llm-model-input"
            type="text"
            value={state.llmModel}
            onChange={handleLlmModelChange}
            placeholder="gpt-4o-mini"
            style={styles.input}
          />
        </div>
      </div>

      <div style={{ ...styles.row, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleSaveApiKey}
          style={{
            ...styles.button,
            ...styles.buttonSecondary,
            whiteSpace: "nowrap",
          }}
        >
          Save API Settings
        </button>
      </div>

      <div style={{ ...styles.row, marginTop: "12px", alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="hotkey-input" style={styles.label}>
            Global Hotkey
          </label>
          <input
            id="hotkey-input"
            type="text"
            value={state.hotkey}
            readOnly
            onFocus={() => {
              isCapturingHotkeyRef.current = true;
            }}
            onBlur={() => {
              isCapturingHotkeyRef.current = false;
            }}
            onKeyDown={handleHotkeyKeyDown}
            placeholder="Alt+="
            style={styles.input}
          />
        </div>
        <button
          type="button"
          onClick={handleSaveHotkey}
          style={{
            ...styles.button,
            ...styles.buttonSecondary,
            whiteSpace: "nowrap",
            marginBottom: "1px",
          }}
        >
          Save Hotkey
        </button>
      </div>
    </div>
  );

  const renderMicrophoneSection = () => (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>Microphone Test</h2>
      <div style={styles.row}>
        {state.isProcessing ? (
          <button
            type="button"
            disabled
            style={{
              ...styles.button,
              ...styles.buttonSecondary,
              cursor: "not-allowed",
              opacity: 0.7,
            }}
          >
            Processing...
          </button>
        ) : state.isRecording ? (
          <button
            type="button"
            onClick={handleStopRecording}
            style={{ ...styles.button, ...styles.buttonDanger }}
          >
            Stop Recording
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStartRecording}
            style={{ ...styles.button, ...styles.buttonPrimary }}
          >
            Start Recording
          </button>
        )}
        <button
          type="button"
          onClick={handleTestMicrophone}
          disabled={state.isRecording || state.isProcessing}
          style={{ ...styles.button, ...styles.buttonSecondary, marginLeft: "8px" }}
        >
          Quick Test (2s)
        </button>
      </div>
      <div style={styles.row}>
        <span style={{ fontWeight: 500, minWidth: "100px" }}>Level:</span>
        <div
          data-testid="mic-level-bar"
          style={{
            flex: 1,
            height: "8px",
            background: "#e0e0e0",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.round(state.micLevel * 100)}%`,
              height: "100%",
              background: state.isRecording ? "#ff4444" : "#44aa44",
              borderRadius: "4px",
              transition: "width 0.1s ease",
            }}
          />
        </div>
      </div>
      {state.isRecording && (
        <p style={{ color: "#ff4444", marginTop: "8px", fontSize: "13px" }}>
          Recording... Press Stop or hotkey to finish.
        </p>
      )}
      {state.isProcessing && (
        <p style={{ color: "#666", marginTop: "8px", fontSize: "13px" }}>
          Processing dictation...
        </p>
      )}
    </div>
  );

  const renderPromptsSection = () => (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>Prompt Management</h2>
      {state.prompts.length === 0 ? (
        <p style={styles.textMuted}>No prompts configured.</p>
      ) : (
        <ul style={styles.list}>
          {state.prompts.map((p: Prompt) => (
            <li key={p.id} style={styles.listItem}>
              <span>{p.name}</span>
              {p.is_active && (
                <span style={{ ...styles.badge, ...styles.badgeSuccess }}>
                  Active
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderDictionarySection = () => (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>Dictionary Management</h2>
      {state.dictionary.length === 0 ? (
        <p style={styles.textMuted}>No dictionary entries.</p>
      ) : (
        <ul style={styles.list}>
          {state.dictionary.map((e: DictionaryEntry) => (
            <li key={e.id} style={styles.listItem}>
              <span>{e.canonical_term}</span>
              {e.category && (
                <span style={styles.textMuted}>{e.category}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderHistorySection = () => (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>History</h2>
      {state.history.length === 0 ? (
        <p style={styles.textMuted}>No sessions yet.</p>
      ) : (
        <ul style={styles.list}>
          {state.history.map((h: HistorySession) => (
            <li key={h.id} style={styles.listItem}>
              <div>
                <div style={{ fontWeight: 500 }}>{h.session_id}</div>
                {h.raw_text && (
                  <div style={styles.textMuted}>
                    {h.raw_text.length > 60
                      ? h.raw_text.slice(0, 60) + "…"
                      : h.raw_text}
                  </div>
                )}
              </div>
              <span style={statusBadgeStyle(h.status)}>{h.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const [hotkey, setHotkey] = useState<string | null>(null);

  useEffect(() => {
    getVoiceAPI()
      .getHotkey()
      .then((k) => setHotkey(k))
      .catch(() => setHotkey(null));
  }, []);

  const renderDiagnosticsSection = () => {
    const config = state.backendConfig;
    return (
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Diagnostics</h2>
        {config ? (
          <>
            <div style={styles.row}>
              <span style={{ fontWeight: 500, minWidth: "100px" }}>
                Backend URL:
              </span>
              <span style={{ fontFamily: "monospace", fontSize: "13px" }}>
                {config.url}
              </span>
            </div>
            <div style={styles.row}>
              <span style={{ fontWeight: 500, minWidth: "100px" }}>
                Token:
              </span>
              <span style={styles.maskedToken}>{maskToken(config.token)}</span>
            </div>
          </>
        ) : (
          <p style={styles.textMuted}>No backend configuration available.</p>
        )}
        <div style={styles.row}>
          <span style={{ fontWeight: 500, minWidth: "100px" }}>Hotkey:</span>
          <span>{hotkey ?? "Not registered"}</span>
        </div>
        <div style={{ marginTop: "12px" }}>
          <button
            type="button"
            onClick={handleOpenLogs}
            style={{ ...styles.button, ...styles.buttonSecondary }}
          >
            Open Logs
          </button>
        </div>
      </div>
    );
  };

  // ---- Main render -------------------------------------------------------
  if (state.loading) {
    return (
      <div style={styles.container}>
        <p style={styles.textMuted}>Loading configuration…</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Settings</h1>

      {state.error && (
        <div style={{ ...styles.section, background: "#fff5f5" }}>
          <p style={styles.error}>{state.error}</p>
        </div>
      )}

      {state.dictationError && (
        <div style={{ ...styles.section, background: "#fff5f5" }}>
          <p style={{ ...styles.error, fontWeight: 600 }}>
            {state.dictationError.error_type
              ? `Failed at stage: ${state.dictationError.error_type}`
              : "Dictation failed"}
          </p>
          <p style={styles.error}>{state.dictationError.message}</p>
          {state.dictationError.raw_text && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                ASR result:
              </p>
              <p style={{ fontSize: "13px", color: "#333", fontFamily: "monospace", background: "#fff", padding: "8px", borderRadius: "4px" }}>
                {state.dictationError.raw_text}
              </p>
            </div>
          )}
          {state.dictationError.polished_text && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                Polished result:
              </p>
              <p style={{ fontSize: "13px", color: "#333", fontFamily: "monospace", background: "#fff", padding: "8px", borderRadius: "4px" }}>
                {state.dictationError.polished_text}
              </p>
            </div>
          )}
        </div>
      )}

      {renderApiConfigSection()}
      {renderMicrophoneSection()}
      {renderPromptsSection()}
      {renderDictionarySection()}
      {renderHistorySection()}
      {renderDiagnosticsSection()}

      {state.toast && (
        <div
          style={{
            ...styles.toast,
            ...(state.toast ? styles.toastVisible : styles.toastHidden),
          }}
        >
          {state.toast}
        </div>
      )}
    </div>
  );
}

export default SettingsWindow;
