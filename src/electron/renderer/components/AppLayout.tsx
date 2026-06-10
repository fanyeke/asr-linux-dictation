import { type ReactNode } from "react";
import { useTranslation } from "../lib/i18n.js";
import { useTheme } from "./ThemeProvider.js";
import { Sun, Moon, Monitor, Globe, Mic } from "lucide-react";
import { cn } from "../lib/utils.js";
import type { TabId } from "../settings/types.js";
import { TabSidebar } from "./TabSidebar.js";

interface AppLayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: ReactNode;
  pageTitle: string;
  rightActions?: ReactNode;
}

function ThemeToggle(): JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150",
        "hover:bg-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/40",
      )}
      title={resolvedTheme === "dark" ? "Switch to light" : "Switch to dark"}
    >
      {resolvedTheme === "dark" ? (
        <Sun size={16} style={{ color: "var(--foreground)" }} />
      ) : (
        <Moon size={16} style={{ color: "var(--foreground)" }} />
      )}
    </button>
  );
}

export function AppLayout({
  activeTab,
  onTabChange,
  children,
  pageTitle,
  rightActions,
}: AppLayoutProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className="flex h-screen"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: "14px",
        color: "var(--foreground)",
        background: "var(--background)",
      }}
    >
      <TabSidebar activeTab={activeTab} onTabChange={onTabChange} />

      <div className="flex flex-col flex-1 min-w-0" style={{ background: "var(--background)" }}>
        {/* Header */}
        <header
          className="hidden sm:flex items-center justify-between h-14 px-6 border-b flex-shrink-0"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            {pageTitle}
          </h1>

          <div className="flex items-center gap-2">
            {rightActions}
            <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />
            <ThemeToggle />
          </div>
        </header>

        {/* Main content */}
        <main
          className="flex-1 overflow-auto pb-20 sm:pb-0"
          style={{ background: "var(--background)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
