const { contextBridge, ipcRenderer } = require("electron");

/**
 * API surface exposed to the renderer process via contextBridge.
 *
 * All calls are proxied through the main process to enforce
 * context isolation and prevent direct Node/Electron access.
 *
 * For the TypeScript interface see ./types.ts
 */

const api = {
  getBackendConfig: () =>
    ipcRenderer.invoke("get-backend-config"),

  startDictation: () =>
    ipcRenderer.invoke("start-dictation"),

  stopDictation: () =>
    ipcRenderer.invoke("stop-dictation") as Promise<{
      status: string;
      raw_text?: string;
      polished_text?: string;
      error?: string;
      error_type?: string;
    } | null>,

  showOverlay: () => {
    ipcRenderer.send("show-overlay");
  },

  hideOverlay: () => {
    ipcRenderer.send("hide-overlay");
  },

  onStatusUpdate: (callback: (status: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) => {
      callback(status);
    };
    ipcRenderer.on("status-update", handler);
    return () => {
      ipcRenderer.removeListener("status-update", handler);
    };
  },

  onMicrophoneLevel: (callback: (level: number) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      level: number
    ) => {
      callback(level);
    };
    ipcRenderer.on("microphone-level", handler);
    return () => {
      ipcRenderer.removeListener("microphone-level", handler);
    };
  },

  onPartialTranscript: (callback: (text: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, text: string) => {
      callback(text);
    };
    ipcRenderer.on("partial-transcript", handler);
    return () => {
      ipcRenderer.removeListener("partial-transcript", handler);
    };
  },

  onToggleDictation: (callback: () => void) => {
    const handler = (_event: Electron.IpcRendererEvent) => {
      callback();
    };
    ipcRenderer.on("toggle-dictation", handler);
    return () => {
      ipcRenderer.removeListener("toggle-dictation", handler);
    };
  },

  getHotkey: () => ipcRenderer.invoke("get-hotkey"),

  setHotkey: (hotkey: string) => ipcRenderer.invoke("set-hotkey", hotkey),

  revealFile: (filePath: string) => ipcRenderer.invoke("reveal-file", filePath),

  copyToClipboard: (text: string) =>
    ipcRenderer.invoke("copy-to-clipboard", text),
};

contextBridge.exposeInMainWorld("voiceAPI", api);
