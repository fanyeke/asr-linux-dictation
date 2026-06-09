import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

// ---------------------------------------------------------------------------
// Phase progress ranges (simulated)
// ---------------------------------------------------------------------------
interface PhaseRange {
  start: number;  // progress % when phase starts
  end: number;    // progress % when phase ends (target)
  color: string;  // Tailwind bg
  labelKey: string;
}

const PHASE_RANGES: Record<string, PhaseRange> = {
  recording:    { start: 0,   end: 30,  color: "bg-red-400/50", labelKey: "overlay_recording" },
  transcribing: { start: 30,  end: 60,  color: "bg-brand-500/70",  labelKey: "overlay_transcribing" },
  polishing:    { start: 60,  end: 88,  color: "bg-purple-500/70", labelKey: "overlay_polishing" },
  completed:    { start: 88,  end: 100, color: "bg-green-500",  labelKey: "overlay_completed" },
  failed:       { start: 0,   end: 0,   color: "bg-red-500",    labelKey: "overlay_failed" },
};

const TERMINAL_PHASES = new Set(["completed", "failed"]);

// ---------------------------------------------------------------------------
// Simulated advance within a phase: slower for smoother feel
// ---------------------------------------------------------------------------
const PHASE_ADVANCE_DURATION_MS = 4000;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ProgressBarProps {
  phase: string;
  partialText: string;
  micLevel?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProgressBar({
  phase,
  partialText,
  micLevel = 0,
}: ProgressBarProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const currentRange = PHASE_RANGES[phase] ?? null;
  const isRecording = phase === "recording";
  const isFailed = phase === "failed";

  // Framer Motion: continuous progress value
  const progress = useMotionValue(0);
  const barWidth = useTransform(progress, [0, 100], ["0%", "100%"]);
  const prevPhaseRef = useRef<string>("idle");

  // Show bar on first non-idle phase
  useEffect(() => {
    if (phase !== "idle" && !visible) {
      setVisible(true);
      setShowContent(true);
    }
  }, [phase, visible]);

  // Animate progress when phase changes or during simulation
  useEffect(() => {
    if (!currentRange || !visible) return;

    if (isFailed) {
      // Failed: freeze at current position, don't animate
      return;
    }

    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (phase === "completed") {
      // Completed: quick ramp to 100%
      animate(progress, 100, { duration: 0.4, ease: "easeOut" });
      // Start fade-out timer
      const hideTimer = setTimeout(() => {
        setShowContent(false);
        setTimeout(() => setVisible(false), 300);
      }, 2000);
      return () => clearTimeout(hideTimer);
    }

    // For active phases: smoothly advance from start → end
    const targetEnd = currentRange.end;
    const startFrom = progress.get();

    // Animate to end over the phase duration
    const anim = animate(progress, targetEnd, {
      duration: PHASE_ADVANCE_DURATION_MS / 1000,
      ease: "easeOut",
    });

    return () => anim.stop();
  }, [phase, visible, currentRange, isFailed, progress]);

  if (!visible || !currentRange) return <div />;

  const baseBarClass = `h-full rounded-full transition-colors duration-500`;
  const pulseClass = !TERMINAL_PHASES.has(phase) && !isRecording ? "animate-pulse" : "";

  // Failed: flash red
  const barColor = isFailed ? "bg-red-500" : currentRange.color;

  return (
    <div
      data-testid="progress-bar"
      className={`overflow-hidden transition-opacity duration-300 ${
        showContent ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* ── Progress bar track (thin) ── */}
      <div className="w-full h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden relative">
        {/* Main animated bar */}
        <motion.div
          data-testid="progress-bar-fill"
          className={`${baseBarClass} ${barColor} ${pulseClass}`}
          style={{ width: barWidth }}
        />

        {/* Mic level wave overlay (recording only) */}
        {isRecording && micLevel > 0 && (
          <div
            data-testid="mic-wave-overlay"
            className="absolute top-0 h-full bg-white/30 rounded-full"
            style={{
              width: `${Math.min(Math.max(micLevel * 100, 0), 100)}%`,
              transition: "width 0.08s ease",
            }}
          />
        )}
      </div>

      {/* ── Partial transcript text ── */}
      {partialText && (
        <div
          data-testid="partial-text"
          className="mt-1 text-xs text-white/70 truncate max-w-full"
        >
          {partialText}
        </div>
      )}
    </div>
  );
}
