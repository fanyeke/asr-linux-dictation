import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
} from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { BackendSupervisor } from "./backend-supervisor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supervisor = new BackendSupervisor();

let settingsWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

/** Interval handle for polling microphone levels from the backend. */
let _micLevelInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Creates the main settings window (900x600).
 */
function createSettingsWindow(): void {
  const iconPath = path.join(__dirname, "../../assets/icon.png");

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadFile(
    path.join(__dirname, "../renderer/index.html")
  );

  // Close button hides to system tray instead of quitting.
  settingsWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      settingsWindow?.hide();
    }
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

/**
 * Creates the overlay window at the bottom-center of the primary display.
 *
 * The overlay is frameless, always-on-top, 400x80 pixels, positioned at the
 * bottom center of the screen.
 */
function createOverlayWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  const overlayWidth = 400;
  const overlayHeight = 80;
  const x = Math.round((screenWidth - overlayWidth) / 2);
  const y = screenHeight - overlayHeight;

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x,
    y,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile(
    path.join(__dirname, "../renderer/overlay.html")
  );

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

/**
 * Registers IPC handlers for communication with the renderer process.
 */
function registerIpcHandlers(): void {
  // Ping handler (existing baseline)
  ipcMain.handle("ping", async () => {
    return "pong";
  });

  // Return backend connection config to the renderer
  ipcMain.handle("get-backend-config", async () => {
    const info = supervisor.info;
    if (!info) return null;
    return { url: info.url, token: info.token };
  });

  ipcMain.handle("get-hotkey", async () => {
    return registeredHotkey;
  });

  ipcMain.handle("set-hotkey", async (_event, hotkey: string) => {
    if (!hotkey || typeof hotkey !== "string") {
      throw new Error("Invalid hotkey");
    }
    registerHotkey(hotkey);
    // Persist the preference via the backend
    const info = supervisor.info;
    if (info) {
      try {
        await fetch(`${info.url}/config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-token": info.token,
          },
          body: JSON.stringify({ hotkey }),
        });
      } catch (err) {
        console.error("Failed to persist hotkey:", err);
      }
    }
    return registeredHotkey;
  });

  // Proxy start-dictation request to the backend
  ipcMain.handle("start-dictation", async () => {
    const info = supervisor.info;
    if (!info) throw new Error("Backend is not running");

    const response = await fetch(`${info.url}/dictation/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-token": info.token,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Backend returned ${response.status}: ${response.statusText}`
      );
    }

    // Broadcast recording state to all renderers and show overlay
    const status = { phase: "recording" };
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send("status-update", status);
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send("status-update", status);
      overlayWindow.showInactive();
    }

    // Start polling microphone levels
    if (_micLevelInterval) {
      clearInterval(_micLevelInterval);
    }
    _micLevelInterval = setInterval(async () => {
      try {
        const levelRes = await fetch(`${info.url}/dictation/level`, {
          headers: { "x-token": info.token },
        });
        if (levelRes.ok) {
          const data = await levelRes.json() as { level: number };
          const level = data.level;
          if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.webContents.send("microphone-level", level);
          }
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send("microphone-level", level);
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 100);
  });

  // Proxy stop-dictation request to the backend
  ipcMain.handle("stop-dictation", async () => {
    const info = supervisor.info;
    if (!info) throw new Error("Backend is not running");

    // Stop polling before the request to avoid races
    if (_micLevelInterval) {
      clearInterval(_micLevelInterval);
      _micLevelInterval = null;
    }

    // Hide overlay BEFORE calling backend so the text injector sees the
    // user's originally focused window, not the overlay.
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.hide();
    }

    // Give the window manager time to return focus to the user's target
    // window before the backend starts the injection pipeline.
    // 300ms is needed because: overlay.hide() → WM refocus → target
    // window receives FocusIn → ready for xdotool keystrokes.
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Connect to backend WebSocket to receive intermediate phase updates
    // during the blocking stop-dictation call.  The backend broadcasts
    // status changes (transcribing, polishing, inserting, completed, failed)
    // over WebSocket as the pipeline progresses.
    let ws: WebSocket | null = null;
    try {
      const wsUrl = info.url.replace(/^http/, "ws") + `/ws?token=${info.token}`;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type?: string;
            session_id?: string;
            status?: string;
            raw_text?: string;
            polished_text?: string;
            error_type?: string;
          };
          if (data.type === "status_update" && data.status) {
            const phaseMap: Record<string, string> = {
              transcribing: "transcribing",
              polishing: "polishing",
              completed: "completed",
              failed: "failed",
            };
            const phase = phaseMap[data.status];
            if (phase) {
              const statusUpdate = {
                phase,
                raw_text: data.raw_text,
                polished_text: data.polished_text,
                ...(data.error_type ? { error_type: data.error_type } : {}),
              };
              if (settingsWindow && !settingsWindow.isDestroyed()) {
                settingsWindow.webContents.send("status-update", statusUpdate);
              }
              if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.webContents.send("status-update", statusUpdate);
                overlayWindow.showInactive();
              }
            }
          }
        } catch {
          // ignore malformed WS messages
        }
      };
    } catch {
      // WebSocket connection failure — fall through to non-WS path
    }

    const response = await fetch(`${info.url}/dictation/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-token": info.token,
      },
    });

    // Close the WebSocket after the stop call completes
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }

    if (!response.ok) {
      const errMsg = `Backend returned ${response.status}: ${response.statusText}`;
      const statusUpdate = { phase: "failed", error: errMsg };
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send("status-update", statusUpdate);
      }
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send("status-update", statusUpdate);
      }
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.hide();
        }
      }, 2000);
      throw new Error(errMsg);
    }

    const result = await response.json() as {
      status: string;
      raw_text?: string;
      polished_text?: string;
      error?: string;
      error_type?: string;
    };

    // Broadcast final status to all renderers (covers the case where
    // no WS events were received, e.g. polish disabled or very fast pipeline).
    const finalPhase = result.status === "completed" ? "completed" : "failed";
    const statusUpdate = {
      phase: finalPhase,
      ...(result.raw_text ? { raw_text: result.raw_text } : {}),
      ...(result.polished_text ? { polished_text: result.polished_text } : {}),
      ...(result.error ? { error: result.error, error_type: result.error_type } : {}),
    };
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send("status-update", statusUpdate);
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send("status-update", statusUpdate);
      overlayWindow.showInactive();
    }

    // Hide overlay after a short delay so user sees the final state
    setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.hide();
      }
    }, 2000);

    return result;
  });

  // Show the overlay window
  ipcMain.on("show-overlay", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      // Reset overlay to idle before showing so the user never sees the
      // previous session's completed/failed state during the brief window
      // before the next status-update arrives.
      overlayWindow.webContents.send("status-update", { phase: "idle" });
      overlayWindow.showInactive();
    }
  });

  // Hide the overlay window
  ipcMain.on("hide-overlay", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.hide();
    }
  });
}

/**
 * Creates the system tray icon with a context menu.
 *
 * The tray allows the user to show the main window or quit the app
 * when the window is hidden to the system tray.
 */
function createTray(): void {
  const trayIconPath = path.join(__dirname, "../../assets/tray-icon.png");
  const trayIcon = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.show();
          settingsWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("ASR Linux — Voice Input");
  tray.setContextMenu(contextMenu);

  // Double-click on tray icon shows the window.
  tray.on("double-click", () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.show();
      settingsWindow.focus();
    }
  });
}

/**
 * Default hotkey used when no user preference is persisted.
 * Alt+= is chosen because it is unlikely to conflict with system or
 * application shortcuts (unlike F12 which opens DevTools).
 */
const DEFAULT_HOTKEY = "Alt+=";

/**
 * Fallback candidates in case the default or user preference fails.
 */
const HOTKEY_CANDIDATES = ["Alt+=", "F12", "F10", "F9", "F11", "Ctrl+Shift+R"];

/**
 * The hotkey that was successfully registered, or null.
 */
let registeredHotkey: string | null = null;

/**
 * Unregisters the current hotkey (if any) and registers a new one.
 * Falls back through HOTKEY_CANDIDATES if the requested key fails.
 */
function registerHotkey(preferredKey?: string): void {
  // Unregister previous hotkey before registering a new one
  if (registeredHotkey) {
    globalShortcut.unregister(registeredHotkey);
    console.log(`Unregistered previous hotkey: ${registeredHotkey}`);
  }

  const candidates = preferredKey
    ? [preferredKey, ...HOTKEY_CANDIDATES.filter((k) => k !== preferredKey)]
    : HOTKEY_CANDIDATES;

  for (const key of candidates) {
    const registered = globalShortcut.register(key, () => {
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send("toggle-dictation");
      }
    });

    if (registered) {
      registeredHotkey = key;
      console.log(`Global hotkey registered: ${key}`);
      return;
    }
  }

  registeredHotkey = null;
  console.warn(
    "Failed to register any global hotkey. " +
      "Tried: " + candidates.join(", ")
  );
}

app.whenReady().then(async () => {
  // Start the backend process
  let info: { url: string; token: string; pid: number } | null = null;
  try {
    info = await supervisor.start();
    console.log(`Backend started at ${info.url} (pid: ${info.pid})`);
  } catch (err) {
    console.error("Failed to start backend:", err);
  }

  registerIpcHandlers();
  createSettingsWindow();
  createOverlayWindow();
  createTray();

  // Load persisted hotkey preference from the backend, default to Alt+=
  let preferredHotkey = DEFAULT_HOTKEY;
  if (info) {
    try {
      const res = await fetch(`${info.url}/config`, {
        headers: { "x-token": info.token },
      });
      if (res.ok) {
        const cfg = await res.json() as { hotkey?: string };
        if (cfg.hotkey) {
          preferredHotkey = cfg.hotkey;
        }
      }
    } catch (err) {
      console.error("Failed to load hotkey preference:", err);
    }
  }
  registerHotkey(preferredHotkey);

  app.on("activate", () => {
    // macOS dock click: show existing window or create a new one.
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.show();
      settingsWindow.focus();
    } else {
      createSettingsWindow();
    }
  });
});

// With a system tray, do NOT quit when all windows are hidden.
// The app keeps running in the background.
app.on("window-all-closed", () => {
  // No-op: app stays alive in the system tray.
});

app.on("will-quit", async () => {
  globalShortcut.unregisterAll();
  await supervisor.stop();
});
