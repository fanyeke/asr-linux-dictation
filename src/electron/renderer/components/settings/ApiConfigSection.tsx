import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { BackendConfig, ConnectionStatus } from "../../settings/types.js";
import { Card } from "../ui/Card.js";
import { Input } from "../ui/Input.js";
import { Button } from "../ui/Button.js";
import { Badge } from "../ui/Badge.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function readErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string" && body.detail) return body.detail;
    } catch (err) {
      console.error("Failed to read error detail:", err);
      // fall through
    }
  }
  return response.text().catch(() => "");
}

/** Placeholder shown when an API key is configured but not exposed to the client. */
const MASKED_PLACEHOLDER = "••••••••";

function buildConfigPayload(state: {
  asrApiKey: string;
  asrBaseUrl: string;
  asrModel: string;
  asrLanguage: string;
  llmApiKey: string;
  llmEnabled: boolean;
  llmBaseUrl: string;
  llmModel: string;
  asrEngine: string;
  localModelSize: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    asr_base_url: state.asrBaseUrl,
    asr_model: state.asrModel,
    asr_language: state.asrLanguage,
    llm_enabled: state.llmEnabled,
    llm_base_url: state.llmBaseUrl,
    llm_model: state.llmModel,
    asr_engine: state.asrEngine,
    local_model_size: state.localModelSize,
  };
  // Only include API keys when the user has entered a real (non-placeholder) value.
  // Empty keys are omitted so the server preserves the existing key.
  if (state.asrApiKey && state.asrApiKey !== MASKED_PLACEHOLDER) {
    payload.asr_api_key = state.asrApiKey;
  }
  if (state.llmApiKey && state.llmApiKey !== MASKED_PLACEHOLDER) {
    payload.llm_api_key = state.llmApiKey;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ApiConfigSectionProps {
  backendConfig: BackendConfig | null;
  onToast: (msg: string, durationMs?: number) => void;
  t: (key: string) => string;
}

export function ApiConfigSection({
  backendConfig,
  onToast,
  t,
}: ApiConfigSectionProps): JSX.Element {
  const [asrApiKey, setAsrApiKey] = useState("");
  const [asrBaseUrl, setAsrBaseUrl] = useState(
    "https://token-plan-cn.xiaomimimo.com/v1",
  );
  const [asrModel, setAsrModel] = useState("mimo-v2.5-asr");
  const [asrLanguage, setAsrLanguage] = useState("auto");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmEnabled, setLlmEnabled] = useState(true);
  const [llmBaseUrl, setLlmBaseUrl] = useState("https://api.openai.com/v1");
  const [llmModel, setLlmModel] = useState("gpt-4o-mini");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("unknown");
  const [llmConnectionStatus, setLlmConnectionStatus] =
    useState<ConnectionStatus>("unknown");
  const [showAsrApiKey, setShowAsrApiKey] = useState(false);
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const [asrEngine, setAsrEngine] = useState("cloud");
  const [localModelSize, setLocalModelSize] = useState("small");
  const [models, setModels] = useState<Array<{name: string; path: string | null; size_mb: number; downloaded: boolean; description: string}>>([]);
  const [modelDownloading, setModelDownloading] = useState(false);
  const loadedRef = useRef(false);

  // Load initial config
  useEffect(() => {
    if (!backendConfig || loadedRef.current) return;
    const bc = backendConfig;
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch(`${bc!.url}/config`, {
          headers: { "x-token": bc!.token },
        });
        if (cancelled || !res.ok) return;
        const cfg = await res.json();
        // API keys are never returned as raw values — use boolean flags
        setAsrApiKey(cfg.asr_api_key_set ? MASKED_PLACEHOLDER : "");
        setLlmApiKey(cfg.llm_api_key_set ? MASKED_PLACEHOLDER : "");
        if (cfg.asr_base_url) setAsrBaseUrl(cfg.asr_base_url);
        if (cfg.asr_model) setAsrModel(cfg.asr_model);
        if (cfg.asr_language) setAsrLanguage(cfg.asr_language);
        if (cfg.llm_enabled !== undefined && cfg.llm_enabled !== null) {
          setLlmEnabled(cfg.llm_enabled);
        }
        if (cfg.llm_base_url) setLlmBaseUrl(cfg.llm_base_url);
        if (cfg.llm_model) setLlmModel(cfg.llm_model);
        if (cfg.asr_engine) setAsrEngine(cfg.asr_engine);
        if (cfg.local_model_size) setLocalModelSize(cfg.local_model_size);
        loadedRef.current = true;
      } catch (err) {
        console.error("Failed to load config:", err);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [backendConfig]);

  // Load model status when engine is local
  useEffect(() => {
    if (!backendConfig || asrEngine !== "local") return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${backendConfig!.url}/models`, {
          headers: { "x-token": backendConfig!.token },
        });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        setModels(data.downloaded || []);
      } catch (err) {
        console.error("Failed to load models:", err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [backendConfig, asrEngine]);

  const configState = {
    asrApiKey,
    asrBaseUrl,
    asrModel,
    asrLanguage,
    llmApiKey,
    llmEnabled,
    llmBaseUrl,
    llmModel,
    asrEngine,
    localModelSize,
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
        console.error("Failed to save config:", err);
        if (!silent) {
          onToast(
            `${t("config_save_failed")}: ${err instanceof Error ? err.message : "network error"}`,
            5000,
          );
        }
        return false;
      }
    },
    [backendConfig, configState, onToast, t],
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
    } catch (err) {
      console.error("ASR test failed:", err);
      setConnectionStatus("failed");
    }
  }, [backendConfig, saveConfigToBackend, onToast, t]);

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
    } catch (err) {
      console.error("LLM test failed:", err);
      setLlmConnectionStatus("failed");
    }
  }, [backendConfig, saveConfigToBackend, onToast, t]);

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
      } catch (err) {
        onToast(t("llm_toggle_failed"), 3000);
        console.error("Failed to toggle LLM:", err);
      }
    },
    [backendConfig, configState],
  );

  const handleDownloadModel = useCallback(async () => {
    if (!backendConfig || modelDownloading) return;
    setModelDownloading(true);
    try {
      const res = await fetch(`${backendConfig.url}/models/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-token": backendConfig.token },
        body: JSON.stringify({ name: localModelSize }),
      });
      if (res.ok) {
        onToast(`Model ${localModelSize} downloaded`, 3000);
        // Reload models
        const mRes = await fetch(`${backendConfig.url}/models`, {
          headers: { "x-token": backendConfig.token },
        });
        if (mRes.ok) {
          const data = await mRes.json();
          setModels(data.downloaded || []);
        }
      } else {
        onToast("Model download failed", 5000);
      }
    } catch (err) {
      onToast(`Download error: ${err}`, 5000);
    } finally {
      setModelDownloading(false);
    }
  }, [backendConfig, localModelSize, modelDownloading, onToast]);

  const handleDeleteModel = useCallback(async (name: string) => {
    if (!backendConfig) return;
    try {
      await fetch(`${backendConfig.url}/models/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-token": backendConfig.token },
        body: JSON.stringify({ name }),
      });
      const mRes = await fetch(`${backendConfig.url}/models`, {
        headers: { "x-token": backendConfig.token },
      });
      if (mRes.ok) {
        const data = await mRes.json();
        setModels(data.downloaded || []);
      }
    } catch (err) {
      onToast(t("model_delete_failed"), 3000);
      console.error("Failed to delete model:", err);
    }
  }, [backendConfig]);

  return (
    <Card padding="md">
      <h2 className="text-[16px] font-semibold text-[var(--foreground)] mb-4">
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
                aria-label={showAsrApiKey ? t("hide") : t("show")}
                onClick={() => setShowAsrApiKey((v) => !v)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
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
                aria-label={showLlmApiKey ? t("hide") : t("show")}
                onClick={() => setShowLlmApiKey((v) => !v)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
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
          className="rounded border-[var(--border)] text-brand-600 focus:ring-[var(--brand-500)]"
        />
        <label htmlFor="llm-enabled-input" className="text-sm text-[var(--muted-foreground)] cursor-pointer select-none">
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

      {/* ASR Engine */}
      <div className="mb-4">
        <label
          htmlFor="asr-engine-select"
          className="block text-sm font-medium text-[var(--muted-foreground)] mb-1"
        >
          ASR Engine
        </label>
        <select
          id="asr-engine-select"
          value={asrEngine}
          onChange={(e) => setAsrEngine(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
        >
          <option value="cloud">Cloud API (MiMo)</option>
          <option value="local">Local (Whisper.cpp)</option>
        </select>

        {asrEngine === "local" && (
          <div className="mt-3 p-3 bg-[var(--muted)] rounded-md space-y-3">
            <p className="text-xs text-[var(--muted-foreground)]">
              Download a Whisper model for offline ASR. Requires whisper-cli to be installed.
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                  Model Size
                </label>
                <select
                  value={localModelSize}
                  onChange={(e) => setLocalModelSize(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-2 py-1.5 text-sm"
                >
                  <option value="tiny">Tiny (~75 MB)</option>
                  <option value="base">Base (~150 MB)</option>
                  <option value="small">Small (~500 MB) — Recommended</option>
                  <option value="medium">Medium (~1.5 GB)</option>
                </select>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadModel}
                disabled={modelDownloading}
              >
                {modelDownloading ? "Downloading..." : "Download"}
              </Button>
            </div>
            {/* Downloaded models */}
            {models.length > 0 && (
              <div className="text-xs space-y-1">
                {models.map((m) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <span className="text-[var(--green-600)]">✓ {m.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteModel(m.name)}
                      className="text-[var(--red-500)] hover:text-[var(--red-700)] text-xs"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ASR Language */}
      <div className="mb-4">
        <label
          htmlFor="asr-language-select"
          className="block text-sm font-medium text-[var(--muted-foreground)] mb-1"
        >
          {t("asr_language_label")}
        </label>
        <select
          id="asr-language-select"
          value={asrLanguage}
          onChange={(e) => setAsrLanguage(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
        >
          <option value="auto">{t("asr_lang_auto")}</option>
          <option value="zh">{t("asr_lang_zh")}</option>
          <option value="en">{t("asr_lang_en")}</option>
        </select>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={handleSave}>
          {t("save_api_settings")}
        </Button>
      </div>
    </Card>
  );
}
