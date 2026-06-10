import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Mic, ArrowLeft, ArrowRight, SkipForward } from "lucide-react";
import { useTranslation } from "../lib/i18n.js";
import type { BackendConfig } from "../settings/types.js";
import { Button } from "./ui/Button.js";

// ---------------------------------------------------------------------------
// Step config
// ---------------------------------------------------------------------------
const TOTAL_STEPS = 4;

const STEP_LABELS = [
  "onboarding_step1",
  "onboarding_step2",
  "onboarding_step3",
  "onboarding_step4",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface OnboardingWizardProps {
  backendConfig: BackendConfig | null;
  onComplete: () => void;
  onSkip: () => void;
}

// ---------------------------------------------------------------------------
// Step 1: System Dependency Check
// ---------------------------------------------------------------------------
function DepCheckStep({ backendConfig }: { backendConfig: BackendConfig | null }): JSX.Element {
  const { t } = useTranslation();
  const [deps, setDeps] = useState<Array<{ name: string; found: boolean }> | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!backendConfig || loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    fetch(`${backendConfig.url}/system/deps`, {
      headers: { "x-token": backendConfig.token },
    })
      .then((r) => r.json())
      .then((data) => {
        setDeps(data as Array<{ name: string; found: boolean }>);
        setLoading(false);
      })
      .catch(() => {
        setDeps([]);
        setLoading(false);
      });
  }, [backendConfig]);

  const installCommands: Record<string, string> = {
    arecord: "apt install alsa-utils",
    xdotool: "apt install xdotool",
    xsel: "apt install xsel",
    xclip: "apt install xclip",
    xprop: "apt install x11-utils",
  };

  if (loading) {
    return <div className="text-sm text-[var(--muted-foreground)] py-8 text-center">{t("loading")}</div>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted-foreground)]">{t("onboarding_dep_desc")}</p>
      {deps?.map((dep) => (
        <div key={dep.name} className="flex items-center justify-between py-2 px-3 bg-[var(--muted)] rounded-lg">
          <div className="flex items-center gap-2">
            {dep.found ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <code className="text-sm font-mono">{dep.name}</code>
            <span className={`text-xs ${dep.found ? "text-[var(--green-600)]" : "text-[var(--red-600)]"}`}>
              {dep.found ? t("onboarding_installed") : t("onboarding_missing")}
            </span>
          </div>
          {!dep.found && installCommands[dep.name] && (
            <code className="text-xs bg-[var(--border)] px-2 py-0.5 rounded text-[var(--muted-foreground)]">
              {installCommands[dep.name]}
            </code>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 & 3: API Key Config (reusable)
// ---------------------------------------------------------------------------
interface ApiConfigStepProps {
  backendConfig: BackendConfig | null;
  label: string;
  testEndpoint: string;
  urlField: string;
  keyField: string;
  modelField?: string;
  defaultUrl: string;
  defaultModel?: string;
}

function ApiConfigStep({
  backendConfig,
  label,
  testEndpoint,
  urlField,
  keyField,
  modelField,
  defaultUrl,
  defaultModel,
}: ApiConfigStepProps): JSX.Element {
  const { t } = useTranslation();
  const [url, setUrl] = useState(defaultUrl);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(defaultModel ?? "");
  const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [testMessage, setTestMessage] = useState("");

  const handleTest = useCallback(async () => {
    if (!backendConfig || !apiKey) return;
    setTestResult("testing");
    setTestMessage("");

    // Save config first
    const payload: Record<string, string> = { [urlField]: url, [keyField]: apiKey };
    if (modelField && model) payload[modelField] = model;
    try {
      await fetch(`${backendConfig.url}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-token": backendConfig.token },
        body: JSON.stringify(payload),
      });

      const res = await fetch(`${backendConfig.url}${testEndpoint}`, {
        headers: { "x-token": backendConfig.token },
      });
      if (res.ok) {
        setTestResult("success");
        setTestMessage(t("onboarding_test_ok"));
      } else {
        setTestResult("failed");
        const body = await res.text().catch(() => "");
        setTestMessage(`${res.status}: ${body.slice(0, 100)}`);
      }
    } catch (err) {
      setTestResult("failed");
      setTestMessage(err instanceof Error ? err.message : "Network error");
    }
  }, [backendConfig, url, apiKey, model, testEndpoint, urlField, keyField, modelField, t]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">{t("onboarding_url")}</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
          placeholder={defaultUrl}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">{label}</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
          placeholder="sk-..."
        />
      </div>
      {modelField && (
        <div>
          <label className="block text-sm font-medium text-[var(--muted-foreground)] mb-1">{t("onboarding_model")}</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
            placeholder={defaultModel}
          />
        </div>
      )}
      <Button
        variant="primary"
        size="sm"
        onClick={handleTest}
        disabled={!apiKey || testResult === "testing"}
        isLoading={testResult === "testing"}
      >
        {t("onboarding_test_connection")}
      </Button>
      {testResult === "success" && (
        <p className="text-sm text-[var(--green-600)]">{testMessage}</p>
      )}
      {testResult === "failed" && (
        <p className="text-sm text-[var(--red-600)]">{testMessage}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Trial Recording
// ---------------------------------------------------------------------------
function TrialStep({ backendConfig }: { backendConfig: BackendConfig | null }): JSX.Element {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<string>("idle");
  const [result, setResult] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    if (!backendConfig) return;
    setPhase("recording");
    try {
      await fetch(`${backendConfig.url}/dictation/start`, {
        method: "POST",
        headers: { "x-token": backendConfig.token },
      });
    } catch (err) {
      setPhase("failed");
    }
  }, [backendConfig]);

  const handleStop = useCallback(async () => {
    if (!backendConfig) return;
    setPhase("transcribing");
    try {
      const res = await fetch(`${backendConfig.url}/dictation/stop`, {
        method: "POST",
        headers: { "x-token": backendConfig.token },
      });
      if (res.ok) {
        const data = await res.json() as { status: string; polished_text?: string; raw_text?: string };
        if (data.status === "completed") {
          setResult(data.polished_text ?? data.raw_text ?? "");
          setPhase("completed");
        } else {
          setPhase("failed");
        }
      } else {
        setPhase("failed");
      }
    } catch {
      setPhase("failed");
    }
  }, [backendConfig]);

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-[var(--muted-foreground)]">{t("onboarding_trial_desc")}</p>

      {phase === "idle" && (
        <Button variant="primary" size="md" onClick={handleStart}>
          <Mic className="w-4 h-4 mr-2" />
          {t("start_recording")}
        </Button>
      )}

      {phase === "recording" && (
        <div className="space-y-3">
          <div className="animate-pulse text-red-500 font-medium">
            {t("overlay_recording")}
          </div>
          <Button variant="secondary" size="md" onClick={handleStop}>
            {t("stop_recording")}
          </Button>
        </div>
      )}

      {(phase === "transcribing" || phase === "polishing") && (
        <div className="animate-pulse text-brand-500 font-medium">
          {t("overlay_transcribing")}
        </div>
      )}

      {phase === "completed" && result && (
        <div className="bg-[var(--success-bg)] border border-[var(--success-border)] rounded-lg p-4 text-sm text-[var(--success-text)] text-left">
          {result}
        </div>
      )}

      {phase === "failed" && (
        <p className="text-sm text-[var(--red-600)]">{t("onboarding_trial_failed")}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Wizard Component
// ---------------------------------------------------------------------------
export function OnboardingWizard({
  backendConfig,
  onComplete,
  onSkip,
}: OnboardingWizardProps): JSX.Element | null {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Mark step as completed when user views it
  useEffect(() => {
    setCompletedSteps((prev) => new Set(prev).add(step));
  }, [step]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
    else onComplete();
  }, [step, onComplete]);

  const handlePrev = useCallback(() => {
    if (step > 1) setStep((s) => s - 1);
  }, [step]);

  const allDone = completedSteps.size >= TOTAL_STEPS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--card)] rounded-2xl shadow-2xl w-[520px] max-w-[90vw] max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {t("onboarding_title")}
          </h2>

          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mt-4 mb-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                  s <= step ? "bg-brand-500" : "bg-[var(--border)]"
                }`}
              />
            ))}
          </div>
          {step <= TOTAL_STEPS && (
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("onboarding_step_of")} {step} / {TOTAL_STEPS} — {t(STEP_LABELS[step - 1])}
            </p>
          )}
        </div>

        {/* Step content */}
        <div className="px-6 py-4 min-h-[200px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 1 && <DepCheckStep backendConfig={backendConfig} />}
              {step === 2 && (
                <ApiConfigStep
                  backendConfig={backendConfig}
                  label={t("asr_api_key")}
                  testEndpoint="/test-asr-key"
                  urlField="asr_base_url"
                  keyField="asr_api_key"
                  defaultUrl="https://token-plan-cn.xiaomimimo.com/v1"
                />
              )}
              {step === 3 && (
                <ApiConfigStep
                  backendConfig={backendConfig}
                  label={t("llm_api_key")}
                  testEndpoint="/test-llm-key"
                  urlField="llm_base_url"
                  keyField="llm_api_key"
                  modelField="llm_model"
                  defaultUrl="https://api.openai.com/v1"
                  defaultModel="gpt-4o-mini"
                />
              )}
              {step === 4 && <TrialStep backendConfig={backendConfig} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: navigation */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={handlePrev}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t("onboarding_prev")}
              </Button>
            ) : (
              <div />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onSkip}>
              <SkipForward className="w-4 h-4 mr-1" />
              {t("onboarding_skip")}
            </Button>
            <Button variant="primary" size="sm" onClick={handleNext}>
              {step < TOTAL_STEPS ? t("onboarding_next") : t("onboarding_finish")}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
