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
}): Record<string, unknown> {
  return {
    asr_api_key: state.asrApiKey,
    asr_base_url: state.asrBaseUrl,
    asr_model: state.asrModel,
    llm_api_key: state.llmApiKey,
    llm_enabled: state.llmEnabled,
    llm_base_url: state.llmBaseUrl,
    llm_model: state.llmModel,
  };
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
        loadedRef.current = true;
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [backendConfig]);

  const configState = {
    asrApiKey,
    asrBaseUrl,
    asrModel,
    llmApiKey,
    llmEnabled,
    llmBaseUrl,
    llmModel,
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
    } catch {
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
    } catch {
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
      } catch {
        // silent; user can retry with Save button
      }
    },
    [backendConfig, configState],
  );

  return (
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
                aria-label={showAsrApiKey ? t("hide") : t("show")}
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
                aria-label={showLlmApiKey ? t("hide") : t("show")}
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
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={handleSave}>
          {t("save_api_settings")}
        </Button>
      </div>
    </Card>
  );
}
