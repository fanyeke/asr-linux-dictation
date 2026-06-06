import { useTranslation } from "../lib/i18n.js";
import type { BackendConfig } from "../settings/types.js";
import { ApiConfigSection } from "./settings/ApiConfigSection.js";
import { HotkeySection } from "./settings/HotkeySection.js";
import { PromptManager } from "./settings/PromptManager.js";
import { DictionaryManager } from "./settings/DictionaryManager.js";
import { DiagnosticsSection } from "./settings/DiagnosticsSection.js";
import { VadSection } from "./settings/VadSection.js";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SettingsPageProps {
  backendConfig: BackendConfig | null;
  onToast: (msg: string, durationMs?: number) => void;
  onHotkeyChange: (hotkey: string) => void;
  onRerunOnboarding?: () => void;
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

      <DiagnosticsSection
        backendConfig={backendConfig}
        onToast={onToast}
        t={t}
      />
    </div>
  );
}

export default SettingsPage;
