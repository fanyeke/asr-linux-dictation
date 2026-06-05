/** Shared types for the Settings window. */

export interface Prompt {
  id: number;
  name: string;
  template: string;
  is_active: boolean;
}

export interface DictionaryEntry {
  id: number;
  canonical_term: string;
  pronunciation: string | null;
  aliases: string | null;
  notes: string | null;
  category: string | null;
  enforcement_level: string;
}

export interface HistorySession {
  id: number;
  session_id: string;
  raw_text: string | null;
  polished_text: string | null;
  status: string;
  timing_ms: number | null;
  prompt_id: number | null;
  error_type: string | null;
  failed_audio_path: string | null;
  created_at: string | null;
}

export interface BackendConfig {
  url: string;
  token: string;
}

export type ConnectionStatus = "unknown" | "connected" | "failed";

export interface DictationErrorInfo {
  message: string;
  error_type?: string;
  raw_text?: string;
  polished_text?: string;
  phase?: string;
}

export interface UserConfig {
  asrApiKey: string;
  asrBaseUrl: string;
  asrModel: string;
  llmApiKey: string;
  llmEnabled: boolean;
  llmBaseUrl: string;
  llmModel: string;
  hotkey: string;
}

/** Result returned after a completed dictation session. */
export interface DictationResultData {
  rawText: string;
  polishedText: string | null;
  status: string;
  timingMs: number | null;
  errorType: string | null;
}

/** Active pipeline phase for the UI indicator. */
export type PipelinePhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "polishing"
  | "completed"
  | "failed";

/** Tab identifiers for the main navigation. */
export type TabId = "dashboard" | "dictate" | "history" | "settings";

export interface AppState {
  asrApiKey: string;
  asrBaseUrl: string;
  asrModel: string;
  llmApiKey: string;
  llmEnabled: boolean;
  llmBaseUrl: string;
  llmModel: string;
  hotkey: string;
  connectionStatus: ConnectionStatus;
  llmConnectionStatus: ConnectionStatus;
  isRecording: boolean;
  isProcessing: boolean;
  micLevel: number;
  prompts: Prompt[];
  dictionary: DictionaryEntry[];
  history: HistorySession[];
  backendConfig: BackendConfig | null;
  loading: boolean;
  error: string | null;
  dictationError: DictationErrorInfo | null;
  toast: string | null;
}
