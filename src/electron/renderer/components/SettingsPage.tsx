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
  const { setTheme } = useTheme();
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
            background: "var(--card)",
            color: "var(--foreground)",
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

export function SettingsPage({
  backendConfig,
  onToast,
  onHotkeyChange,
  onRerunOnboarding,
}: SettingsPageProps): JSX.Element {
  const { t, language, setLanguage } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto p-8 flex flex-col gap-6">
      <h1 className="font-display text-[28px] font-semibold text-dark-900 m-0">
        {t("settings_title")}
      </h1>

      {/* Language Selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium text-dark-700">{t("language")}</span>
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
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="zh">{t("lang_zh")}</option>
          <option value="en">{t("lang_en")}</option>
        </select>
        {onRerunOnboarding && (
          <button
            type="button"
            onClick={onRerunOnboarding}
            className="ml-auto text-xs text-brand-600 hover:text-brand-800 transition-colors"
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
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("theme_pref_hint")}
          </p>
          <ThemeSelector />
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
