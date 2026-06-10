/**
 * ThemeProvider — React context provider for the theme system.
 *
 * Manages light/dark/system theme toggling + accent color selection
 * with CSS variable transitions, localStorage persistence, and backend sync.
 *
 * Usage:
 *   <ThemeProvider>
 *     <App />
 *   </ThemeProvider>
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { VoiceAPI } from "../overlay/types.js";

export type Theme = "light" | "dark" | "system";
export type Accent = "indigo" | "rose" | "emerald" | "amber" | "violet";

export interface ThemeProviderProps {
  children: ReactNode;
  /** Fallback theme if no stored preference is found. Defaults to "light". */
  defaultTheme?: Theme;
  /** Fallback accent if no stored preference is found. Defaults to "indigo". */
  defaultAccent?: Accent;
  /** localStorage key for theme persistence. Defaults to "asr-linux-theme". */
  storageKey?: string;
  /** localStorage key for accent persistence. Defaults to "asr-linux-accent". */
  accentStorageKey?: string;
}

export interface ThemeProviderState {
  /** The user's raw preference ("light" | "dark" | "system"). */
  theme: Theme;
  /** The resolved theme (always "light" or "dark", never "system"). */
  resolvedTheme: "light" | "dark";
  /** The accent color. */
  accent: Accent;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
);

/** Access the voiceAPI theme methods, with fallback for environments without IPC. */
function getThemeAPI() {
  return (window as unknown as { voiceAPI?: VoiceAPI }).voiceAPI?.theme ?? null;
}

function getFromStorage<T>(key: string, fallback: T, validValues: readonly T[]): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored && validValues.includes(stored as T)) {
      return stored as T;
    }
  } catch {
    // localStorage may not be available
  }
  return fallback;
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

function applyThemeClass(resolved: "light" | "dark") {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function applyAccent(accent: Accent) {
  document.documentElement.setAttribute("data-accent", accent);
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  defaultAccent = "indigo",
  storageKey = "asr-linux-theme",
  accentStorageKey = "asr-linux-accent",
}: ThemeProviderProps): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(() =>
    getFromStorage(storageKey, defaultTheme, ["light", "dark", "system"] as const),
  );
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolveTheme(theme),
  );
  const [accent, setAccentState] = useState<Accent>(() =>
    getFromStorage(accentStorageKey, defaultAccent, ["indigo", "rose", "emerald", "amber", "violet"] as const),
  );

  // On mount, load theme from backend via IPC (overrides localStorage)
  useEffect(() => {
    const api = getThemeAPI();
    if (!api) return;
    let cancelled = false;

    api.get().then((backendTheme: string) => {
      if (cancelled) return;
      if (backendTheme === "light" || backendTheme === "dark" || backendTheme === "system") {
        setThemeState(backendTheme);
        setResolvedTheme(resolveTheme(backendTheme));
        try {
          localStorage.setItem(storageKey, backendTheme);
        } catch {
          // ignore
        }
      }
    }).catch(() => {
      // IPC not available, fall back to localStorage
    });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  // Listen for theme changes broadcast from other windows
  useEffect(() => {
    const api = getThemeAPI();
    if (!api?.onChange) return;
    const unsub = api.onChange((newTheme: string) => {
      if (newTheme === "light" || newTheme === "dark" || newTheme === "system") {
        setThemeState(newTheme);
        setResolvedTheme(resolveTheme(newTheme));
        try {
          localStorage.setItem(storageKey, newTheme);
        } catch {
          // ignore
        }
      }
    });
    return unsub;
  }, [storageKey]);

  // Apply theme class whenever resolved theme changes
  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  // Apply accent whenever it changes
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  // Re-resolve when system preference changes (only when theme === "system")
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      setResolvedTheme(resolveTheme("system"));
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // ── Reduced motion support ─────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;

    const updateAttribute = () => {
      if (mq.matches) {
        root.setAttribute("data-reduced-motion", "true");
      } else {
        root.removeAttribute("data-reduced-motion");
      }
    };

    updateAttribute();
    mq.addEventListener("change", updateAttribute);
    return () => mq.removeEventListener("change", updateAttribute);
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      setResolvedTheme(resolveTheme(newTheme));
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {
        // ignore storage errors
      }
      // Persist to backend via IPC
      const api = getThemeAPI();
      if (api?.set) {
        api.set(newTheme).catch(() => {
          // backend sync failure is non-critical
        });
      }
    },
    [storageKey],
  );

  const setAccent = useCallback(
    (newAccent: Accent) => {
      setAccentState(newAccent);
      try {
        localStorage.setItem(accentStorageKey, newAccent);
      } catch {
        // ignore storage errors
      }
    },
    [accentStorageKey],
  );

  return (
    <ThemeProviderContext.Provider
      value={{ theme, resolvedTheme, accent, setTheme, setAccent }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme(): ThemeProviderState {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
