/**
 * ThemeManager — Main-process theme persistence via backend HTTP API.
 *
 * On startup, fetches the persisted theme from the backend and caches it.
 * Provides IPC handlers for renderer processes to get/set the theme.
 * Broadcasts theme changes to all renderer windows.
 */
import { BrowserWindow, ipcMain } from "electron";

export class ThemeManager {
  private _theme: string = "light";
  private _backendUrl: string | null = null;
  private _token: string | null = null;

  /** Initialise with backend connection info. */
  init(backendUrl: string, token: string): void {
    this._backendUrl = backendUrl;
    this._token = token;
  }

  /** Load persisted theme from the backend. Returns the theme string. */
  async load(): Promise<string> {
    if (!this._backendUrl || !this._token) return "light";
    try {
      const res = await fetch(`${this._backendUrl}/config`, {
        headers: { "x-token": this._token },
      });
      if (res.ok) {
        const data = (await res.json()) as { theme?: string };
        if (data.theme && ["light", "dark", "system"].includes(data.theme)) {
          this._theme = data.theme;
        }
      }
    } catch (err) {
      console.error("Failed to load theme from backend:", err);
    }
    return this._theme;
  }

  /** Get the current cached theme. */
  get(): string {
    return this._theme;
  }

  /** Save theme to the backend and broadcast the change. */
  async set(theme: string, senderWindow?: BrowserWindow): Promise<boolean> {
    if (!["light", "dark", "system"].includes(theme)) {
      console.error(`Invalid theme: ${theme}`);
      return false;
    }
    this._theme = theme;

    // Persist to backend
    if (this._backendUrl && this._token) {
      try {
        await fetch(`${this._backendUrl}/config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-token": this._token,
          },
          body: JSON.stringify({ theme }),
        });
      } catch (err) {
        console.error("Failed to persist theme to backend:", err);
      }
    }

    // Broadcast to all renderer windows (except the sender)
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (win !== senderWindow && !win.isDestroyed()) {
        win.webContents.send("theme:changed", theme);
      }
    }
    return true;
  }

  /** Register IPC handlers for renderer communication. */
  registerIpcHandlers(): void {
    ipcMain.handle("theme:get", async () => {
      return this._theme;
    });

    ipcMain.handle("theme:set", async (event, theme: string) => {
      const senderWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      return this.set(theme, senderWindow);
    });
  }
}

/** Singleton instance. */
export const themeManager = new ThemeManager();
