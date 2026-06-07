/**
 * TypeScript interface for the voiceAPI exposed by the preload script
 * via contextBridge.exposeInMainWorld.
 */
export interface VoiceAPI {
  /** Returns the backend URL and auth token, or null if not running. */
  getBackendConfig: () => Promise<{ url: string; token: string } | null>;

  /** Requests the backend to start dictation. */
  startDictation: () => Promise<void>;

  /** Requests the backend to stop dictation. Returns the result or null on error. */
  stopDictation: () => Promise<{
    status: string;
    raw_text?: string;
    polished_text?: string;
    error?: string;
    error_type?: string;
  } | null>;

  /** Makes the overlay window visible. */
  showOverlay: () => void;

  /** Hides the overlay window. */
  hideOverlay: () => void;

  /**
   * Subscribes to status updates from the backend.
   * Returns a cleanup function to unsubscribe.
   */
  onStatusUpdate: (callback: (status: unknown) => void) => () => void;

  /**
   * Subscribes to microphone level events.
   * Returns a cleanup function to unsubscribe.
   */
  onMicrophoneLevel: (callback: (level: number) => void) => () => void;

  /**
   * Subscribes to toggle-dictation hotkey events from the main process.
   * Returns a cleanup function to unsubscribe.
   */
  onToggleDictation: (callback: () => void) => () => void;

  /** Returns the currently registered global hotkey, or null. */
  getHotkey: () => Promise<string | null>;

  /**
   * Changes the global hotkey to the given accelerator string.
   * Returns the actually registered key (may differ on failure).
   */
  setHotkey: (hotkey: string) => Promise<string | null>;

  /** Reveals the given file in the system file manager (selects it). */
  revealFile: (filePath: string) => Promise<void>;

  /** Theme management API. */
  theme: {
    /** Returns the persisted theme ("light", "dark", or "system"). */
    get: () => Promise<string>;
    /** Persists the theme and broadcasts to all windows. */
    set: (theme: string) => Promise<boolean>;
    /** Subscribe to theme changes from other windows. Returns cleanup fn. */
    onChange: (callback: (theme: string) => void) => () => void;
  };
}
