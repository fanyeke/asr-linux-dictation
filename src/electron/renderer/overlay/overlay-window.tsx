import { useState, useEffect, useRef } from "react";
import type { DictationStatus } from "./types.js";
import { useTranslation } from "../lib/i18n.js";

// ---------------------------------------------------------------------------
// Phase metadata
// ---------------------------------------------------------------------------
const PHASE_META: Record<string, { color: string; label: string; dotColor: string }> = {
  idle: { color: "bg-gray-500", label: "overlay_ready", dotColor: "bg-gray-500" },
  recording: { color: "bg-red-500", label: "overlay_recording", dotColor: "bg-red-500" },
  transcribing: { color: "bg-brand-500", label: "overlay_transcribing", dotColor: "bg-brand-500" },
  polishing: { color: "bg-purple-500", label: "overlay_polishing", dotColor: "bg-purple-500" },
  inserting: { color: "bg-purple-500", label: "overlay_inserting", dotColor: "bg-purple-500" },
  completed: { color: "bg-green-500", label: "overlay_completed", dotColor: "bg-green-500" },
  failed: { color: "bg-red-500", label: "overlay_failed", dotColor: "bg-red-500" },
};

// ---------------------------------------------------------------------------
// Mini step bar config: Recording → ASR → LLM → Done
// ---------------------------------------------------------------------------
const STEPS = [
  { key: "recording", label: "overlay_recording" },
  { key: "transcribing", label: "overlay_transcribing" },
  { key: "polishing", label: "overlay_polishing" },
  { key: "completed", label: "overlay_completed" },
];

function getStepIndex(phase: string): number {
  switch (phase) {
    case "recording":
      return 0;
    case "transcribing":
      return 1;
    case "polishing":
    case "inserting":
      return 2;
    case "completed":
      return 4; // past all steps → every dot is "completed"
    case "failed":
      return 3; // last step is current
    default:
      return -1;
  }
}

// ---------------------------------------------------------------------------
// Non-processing phases (no indeterminate progress animation)
// ---------------------------------------------------------------------------
const TERMINAL_PHASES = new Set(["completed", "failed"]);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface OverlayWindowProps {
  /** For testing: provide initial status (defaults to idle) */
  initialStatus?: DictationStatus;
  /** For testing: provide initial mic level (defaults to 0) */
  initialMicLevel?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function OverlayWindow({
  initialStatus,
  initialMicLevel,
}: OverlayWindowProps): JSX.Element {
  const { t } = useTranslation();
  const [status, setStatus] = useState<DictationStatus>(
    initialStatus ?? { phase: "idle" },
  );
  const [micLevel, setMicLevel] = useState<number>(initialMicLevel ?? 0);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number>(0);

  const phase = status.phase === "inserting" ? "polishing" : status.phase;
  const meta = PHASE_META[phase] ?? PHASE_META.idle;
  const isRecording = phase === "recording";
  const stepIndex = getStepIndex(phase);
  const showBar = phase !== "idle";
  const levelPercent = Math.min(Math.max(micLevel * 100, 0), 100);

  // -----------------------------------------------------------------------
  // Timer: elapsed seconds during recording
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (phase === "recording") {
      startTimeRef.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => {
        setElapsed((Date.now() - startTimeRef.current) / 1000);
      }, 100);
      return () => clearInterval(id);
    } else {
      setElapsed(0);
    }
  }, [phase]);

  // -----------------------------------------------------------------------
  // Event listeners (voiceAPI)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const api = window.voiceAPI;
    if (!api) return;

    const unsubStatus = api.onStatusUpdate((s) => {
      setStatus(s);
    });
    const unsubLevel = api.onMicrophoneLevel((level) => {
      setMicLevel(level);
    });

    return () => {
      unsubStatus();
      unsubLevel();
    };
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div
      data-testid="overlay-window"
      className="bg-dark-900/95 backdrop-blur-md rounded-xl px-5 py-3 shadow-lg font-sans text-white select-none min-w-[280px]"
    >
      {/* ── Status row: dot + label + timer ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-3 h-3">
          <div
            data-testid="status-dot"
            className={`w-3 h-3 rounded-full ${meta.dotColor} transition-all duration-200 ${
              isRecording ? "animate-pulse" : ""
            }`}
          />
        </div>

        <span
          data-testid="status-label"
          className="text-sm font-medium transition-all duration-200"
        >
          {isRecording ? t("overlay_recording") : t(meta.label)}
        </span>

        {isRecording && (
          <span
            data-testid="timer"
            className="text-xs text-gray-400 ml-auto tabular-nums"
          >
            {elapsed.toFixed(1)}s
          </span>
        )}
      </div>

      {/* ── Level bar / progress bar ── */}
      {showBar && (
        <div data-testid="level-bar" className="overflow-hidden">
          <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
            <div
              data-testid="level-bar-fill"
              className={`h-full rounded-full transition-all duration-200 ${
                isRecording
                  ? meta.color
                  : TERMINAL_PHASES.has(phase)
                    ? meta.color
                    : `${meta.color} animate-pulse`
              }`}
              style={{
                width: isRecording ? `${levelPercent}%` : "100%",
                transition: "width 0.1s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* ── Mini step bar ── */}
      {stepIndex >= 0 && (
        <div data-testid="step-bar" className="flex items-center gap-0 mt-2.5">
          {STEPS.map((step, i) => {
            const isCompleted = i < stepIndex;
            const isCurrent = i === stepIndex;
            const stepMeta = PHASE_META[step.key];

            return (
              <div key={step.key} className="flex items-center">
                {/* Step dot */}
                <div
                  data-testid={`step-dot-${step.key}`}
                  data-state={
                    isCompleted
                      ? "completed"
                      : isCurrent
                        ? "current"
                        : "pending"
                  }
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    isCompleted
                      ? stepMeta.dotColor
                      : isCurrent
                        ? `${stepMeta.dotColor} animate-pulse`
                        : "ring-1 ring-inset ring-gray-600 bg-transparent"
                  }`}
                />

                {/* Connector line (not after last step) */}
                {i < STEPS.length - 1 && (
                  <div
                    data-testid={`step-line-${step.key}`}
                    className={`w-4 h-0.5 mx-0.5 rounded-full transition-all duration-200 ${
                      isCompleted || (isCurrent && i < stepIndex)
                        ? stepMeta.color
                        : "bg-gray-600"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
