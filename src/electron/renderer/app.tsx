import "./styles/globals.css";
import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  BackendConfig,
  DictationResultData,
  HistorySession,
  PipelinePhase,
  TabId,
} from "./settings/types.js";
import type { VoiceAPI, DictationResult } from "./overlay/types.js";
import { I18nProvider, createI18nState, type Language } from "./lib/i18n.js";
import { AppLayout } from "./components/AppLayout.js";
import { Toast } from "./components/Toast.js";
import { DictatePage } from "./components/DictatePage.js";
import { HistoryPage } from "./components/HistoryPage.js";
import { SettingsPage } from "./components/SettingsPage.js";
import { DashboardPage } from "./components/DashboardPage.js";
import { OnboardingWizard } from "./components/OnboardingWizard.js";
import { ThemeProvider } from "./components/ThemeProvider.js";

function getVoiceAPI(): VoiceAPI {
  return window.voiceAPI!;
}

const TAB_TITLES: Record<TabId, string> = {
  dashboard: "tab_dashboard",
  dictate: "tab_dictate",
  history: "tab_history",
  settings: "tab_settings",
};

const ONBOARDING_STORAGE_KEY = "asr-onboarding-completed";

function App(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>("dictate");
  const [dashboardKey, setDashboardKey] = useState(0);
  const [backendConfig, setBackendConfig] = useState<BackendConfig | null>(
    null,
  );

  // Bump dashboard key every time the user switches to the dashboard tab,
  // forcing a full remount so fresh data is always fetched.
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    if (tab === "dashboard") {
      setDashboardKey((k) => k + 1);
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [phase, setPhase] = useState<PipelinePhase>("idle");
  const [dictationResult, setDictationResult] =
    useState<DictationResultData | null>(null);
  const [dictationError, setDictationError] = useState<{
    message: string;
    errorType?: string;
    rawText?: string;
  } | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const isRecordingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const i18n = createI18nState("zh");

  // ---- Toast helper -------------------------------------------------------
  const showToast = useCallback(
    (msg: string, durationMs: number = 3000) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast(msg);
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, durationMs);
    },
    [],
  );

  // ---- Check if onboarding was completed locally ---------------------------
  const isOnboardingCompletedLocally = useCallback((): boolean => {
    try {
      return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }, []);

  const markOnboardingCompletedLocally = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
  }, []);

  // ---- Load backend config -------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function init(): Promise<void> {
      try {
        const config = await getVoiceAPI().getBackendConfig();
        if (cancelled) return;
        if (!config) {
          setError(i18n.t("error_backend_config"));
          setLoading(false);
          return;
        }
        setBackendConfig(config);

        // Load language preference from backend
        try {
          const cfgRes = await fetch(`${config.url}/config`, {
            headers: { "x-token": config.token },
          });
          if (cfgRes.ok && !cancelled) {
            const cfgData = await cfgRes.json();
            if (cfgData.ui_language === "en" || cfgData.ui_language === "zh") {
              i18n.setLanguage(cfgData.ui_language as Language);
            }
            // Check if onboarding is needed (localStorage first, then backend)
            const locallyCompleted = isOnboardingCompletedLocally();
            if (!locallyCompleted && !cfgData.onboarding_completed) {
              setShowOnboarding(true);
            }
            setOnboardingChecked(true);
          }
        } catch (err) {
          console.error("Failed to load config:", err);
          setOnboardingChecked(true);
        }

        // Load history
        try {
          const res = await fetch(`${config.url}/history`, {
            headers: {
              "x-token": config.token,
              "Content-Type": "application/json",
            },
          });
          if (res.ok && !cancelled) {
            setHistory(await res.json());
          }
        } catch (err) {
          console.error("Failed to load history:", err);
        }
      } catch (err) {
        console.error("Failed to initialize backend:", err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : i18n.t("error_unknown"),
          );
        }
      }
      if (!cancelled) setLoading(false);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [isOnboardingCompletedLocally]);

  // ---- Microphone level subscription ---------------------------------------
  useEffect(() => {
    const unsub = getVoiceAPI().onMicrophoneLevel((level: number) => {
      setMicLevel(level);
    });
    return unsub;
  }, []);

  // ---- Status update subscription ------------------------------------------
  useEffect(() => {
    const unsub = getVoiceAPI().onStatusUpdate((status) => {
      if (status.phase === "recording") {
        setPhase("recording");
        setIsRecording(true);
        setIsProcessing(false);
        isRecordingRef.current = true;
        isProcessingRef.current = false;
        setDictationResult(null);
        setDictationError(null);
      } else if (
        status.phase === "transcribing" ||
        status.phase === "polishing"
      ) {
        setPhase(status.phase);
        setIsRecording(false);
        setIsProcessing(true);
        isRecordingRef.current = false;
        isProcessingRef.current = true;
      } else if (status.phase === "completed") {
        setPhase("completed");
        setIsRecording(false);
        setIsProcessing(false);
        isRecordingRef.current = false;
        isProcessingRef.current = false;
        setError(null);
        setDictationResult({
          rawText: status.raw_text ?? "",
          polishedText: status.polished_text ?? null,
          status: "completed",
          timingMs: null,
          errorType: null,
        });
      } else if (status.phase === "failed") {
        setPhase("failed");
        setIsRecording(false);
        setIsProcessing(false);
        isRecordingRef.current = false;
        isProcessingRef.current = false;
        setDictationError({
          message: status.error,
          errorType: status.error_type,
        });
      }
    });
    return unsub;
  }, []);

  // ---- History refresh -----------------------------------------------------
  const refreshHistory = useCallback(async () => {
    if (!backendConfig) return;
    try {
      const res = await fetch(`${backendConfig.url}/history`, {
        headers: {
          "x-token": backendConfig.token,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }, [backendConfig]);

  // ---- Recording handlers --------------------------------------------------
  const handleStartRecording = useCallback(async () => {
    if (isRecordingRef.current || isProcessingRef.current) return;
    try {
      await getVoiceAPI().startDictation();
      isRecordingRef.current = true;
      isProcessingRef.current = false;
      setIsRecording(true);
      setIsProcessing(false);
      setError(null);
    } catch (err) {
      console.error("Failed to start recording:", err);
      isRecordingRef.current = false;
      isProcessingRef.current = false;
      setIsRecording(false);
      setIsProcessing(false);
      setError(
        err instanceof Error ? err.message : i18n.t("error_start_recording"),
      );
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    if (!isRecordingRef.current || isProcessingRef.current) return;
    isRecordingRef.current = false;
    isProcessingRef.current = true;
    setIsRecording(false);
    setIsProcessing(true);
    setDictationError(null);
    setDictationResult(null);

    let result: DictationResult | null = null;
    let errorMessage: string | null = null;
    try {
      result = await getVoiceAPI().stopDictation();
    } catch (err) {
      console.error("Failed to stop dictation:", err);
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    isProcessingRef.current = false;

    if (errorMessage) {
      setDictationError({ message: errorMessage });
    } else if (result) {
      if (result.status === "completed") {
        setDictationResult({
          rawText: result.raw_text ?? "",
          polishedText: result.polished_text ?? null,
          status: "completed",
          timingMs: null,
          errorType: null,
        });
        setPhase("completed");
      } else if (result.error) {
        setDictationError({
          message: result.error,
          errorType: result.error_type,
          rawText: result.raw_text,
        });
        setPhase("failed");
      }
    }

    setIsRecording(false);
    setIsProcessing(false);
    await refreshHistory();
  }, [refreshHistory]);

  // ---- Hotkey toggle subscription ------------------------------------------
  const handleStartRecordingRef = useRef(handleStartRecording);
  const handleStopRecordingRef = useRef(handleStopRecording);
  useEffect(() => {
    handleStartRecordingRef.current = handleStartRecording;
    handleStopRecordingRef.current = handleStopRecording;
  }, [handleStartRecording, handleStopRecording]);

  useEffect(() => {
    const unsub = getVoiceAPI().onToggleDictation(() => {
      if (isProcessingRef.current) return;
      if (isRecordingRef.current) {
        handleStopRecordingRef.current();
      } else {
        handleStartRecordingRef.current();
      }
    });
    return unsub;
  }, []);

  // ---- Hotkey change handler -----------------------------------------------
  const handleHotkeyChange = useCallback((_hotkey: string) => {
    // hotkey registered successfully; could display in UI if needed
  }, []);

  // ---- Onboarding handlers -------------------------------------------------
  const handleOnboardingComplete = useCallback(async () => {
    setShowOnboarding(false);
    markOnboardingCompletedLocally();
    if (!backendConfig) return;
    try {
      await fetch(`${backendConfig.url}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-token": backendConfig.token },
        body: JSON.stringify({ onboarding_completed: true }),
      });
    } catch (err) {
      console.error("Failed to save onboarding status:", err);
    }
  }, [backendConfig, markOnboardingCompletedLocally]);

  const handleOnboardingSkip = useCallback(() => {
    setShowOnboarding(false);
    markOnboardingCompletedLocally();
  }, [markOnboardingCompletedLocally]);

  // ---- Re-run onboarding from settings --------------------------------------
  const handleRerunOnboarding = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  // ---- Render --------------------------------------------------------------
  if (loading) {
    return (
      <ThemeProvider>
        <I18nProvider value={i18n}>
          <div
            style={{
              display: "flex",
              height: "100vh",
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontSize: "14px",
              color: "var(--foreground)",
              background: "var(--background)",
            }}
          >
            <AppLayout
              activeTab={activeTab}
              onTabChange={handleTabChange}
              pageTitle={i18n.t(TAB_TITLES[activeTab])}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--muted-foreground)",
                }}
              >
                {i18n.t("loading")}
              </div>
            </AppLayout>
          </div>
        </I18nProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <I18nProvider value={i18n}>
        <AppLayout
          activeTab={activeTab}
          onTabChange={handleTabChange}
          pageTitle={i18n.t(TAB_TITLES[activeTab])}
        >
          {/* Global error banner */}
          {error && (
            <div
              style={{
                background: "var(--error-bg)",
                padding: "10px 20px",
                borderBottom: "1px solid var(--error-border)",
              }}
            >
              <p style={{ color: "var(--error-text)", fontSize: "13px", margin: 0 }}>
                {error}
              </p>
            </div>
          )}

          {/* Animated tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "dictate" && (
                <DictatePage
                  backendConfig={backendConfig}
                  isRecording={isRecording}
                  isProcessing={isProcessing}
                  micLevel={micLevel}
                  phase={phase}
                  result={dictationResult}
                  error={dictationError}
                  onStartRecording={handleStartRecording}
                  onStopRecording={handleStopRecording}
                  onRefreshHistory={refreshHistory}
                />
              )}

              {activeTab === "history" && (
                <HistoryPage
                  history={history}
                  backendConfig={backendConfig}
                  onRefresh={refreshHistory}
                  onToast={showToast}
                />
              )}

              {activeTab === "dashboard" && (
                <DashboardPage
                  key={dashboardKey}
                  backendConfig={backendConfig}
                  onToast={showToast}
                />
              )}

              {activeTab === "settings" && (
                <SettingsPage
                  backendConfig={backendConfig}
                  onToast={showToast}
                  onHotkeyChange={handleHotkeyChange}
                  onRerunOnboarding={handleRerunOnboarding}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </AppLayout>

        {/* Onboarding Wizard */}
        {showOnboarding && (
          <OnboardingWizard
            backendConfig={backendConfig}
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        )}

        <Toast message={toast} />
      </I18nProvider>
    </ThemeProvider>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
