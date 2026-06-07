export type DictationStatus =
  | { phase: "idle" }
  | { phase: "recording" }
  | { phase: "transcribing" }
  | { phase: "polishing" }
  | { phase: "completed"; raw_text?: string; polished_text?: string; injection_method?: string }
  | { phase: "failed"; error: string; error_type?: string };

export interface VoiceAPIEventMap {
  statusUpdate: (status: DictationStatus) => void;
  microphoneLevel: (level: number) => void;
  silenceCountdown: (remainingMs: number) => void;
}

export interface DictationResult {
  status: string;
  raw_text?: string;
  polished_text?: string;
  error?: string;
  error_type?: string;
  session_id?: string;
}

export interface VoiceAPI {
  getBackendConfig: () => Promise<{ url: string; token: string } | null>;
  startDictation: () => Promise<void>;
  stopDictation: () => Promise<DictationResult | null>;
  showOverlay: () => void;
  hideOverlay: () => void;
  onStatusUpdate: (cb: (status: DictationStatus) => void) => () => void;
  onMicrophoneLevel: (cb: (level: number) => void) => () => void;
  onToggleDictation: (cb: () => void) => () => void;
  onPartialTranscript?: (cb: (text: string) => void) => () => void;
  getHotkey: () => Promise<string | null>;
  setHotkey: (hotkey: string) => Promise<string | null>;
  revealFile: (filePath: string) => Promise<void>;
  copyToClipboard: (text: string) => Promise<boolean>;

  /** Theme management API. */
  theme?: {
    get: () => Promise<string>;
    set: (theme: string) => Promise<boolean>;
    onChange: (callback: (theme: string) => void) => () => void;
  };
}

declare global {
  interface Window {
    voiceAPI?: VoiceAPI;
  }
}
