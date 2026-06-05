import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import type { PipelinePhase } from "../settings/types.js";
import { useTranslation } from "../lib/i18n.js";
import { Card } from "./ui/Card.js";

interface PhaseIndicatorProps {
  phase: PipelinePhase;
}

const PHASE_META: Record<
  PipelinePhase,
  { color: string; label: string; stepLabel: string }
> = {
  idle: { color: "#94a3b8", label: "Ready", stepLabel: "Ready" },
  recording: { color: "#f43f5e", label: "Recording", stepLabel: "Recording" },
  transcribing: { color: "#6366f1", label: "Transcribing", stepLabel: "ASR" },
  polishing: { color: "#8b5cf6", label: "Polishing", stepLabel: "LLM" },
  completed: { color: "#10b981", label: "Completed", stepLabel: "Done" },
  failed: { color: "#ef4444", label: "Failed", stepLabel: "Failed" },
};

const PIPELINE_STEPS: PipelinePhase[] = [
  "recording",
  "transcribing",
  "polishing",
  "completed",
];

const STATUS_TEXT: Record<PipelinePhase, string> = {
  idle: "Ready to record — press Alt+= to start",
  recording: "Recording... — press hotkey to stop",
  transcribing: "Transcribing audio...",
  polishing: "Polishing with LLM...",
  completed: "Done! Text inserted ✓",
  failed: "Dictation failed — see details below",
};

function stepIndex(phase: PipelinePhase): number {
  if (phase === "failed") return PIPELINE_STEPS.length;
  const idx = PIPELINE_STEPS.indexOf(phase);
  return idx >= 0 ? idx : -1;
}

/** Inject pulse keyframes for the current step glow. */
const PULSE_STYLE_ID = "phase-indicator-pulse-global";
function ensurePulseStyle(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes phase-indicator-pulse {
      0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 4px rgba(99,102,241,0.2); }
      50% { opacity: 0.6; transform: scale(1.05); box-shadow: 0 0 0 8px rgba(99,102,241,0.1); }
    }
  `;
  document.head.appendChild(style);
}

export function PhaseIndicator({ phase }: PhaseIndicatorProps): JSX.Element {
  const { t } = useTranslation();
  ensurePulseStyle();

  const currentIdx = stepIndex(phase);
  const meta = PHASE_META[phase];

  // Idle state: simplified
  if (phase === "idle") {
    return (
      <div data-testid="phase-indicator">
        <Card>
          <div className="flex items-center justify-center gap-2 py-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: "#94a3b8" }}
            />
            <span className="text-sm" style={{ color: "#94a3b8" }}>
              {t("phase_idle")}
            </span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="phase-indicator">
      <Card padding="md">
      {/* Pipeline step bar */}
      <div className="flex items-center w-full gap-0">
        <AnimatePresence>
          {PIPELINE_STEPS.map((step, idx) => {
            const stepMeta = PHASE_META[step];
            const isCurrent = idx === currentIdx && phase !== "failed" && phase !== "completed";
            const isCompleted = idx < currentIdx || (phase === "completed" && idx <= currentIdx);
            const isFailed = phase === "failed" && idx === currentIdx;
            const isPending = !isCurrent && !isCompleted && !isFailed;

            let dotColor = "#e2e8f0";
            if (isCompleted) dotColor = PHASE_META[step].color;
            if (isCurrent) dotColor = meta.color;
            if (isFailed) dotColor = "#ef4444";

            const connectorColor = isCompleted ? stepMeta.color : "#e2e8f0";

            return (
              <motion.div
                key={step}
                className="flex items-center flex-1 last:flex-none"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
              >
                {/* Step dot */}
                <div
                  data-testid={`phase-step-${step}`}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="relative flex items-center justify-center">
                    {/* Outer ring for current step */}
                    {isCurrent && (
                      <motion.div
                        className="absolute rounded-full"
                        style={{
                          width: 24,
                          height: 24,
                          border: `2px solid ${dotColor}`,
                          animation: "phase-indicator-pulse 2s ease-in-out infinite",
                        }}
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                    )}

                    {/* Inner dot */}
                    {isCompleted ? (
                      <div
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width: 16,
                          height: 16,
                          background: dotColor,
                        }}
                      >
                        <Check className="text-white" size={10} strokeWidth={3} />
                      </div>
                    ) : isFailed ? (
                      <div
                        className="flex items-center justify-center rounded-full"
                        style={{
                          width: 16,
                          height: 16,
                          background: dotColor,
                        }}
                      >
                        <X className="text-white" size={10} strokeWidth={3} />
                      </div>
                    ) : (
                      <div
                        className="rounded-full"
                        style={{
                          width: isCurrent ? 8 : 10,
                          height: isCurrent ? 8 : 10,
                          background: isCurrent ? dotColor : isPending ? "#e2e8f0" : dotColor,
                        }}
                      />
                    )}
                  </div>

                  {/* Step label */}
                  <span
                    className="text-xs whitespace-nowrap"
                    style={{
                      color: isCurrent
                        ? dotColor
                        : isCompleted
                          ? "#475569"
                          : "#94a3b8",
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    {t("phase_" + step)}
                  </span>
                </div>

                {/* Connector line */}
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className="flex-1 mx-2">
                    <div
                      className="h-0.5 rounded-full"
                      style={{
                        background:
                          isCurrent && !isCompleted
                            ? `linear-gradient(90deg, ${dotColor}, #e2e8f0)`
                            : connectorColor,
                      }}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Status text */}
      <motion.div
        key={phase}
        data-testid="phase-status-text"
        className="text-center text-sm mt-3"
        style={{ color: meta.color }}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {t("phase_" + phase)}
      </motion.div>
    </Card>
    </div>
  );
}

export default PhaseIndicator;
