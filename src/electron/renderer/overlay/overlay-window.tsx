import { useState, useEffect, useRef, useCallback } from "react";
import type { DictationStatus } from "./types.js";
import { useTranslation } from "../lib/i18n.js";
import { ProgressBar } from "./ProgressBar.js";

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
  const [silenceRemainingMs, setSilenceRemainingMs] = useState<number | null>(null);
  const [partialText, setPartialText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number>(0);

  const phase = status.phase;
  const showBar = phase !== "idle";

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
      // Clear partial text when no longer recording
      setPartialText("");
    }
  }, [phase]);

  // -----------------------------------------------------------------------
  // Partial transcript handler
  // -----------------------------------------------------------------------
  const handlePartialTranscript = useCallback((text: string) => {
    setPartialText(text);
  }, []);

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

    // Wire up partial transcript listener when available
    const unsubPartial =
      api.onPartialTranscript?.(handlePartialTranscript) ?? (() => {});

    return () => {
      unsubStatus();
      unsubLevel();
      unsubPartial();
    };
  }, [handlePartialTranscript]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div
      data-testid="overlay-window"
      className="bg-dark-900/95 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-lg font-sans text-white select-none min-w-[280px]"
    >
      {/* ── Status dot + label + timer ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-3 h-3">
          <div
            data-testid="status-dot"
            className={`w-3 h-3 rounded-full transition-all duration-200 ${
              phase === "recording"
                ? "bg-red-500 animate-pulse"
                : phase === "transcribing"
                  ? "bg-brand-500"
                  : phase === "polishing"
                    ? "bg-purple-500"
                    : phase === "completed"
                      ? "bg-green-500"
                      : phase === "failed"
                        ? "bg-red-500"
                        : "bg-gray-500"
            }`}
          />
        </div>

        <span
          data-testid="status-label"
          className="text-sm font-medium transition-all duration-200"
        >
          {phase === "recording"
            ? t("overlay_recording")
            : phase === "transcribing"
              ? t("overlay_transcribing")
              : phase === "polishing"
                ? t("overlay_polishing")
                : phase === "completed"
                  ? t("overlay_completed")
                  : phase === "failed"
                    ? t("overlay_failed")
                    : t("overlay_ready")}
        </span>

        {phase === "recording" && (
          <span
            data-testid="timer"
            className="text-xs text-gray-400 ml-auto tabular-nums"
          >
            {elapsed.toFixed(1)}s
          </span>
        )}
      </div>

      {/* ── Progress bar ── */}
      {showBar && (
        <ProgressBar
          phase={phase}
          partialText={partialText}
          micLevel={micLevel}
        />
      )}
    </div>
  );
}
