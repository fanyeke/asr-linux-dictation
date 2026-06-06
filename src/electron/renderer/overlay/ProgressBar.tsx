import { useEffect, useState } from "react";
import type { DictationStatus } from "./types.js";
import { useTranslation } from "../lib/i18n.js";

// ---------------------------------------------------------------------------
// Phase config
// ---------------------------------------------------------------------------
interface PhaseConfig {
  color: string;        // Tailwind bg color
  labelKey: string;     // i18n key
  width: string;        // progress width
  animate: boolean;     // pulse animation
}

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  recording:    { color: "bg-red-500",    labelKey: "overlay_recording",    width: "40%",  animate: false },
  transcribing: { color: "bg-brand-500",  labelKey: "overlay_transcribing",  width: "55%", animate: true  },
  polishing:    { color: "bg-purple-500", labelKey: "overlay_polishing",     width: "80%", animate: true  },
  completed:    { color: "bg-green-500",  labelKey: "overlay_completed",     width: "100%", animate: false },
  failed:       { color: "bg-red-500",    labelKey: "overlay_failed",        width: "100%", animate: false },
};

const TERMINAL_PHASES = new Set(["completed", "failed"]);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ProgressBarProps {
  phase: string;
  micLevel: number;
  silenceRemainingMs: number | null;  // VAD countdown
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProgressBar({
  phase,
  micLevel,
  silenceRemainingMs,
}: ProgressBarProps): JSX.Element {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [completedShow, setCompletedShow] = useState(true);

  const config = PHASE_CONFIG[phase] ?? null;
  const isRecording = phase === "recording";

  // Show bar for any non-idle phase
  useEffect(() => {
    if (phase !== "idle") {
      setVisible(true);
      setCompletedShow(true);
    }
  }, [phase]);

  // Completed/failed: hide after 2s
  useEffect(() => {
    if (TERMINAL_PHASES.has(phase)) {
      const timer = setTimeout(() => {
        setCompletedShow(false);
        // After fade animation, fully hide
        setTimeout(() => setVisible(false), 300);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  if (!visible || !config) return <div />;

  // During recording: width follows micLevel; VAD countdown as gray tail
  const barWidth = isRecording
    ? `${Math.min(Math.max(micLevel * 100, 0), 100)}%`
    : config.width;

  const barColor = isRecording ? "bg-red-500" : config.color;
  const pulseClass = config.animate ? "animate-pulse" : "";
  const fadeClass = !completedShow ? "opacity-0 transition-opacity duration-300" : "";

  return (
    <div
      data-testid="progress-bar"
      className={`overflow-hidden transition-opacity duration-300 ${fadeClass}`}
    >
      <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden relative">
        {/* Main bar */}
        <div
          data-testid="progress-bar-fill"
          className={`h-full rounded-full transition-all duration-200 ${barColor} ${pulseClass}`}
          style={{
            width: barWidth,
            transition: "width 0.1s ease",
          }}
        />

        {/* VAD countdown tail (gray) */}
        {silenceRemainingMs !== null && silenceRemainingMs > 0 && isRecording && (
          <div
            data-testid="vad-countdown"
            className="absolute top-0 h-full bg-white/20 rounded-full transition-all duration-200"
            style={{
              left: barWidth,
              width: `${Math.min((silenceRemainingMs / 2000) * 30, 30)}%`,
              maxWidth: "30%",
            }}
          />
        )}
      </div>

      {/* Phase label */}
      <div className="flex items-center justify-between mt-1">
        <span
          data-testid="progress-label"
          className={`text-[11px] font-medium transition-all duration-200 ${
            isRecording ? "text-red-400" : "text-gray-300"
          }`}
        >
          {t(config.labelKey)}
        </span>

        {/* Recording timer */}
        {isRecording && silenceRemainingMs === null && (
          <span className="text-[11px] text-gray-500 tabular-nums">
            {t("overlay_recording")}
          </span>
        )}
      </div>
    </div>
  );
}
