/**
 * ThemeProvider — React context provider for the theme system.
 *
 * Manages light/dark/system theme toggling with CSS variable transitions,
 * localStorage persistence, and backend sync (via Electron IPC).
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

export type Theme = "light" | "dark" | "system";

export interface ThemeProviderProps {
  children: ReactNode;
  /** Fallback theme if no stored preference is found. Defaults to "light". */
  defaultTheme?: Theme;
  /** localStorage key for theme persistence. Defaults to "asr-linux-theme". */
  storageKey?: string;
}

export interface ThemeProviderState {
  /** The resolved theme (always "light" or "dark", never "system"). */
  theme: "light" | "dark";
  /** The user's raw preference. May be "system". */
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
);

function getThemeFromStorage(storageKey: string, defaultTheme: Theme): Theme {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage may not be available
  }
  return defaultTheme;
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

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "asr-linux-theme",
}: ThemeProviderProps): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(() =>
    getThemeFromStorage(storageKey, defaultTheme),
  );
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolveTheme(theme),
  );

  // Apply theme class whenever resolved theme changes
  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

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

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      setResolvedTheme(resolveTheme(newTheme));
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {
        // ignore storage errors
      }
    },
    [storageKey],
  );

  return (
    <ThemeProviderContext.Provider
      value={{ theme: resolvedTheme, resolvedTheme, setTheme }}
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
