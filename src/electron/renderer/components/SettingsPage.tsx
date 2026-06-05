import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../lib/i18n.js";
import {
  Eye,
  EyeOff,
  Sparkles,
  BookOpen,
  Download,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type {
  BackendConfig,
  ConnectionStatus,
  DictionaryEntry,
  Prompt,
} from "../settings/types.js";
import type { VoiceAPI } from "../overlay/types.js";
import { Card } from "./ui/Card.js";
import { Input } from "./ui/Input.js";
import { Button } from "./ui/Button.js";
import { Badge } from "./ui/Badge.js";
import { EmptyState } from "./ui/EmptyState.js";

function getVoiceAPI(): VoiceAPI {
  return window.voiceAPI!;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskToken(token: string): string {
  if (token.length <= 8) return "••••••••";
  return token.slice(0, 4) + "••••" + token.slice(-4);
}

function connectionBadgeText(status: ConnectionStatus, t: (key: string) => string): string {
  switch (status) {
    case "connected":
      return t("connected");
    case "failed":
      return t("disconnected");
    default:
      return t("unknown");
  }
}

function connectionBadgeVariant(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return "success" as const;
    case "failed":
      return "error" as const;
    default:
      return "neutral" as const;
  }
}

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

function normalizeAcceleratorKey(
  event: React.KeyboardEvent<HTMLInputElement>,
): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  if (event.key === " ") return "Space";
  if (event.key === "Escape") return "Esc";
  if (event.key.startsWith("Arrow"))
    return event.key.replace("Arrow", "");
  if (event.key.length === 1) return event.key.toUpperCase();
  return event.key;
}

function formatAccelerator(
  event: React.KeyboardEvent<HTMLInputElement>,
): string | null {
  const key = normalizeAcceleratorKey(event);
  if (!key) return null;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Super");
  parts.push(key);
  return parts.join("+");
}

async function readErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail) return body.detail;
    } catch {
      // fall through
    }
  }
  return response.text().catch(() => "");
}

function buildConfigPayload(state: {
  asrApiKey: string;
  asrBaseUrl: string;
  asrModel: string;
  llmApiKey: string;
  llmEnabled: boolean;
  llmBaseUrl: string;
  llmModel: string;
  hotkey: string;
}): Record<string, unknown> {
  return {
    asr_api_key: state.asrApiKey,
    asr_base_url: state.asrBaseUrl,
    asr_model: state.asrModel,
    llm_api_key: state.llmApiKey,
    llm_enabled: state.llmEnabled,
    llm_base_url: state.llmBaseUrl,
    llm_model: state.llmModel,
    hotkey: state.hotkey,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SettingsPageProps {
  backendConfig: BackendConfig | null;
  onToast: (msg: string, durationMs?: number) => void;
  onHotkeyChange: (hotkey: string) => void;
}

export function SettingsPage({
  backendConfig,
  onToast,
  onHotkeyChange,
}: SettingsPageProps): JSX.Element {
  const { t, language, setLanguage } = useTranslation();

  const [asrApiKey, setAsrApiKey] = useState("");
  const [asrBaseUrl, setAsrBaseUrl] = useState(
    "https://token-plan-cn.xiaomimimo.com/v1",
  );
  const [asrModel, setAsrModel] = useState("mimo-v2.5-asr");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmEnabled, setLlmEnabled] = useState(true);
  const [llmBaseUrl, setLlmBaseUrl] = useState("https://api.openai.com/v1");
  const [llmModel, setLlmModel] = useState("gpt-4o-mini");
  const [hotkey, setHotkey] = useState("Alt+=");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("unknown");
  const [llmConnectionStatus, setLlmConnectionStatus] =
    useState<ConnectionStatus>("unknown");
  const [showAsrApiKey, setShowAsrApiKey] = useState(false);
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeredHotkey, setRegisteredHotkey] = useState<string | null>(null);
  const isCapturingHotkeyRef = useRef(false);

  // Dictionary form state
  const [dictFormOpen, setDictFormOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [dictForm, setDictForm] = useState({
    canonical_term: "",
    pronunciation: "",
    aliases: "",
    notes: "",
    category: "",
    enforcement_level: "suggested",
  });

  // Load initial data
  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      if (!backendConfig) {
        setLoading(false);
        return;
      }
      const headers = {
        "x-token": backendConfig.token,
        "Content-Type": "application/json",
      };
      try {
        const [promptsRes, dictRes, configRes] = await Promise.all([
          fetch(`${backendConfig.url}/prompts`, { headers }),
          fetch(`${backendConfig.url}/dictionary`, { headers }),
          fetch(`${backendConfig.url}/config`, {
            headers: { "x-token": backendConfig.token },
          }),
        ]);
        if (cancelled) return;
        setPrompts(promptsRes.ok ? await promptsRes.json() : []);
        setDictionary(dictRes.ok ? await dictRes.json() : []);
        if (configRes.ok) {
          const cfg = await configRes.json();
          if (cfg.asr_api_key || cfg.api_key) {
            setAsrApiKey(cfg.asr_api_key || cfg.api_key);
          }
          if (cfg.asr_base_url) setAsrBaseUrl(cfg.asr_base_url);
          if (cfg.asr_model) setAsrModel(cfg.asr_model);
          if (cfg.llm_api_key) setLlmApiKey(cfg.llm_api_key);
          if (cfg.llm_enabled !== undefined && cfg.llm_enabled !== null) {
            setLlmEnabled(cfg.llm_enabled);
          }
          if (cfg.llm_base_url) setLlmBaseUrl(cfg.llm_base_url);
          if (cfg.llm_model) setLlmModel(cfg.llm_model);
          if (cfg.hotkey) setHotkey(cfg.hotkey);
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [backendConfig]);

  // Load registered hotkey
  useEffect(() => {
    getVoiceAPI()
      .getHotkey()
      .then((k) => setRegisteredHotkey(k))
      .catch(() => setRegisteredHotkey(null));
  }, []);

  const configState = {
    asrApiKey,
    asrBaseUrl,
    asrModel,
    llmApiKey,
    llmEnabled,
    llmBaseUrl,
    llmModel,
    hotkey,
  };

  const saveConfigToBackend = useCallback(
    async (silent: boolean = false): Promise<boolean> => {
      if (!backendConfig) return false;
      try {
        const res = await fetch(`${backendConfig.url}/config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-token": backendConfig.token,
          },
          body: JSON.stringify(buildConfigPayload(configState)),
        });
        if (res.ok) {
          if (!silent) onToast(t("config_saved"), 3000);
          return true;
        } else {
          const body = await readErrorDetail(res);
          if (!silent) onToast(`${t("config_save_failed")}: ${res.status} ${body}`, 5000);
          return false;
        }
      } catch (err) {
        if (!silent) {
          onToast(
            `${t("config_save_failed")}: ${err instanceof Error ? err.message : "network error"}`,
            5000,
          );
        }
        return false;
      }
    },
    [backendConfig, configState, onToast],
  );

  const handleSave = useCallback(async () => {
    await saveConfigToBackend(false);
  }, [saveConfigToBackend]);

  const handleTestAsr = useCallback(async () => {
    if (!backendConfig) return;
    setConnectionStatus("unknown");
    try {
      await saveConfigToBackend(true);
      const res = await fetch(`${backendConfig.url}/test-asr-key`, {
        headers: { "x-token": backendConfig.token },
      });
      if (res.ok) {
        const data = await res.json();
        setConnectionStatus("connected");
        onToast(data.message || t("asr_key_valid"), 5000);
      } else {
        setConnectionStatus("failed");
        const body = await readErrorDetail(res);
        onToast(`${t("asr_test_failed")}: ${res.status} ${body}`, 5000);
      }
    } catch {
      setConnectionStatus("failed");
    }
  }, [backendConfig, saveConfigToBackend, onToast]);

  const handleTestLlm = useCallback(async () => {
    if (!backendConfig) return;
    setLlmConnectionStatus("unknown");
    try {
      const saved = await saveConfigToBackend(true);
      if (!saved) {
        setLlmConnectionStatus("failed");
        return;
      }
      const res = await fetch(`${backendConfig.url}/test-llm-key`, {
        headers: { "x-token": backendConfig.token },
      });
      if (res.ok) {
        const data = await res.json();
        setLlmConnectionStatus("connected");
        onToast(data.message || t("llm_key_valid"), 5000);
      } else {
        setLlmConnectionStatus("failed");
        const body = await readErrorDetail(res);
        onToast(`${t("llm_test_failed")}: ${res.status} ${body}`, 5000);
      }
    } catch {
      setLlmConnectionStatus("failed");
    }
  }, [backendConfig, saveConfigToBackend, onToast]);

  const handleSaveHotkey = useCallback(async () => {
    try {
      const registered = await getVoiceAPI().setHotkey(hotkey);
      if (registered) {
        setHotkey(registered);
        setRegisteredHotkey(registered);
        onHotkeyChange(registered);
        onToast(t("hotkey_changed"), 3000);
      } else {
        onToast(t("hotkey_failed"), 3000);
      }
    } catch (err) {
      onToast(
        `Failed to set hotkey: ${err instanceof Error ? err.message : "unknown error"}`,
        3000,
      );
    }
  }, [hotkey, onToast, onHotkeyChange]);

  const handleHotkeyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();
      isCapturingHotkeyRef.current = true;
      const next = formatAccelerator(e);
      if (next) setHotkey(next);
    },
    [],
  );

  const handleLlmEnabledToggle = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.checked;
      setLlmEnabled(next);
      const payload = buildConfigPayload({ ...configState, llmEnabled: next });
      if (!backendConfig) return;
      try {
        await fetch(`${backendConfig.url}/config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-token": backendConfig.token,
          },
          body: JSON.stringify(payload),
        });
      } catch {
        // silent; user can retry with Save button
      }
    },
    [backendConfig, configState],
  );

  const handleOpenLogs = useCallback(() => {
    const home = typeof process !== "undefined" ? process.env.HOME || process.env.USERPROFILE : undefined;
    const logDir = `${home || "/tmp"}/.local/share/asr-linux/logs`;
    window.open(`file://${logDir}`, "_blank");
    onToast(`Log folder: ${logDir}`, 5000);
  }, [onToast]);

  const handleExportDiagnostics = useCallback(async () => {
    if (!backendConfig) return;
    try {
      const res = await fetch(`${backendConfig.url}/diagnostics/export`, {
        headers: {
          "x-token": backendConfig.token,
        },
      });
      if (!res.ok) {
        const body = await readErrorDetail(res);
        onToast(`${t("diagnostics_failed")}: ${res.status} ${body}`, 5000);
        return;
      }
      // Download the ZIP blob
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asr-diagnostics-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast(t("diagnostics_exported"), 3000);
    } catch (err) {
      onToast(
        `${t("diagnostics_failed")}: ${err instanceof Error ? err.message : "network error"}`,
        5000,
      );
    }
  }, [backendConfig, onToast]);

  // Dictionary CRUD handlers
  const resetDictForm = useCallback(() => {
    setDictForm({
      canonical_term: "",
      pronunciation: "",
      aliases: "",
      notes: "",
      category: "",
      enforcement_level: "suggested",
    });
    setEditingEntryId(null);
    setDictFormOpen(false);
  }, []);

  const openEditForm = useCallback((entry: DictionaryEntry) => {
    setDictForm({
      canonical_term: entry.canonical_term,
      pronunciation: entry.pronunciation || "",
      aliases: entry.aliases || "",
      notes: entry.notes || "",
      category: entry.category || "",
      enforcement_level: entry.enforcement_level,
    });
    setEditingEntryId(entry.id);
    setDictFormOpen(true);
  }, []);

  const handleDictSubmit = useCallback(async () => {
    if (!backendConfig) return;
    const payload = {
      canonical_term: dictForm.canonical_term.trim(),
      pronunciation: dictForm.pronunciation.trim() || undefined,
      aliases: dictForm.aliases.trim() || undefined,
      notes: dictForm.notes.trim() || undefined,
      category: dictForm.category.trim() || undefined,
      enforcement_level: dictForm.enforcement_level,
    };
    if (!payload.canonical_term) {
      onToast(`${t("canonical_term")} is required`, 3000);
      return;
    }
    try {
      const url = editingEntryId
        ? `${backendConfig.url}/dictionary/${editingEntryId}`
        : `${backendConfig.url}/dictionary`;
      const method = editingEntryId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-token": backendConfig.token,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onToast(
          editingEntryId ? t("entry_updated") : t("entry_created"),
          3000,
        );
        resetDictForm();
        // Refresh list
        const dictRes = await fetch(`${backendConfig.url}/dictionary`, {
          headers: { "x-token": backendConfig.token },
        });
        if (dictRes.ok) setDictionary(await dictRes.json());
      } else {
        const body = await readErrorDetail(res);
        onToast(`Failed: ${res.status} ${body}`, 5000);
      }
    } catch (err) {
      onToast(
        `Failed: ${err instanceof Error ? err.message : "network error"}`,
        5000,
      );
    }
  }, [backendConfig, dictForm, editingEntryId, onToast, resetDictForm]);

  const handleDeleteEntry = useCallback(
    async (entryId: number) => {
      if (!backendConfig) return;
      if (!window.confirm(t("confirm_delete"))) return;
      try {
        const res = await fetch(
          `${backendConfig.url}/dictionary/${entryId}`,
          {
            method: "DELETE",
            headers: { "x-token": backendConfig.token },
          },
        );
        if (res.ok) {
          onToast(t("entry_deleted"), 3000);
          setDictionary((prev) => prev.filter((e) => e.id !== entryId));
        } else {
          const body = await readErrorDetail(res);
          onToast(`Delete failed: ${res.status} ${body}`, 5000);
        }
      } catch (err) {
        onToast(
          `Delete failed: ${err instanceof Error ? err.message : "network error"}`,
          5000,
        );
      }
    },
    [backendConfig, onToast],
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-gray-500">
        <Card padding="md">Loading settings...</Card>
      </div>
    );
  }

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
      </div>

      {/* API Configuration Card */}
      <Card padding="md">
        <h2 className="text-[16px] font-semibold text-dark-900 mb-4">
          {t("api_config")}
        </h2>

        {/* ASR API Key */}
        <div className="grid grid-cols-[1fr_auto] gap-4 items-start mb-4">
          <div>
            <Input
              id="asr-api-key-input"
              label={t("asr_api_key")}
              type={showAsrApiKey ? "text" : "password"}
              value={asrApiKey}
              onChange={(e) => setAsrApiKey(e.target.value)}
              placeholder="Enter ASR API key"
              rightElement={
                <button
                  type="button"
                  aria-label={
                    showAsrApiKey ? t("hide") : t("show")
                  }
                  onClick={() => setShowAsrApiKey((v) => !v)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showAsrApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Badge variant={connectionBadgeVariant(connectionStatus)}>
              {connectionBadgeText(connectionStatus, t)}
            </Badge>
            <Button variant="primary" size="sm" onClick={handleTestAsr}>
              Test
            </Button>
          </div>
        </div>

        {/* LLM API Key */}
        <div className="grid grid-cols-[1fr_auto] gap-4 items-start mb-4">
          <div>
            <Input
              id="llm-api-key-input"
              label={t("llm_api_key")}
              type={showLlmApiKey ? "text" : "password"}
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
              placeholder="Enter OpenAI-compatible LLM API key"
              rightElement={
                <button
                  type="button"
                  aria-label={
                    showLlmApiKey ? t("hide") : t("show")
                  }
                  onClick={() => setShowLlmApiKey((v) => !v)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showLlmApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Badge variant={connectionBadgeVariant(llmConnectionStatus)}>
              {connectionBadgeText(llmConnectionStatus, t)}
            </Badge>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTestLlm}
              disabled={!llmEnabled}
            >
              Test
            </Button>
          </div>
        </div>

        {/* LLM Enabled Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <input
            id="llm-enabled-input"
            type="checkbox"
            checked={llmEnabled}
            onChange={handleLlmEnabledToggle}
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          <label htmlFor="llm-enabled-input" className="text-sm text-dark-700 cursor-pointer select-none">
            {t("enable_llm")}
          </label>
        </div>

        {/* ASR URL + Model */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Input
            id="asr-base-url-input"
            label={t("asr_base_url")}
            type="text"
            value={asrBaseUrl}
            onChange={(e) => setAsrBaseUrl(e.target.value)}
            placeholder="https://token-plan-cn.xiaomimimo.com/v1"
          />
          <Input
            id="asr-model-input"
            label={t("asr_model")}
            type="text"
            value={asrModel}
            onChange={(e) => setAsrModel(e.target.value)}
            placeholder="mimo-v2.5-asr"
          />
        </div>

        {/* LLM URL + Model */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Input
            id="llm-base-url-input"
            label={t("llm_base_url")}
            type="text"
            value={llmBaseUrl}
            onChange={(e) => setLlmBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
          <Input
            id="llm-model-input"
            label={t("llm_model")}
            type="text"
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            placeholder="gpt-4o-mini"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end mb-6">
          <Button variant="secondary" size="sm" onClick={handleSave}>
            {t("save_api_settings")}
          </Button>
        </div>

        {/* Hotkey */}
        <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
          <Input
            id="hotkey-input"
            label={t("global_hotkey")}
            type="text"
            value={hotkey}
            readOnly
            onFocus={() => {
              isCapturingHotkeyRef.current = true;
            }}
            onBlur={() => {
              isCapturingHotkeyRef.current = false;
            }}
            onKeyDown={handleHotkeyKeyDown}
            placeholder="Alt+="
          />
          <div className="pt-6">
            <Button variant="secondary" size="sm" onClick={handleSaveHotkey}>
              {t("save_hotkey")}
            </Button>
          </div>
        </div>
      </Card>

      {/* Prompt Management Card */}
      <Card padding="md">
        <h2 className="text-[16px] font-semibold text-dark-900 mb-4">
          {t("prompt_management")}
        </h2>
        {prompts.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={24} className="text-brand-500" />}
            title={t("no_prompts")}
            description={t("no_prompts_desc")}
            size="sm"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {prompts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2"
              >
                <span className="text-sm text-dark-700">{p.name}</span>
                  {p.is_active && (
                    <Badge variant="success" size="sm">
                      {t("active")}
                    </Badge>
                  )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Dictionary Management Card */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold text-dark-900 m-0">
            {t("dictionary_management")}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              resetDictForm();
              setDictFormOpen(true);
            }}
          >
            <Plus size={14} />
            {t("add")}
          </Button>
        </div>

        {dictFormOpen && (
          <div className="flex flex-col gap-3 mb-4 p-4 bg-gray-50 rounded-lg">
            <Input
              id="dict-term"
              label={t("canonical_term") + " *"}
              type="text"
              value={dictForm.canonical_term}
              onChange={(e) =>
                setDictForm((f) => ({ ...f, canonical_term: e.target.value }))
              }
              placeholder="e.g. ASR Linux"
            />
            <Input
              id="dict-pronunciation"
              label={t("pinyin")}
              type="text"
              value={dictForm.pronunciation}
              onChange={(e) =>
                setDictForm((f) => ({ ...f, pronunciation: e.target.value }))
              }
              placeholder="e.g. gui ze"
            />
            <Input
              id="dict-aliases"
              label={t("aliases")}
              type="text"
              value={dictForm.aliases}
              onChange={(e) =>
                setDictForm((f) => ({ ...f, aliases: e.target.value }))
              }
              placeholder="e.g. asr, speech recognition"
            />
            <Input
              id="dict-notes"
              label={t("notes")}
              type="text"
              value={dictForm.notes}
              onChange={(e) =>
                setDictForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Description or replacement hint"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="dict-category"
                label={t("category")}
                type="text"
                value={dictForm.category}
                onChange={(e) =>
                  setDictForm((f) => ({ ...f, category: e.target.value }))
                }
                placeholder="tech, business..."
              />
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  {t("enforcement")}
                </label>
                <select
                  value={dictForm.enforcement_level}
                  onChange={(e) =>
                    setDictForm((f) => ({
                      ...f,
                      enforcement_level: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="suggested">{t("suggested")}</option>
                  <option value="forced">{t("forced")}</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={resetDictForm}>
                <X size={14} />
                {t("cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={handleDictSubmit}>
                {editingEntryId ? t("update") : t("create")}
              </Button>
            </div>
          </div>
        )}

        {dictionary.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={24} className="text-brand-500" />}
            title={t("no_entries")}
            description={t("no_entries_desc")}
            size="sm"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {dictionary.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm text-dark-700">
                    {e.canonical_term}
                  </span>
                  {e.pronunciation && (
                    <span className="text-xs text-gray-400">
                      {e.pronunciation}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {e.category && (
                    <span className="text-xs text-gray-400">{e.category}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditForm(e)}
                    className="text-gray-400 hover:text-brand-600 transition-colors p-1"
                    aria-label="Edit entry"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(e.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                    aria-label="Delete entry"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Diagnostics Card */}
      <Card padding="md">
        <h2 className="text-[16px] font-semibold text-dark-900 mb-4">
          {t("diagnostics")}
        </h2>
        {backendConfig ? (
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-dark-700 min-w-[100px]">
                {t("backend_url")}:
              </span>
              <span className="text-sm font-mono text-dark-600">
                {backendConfig.url}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-dark-700 min-w-[100px]">
                {t("token")}:
              </span>
              <span className="text-sm font-mono text-gray-400">
                {maskToken(backendConfig.token)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-4">
            No backend configuration available.
          </p>
        )}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium text-dark-700 min-w-[100px]">
            {t("hotkey")}:
          </span>
          <span className="text-sm text-dark-600">
            {registeredHotkey ?? t("not_registered")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handleOpenLogs}>
            {t("open_logs")}
          </Button>
          <Button variant="primary" size="sm" onClick={handleExportDiagnostics}>
            <Download size={14} />
            {t("export_diagnostics")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default SettingsPage;
