import { useTranslation } from "../lib/i18n.js";
import type { BackendConfig } from "../settings/types.js";
import { ApiConfigSection } from "./settings/ApiConfigSection.js";
import { HotkeySection } from "./settings/HotkeySection.js";
import { PromptManager } from "./settings/PromptManager.js";
import { DictionaryManager } from "./settings/DictionaryManager.js";
import { DiagnosticsSection } from "./settings/DiagnosticsSection.js";
import { ProfileManager } from "./settings/ProfileManager.js";
import { VadSection } from "./settings/VadSection.js";
import { useTheme } from "./ThemeProvider.js";
import { cn } from "../lib/utils.js";
import { Sun, Moon, Monitor } from "lucide-react";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SettingsPageProps {
  backendConfig: BackendConfig | null;
  onToast: (msg: string, durationMs?: number) => void;
  onHotkeyChange: (hotkey: string) => void;
  onRerunOnboarding?: () => void;
}

function ThemeSelector(): JSX.Element {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const themeOptions = [
    { value: "light" as const, icon: Sun, label: "theme_light" },
    { value: "dark" as const, icon: Moon, label: "theme_dark" },
    { value: "system" as const, icon: Monitor, label: "theme_system" },
  ];

  return (
    <div className="flex gap-1 p-1 rounded-lg bg-[var(--muted)]" role="radiogroup" aria-label="Theme">
      {themeOptions.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          onClick={() => setTheme(value)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all duration-150",
            "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-1",
          )}
          style={{
            background: theme === value ? "var(--primary)" : "var(--card)",
            color: theme === value ? "var(--primary-foreground)" : "var(--foreground)",
          }}
          data-testid={`theme-option-${value}`}
        >
          <Icon size={16} />
          <span className="text-xs font-medium">{t(label)}</span>
        </button>
      ))}
    </div>
  );
}

const ACCENT_COLORS: { value: string; label: string; color: string }[] = [
  { value: "indigo", label: "accent_indigo", color: "#6366f1" },
  { value: "rose", label: "accent_rose", color: "#f43f5e" },
  { value: "emerald", label: "accent_emerald", color: "#10b981" },
  { value: "amber", label: "accent_amber", color: "#f59e0b" },
  { value: "violet", label: "accent_violet", color: "#8b5cf6" },
];

function AccentSelector(): JSX.Element {
  const { accent, setAccent } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Accent Color">
      {ACCENT_COLORS.map(({ value, label, color }) => (
        <button
          key={value}
          type="button"
          role="radio"
          onClick={() => setAccent(value as "indigo" | "rose" | "emerald" | "amber" | "violet")}
          className={cn(
            "w-8 h-8 rounded-full transition-all duration-150 flex items-center justify-center",
            "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--ring)]",
            accent === value ? "ring-2 ring-offset-2" : "hover:scale-110",
          )}
          style={{
            background: color,
            ...(accent === value ? { boxShadow: `0 0 0 2px var(--background), 0 0 0 4px ${color}` } : {}),
          }}
          title={t(label)}
          data-testid={`accent-option-${value}`}
        >
          {accent === value && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

export function SettingsPage({
  backendConfig,
  onToast,
  onHotkeyChange,
  onRerunOnboarding,
}: SettingsPageProps): JSX.Element {
  const { t, language, setLanguage } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto p-8 flex flex-col gap-6">
      {/* Language Selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium text-[var(--muted-foreground)]">{t("language")}</span>
        <select
          value={language}
          onChange={(e) => {
            const lang = e.target.value as "zh" | "en";
            setLanguage(lang);
            if (backendConfig) {
              fetch(`${backendConfig.url}/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-token": backendConfig.token },
                body: JSON.stringify({ ui_language: lang }),
              }).catch(() => {});
            }
          }}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-1.5 text-sm"
        >
          <option value="zh">{t("lang_zh")}</option>
          <option value="en">{t("lang_en")}</option>
        </select>
        {onRerunOnboarding && (
          <button
            type="button"
            onClick={onRerunOnboarding}
            className="ml-auto text-xs text-[var(--brand-600)] hover:text-[var(--brand-700)] transition-colors"
          >
            {t("onboarding_rerun")}
          </button>
        )}
      </div>

      {/* Theme Selection */}
      <div className="p-5 rounded-lg border border-[var(--border)]" style={{ background: "var(--card)" }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
          {t("appearance")}
        </h2>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("theme_pref_hint")}
          </p>
          <ThemeSelector />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("accent_color")}
          </p>
          <AccentSelector />
        </div>
        {/* Theme preview card */}
        <div
          className="mt-4 p-3 rounded-md flex items-center gap-3"
          style={{ background: "var(--background)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)", fontSize: 14 }}
          >
            A
          </div>
          <div className="flex-1">
            <div className="h-2 w-24 rounded-sm mb-1.5" style={{ background: "var(--foreground)", opacity: 0.7 }} />
            <div className="h-2 w-16 rounded-sm" style={{ background: "var(--muted-foreground)", opacity: 0.5 }} />
          </div>
          <div className="w-6 h-4 rounded-sm" style={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        </div>
      </div>

      <ApiConfigSection
        backendConfig={backendConfig}
        onToast={onToast}
        t={t}
      />

      <HotkeySection
        backendConfig={backendConfig}
        onToast={onToast}
        onHotkeyChange={onHotkeyChange}
        t={t}
      />

      <VadSection
        backendConfig={backendConfig}
        onToast={onToast}
        t={t}
      />

      <PromptManager
        backendConfig={backendConfig}
        onToast={onToast}
        t={t}
      />

      <DictionaryManager
        backendConfig={backendConfig}
        onToast={onToast}
        t={t}
      />

      <ProfileManager
        backendConfig={backendConfig}
        onToast={onToast}
        t={t}
      />

      <DiagnosticsSection
        backendConfig={backendConfig}
        onToast={onToast}
        t={t}
      />
    </div>
  );
}

export default SettingsPage;
