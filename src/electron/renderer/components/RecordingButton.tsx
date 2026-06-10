import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Mic, Square, Loader2 } from "lucide-react";
import { cn } from "../lib/utils.js";
import { useTranslation } from "../lib/i18n.js";

interface RecordingButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  onStart: () => void;
  onStop: () => void;
  size?: number;
}

export function RecordingButton({
  isRecording,
  isProcessing,
  onStart,
  onStop,
  size = 80,
}: RecordingButtonProps): JSX.Element {
  const { t } = useTranslation();
  const isDisabled = isProcessing;

  const handleClick = () => {
    if (isDisabled) return;
    if (isRecording) {
      onStop();
    } else {
      onStart();
    }
  };

  let icon: ReactNode;
  let label: string;
  let bgClass: string;

  if (isProcessing) {
    icon = <Loader2 className="h-8 w-8 animate-spin text-white" data-testid="recording-spinner" />;
    label = t("phase_polishing");
    bgClass = "bg-[var(--muted-foreground)]";
  } else if (isRecording) {
    icon = <Square className="h-8 w-8 text-white" data-testid="recording-square" />;
    label = t("stop_recording");
    bgClass = "bg-[var(--red-500)]";
  } else {
    icon = <Mic className="h-8 w-8 text-white" data-testid="recording-mic" />;
    label = t("start_recording");
    bgClass = "bg-[var(--muted-foreground)]";
  }

  return (
    <div className="flex flex-col items-center gap-3" data-testid="recording-button-container">
      <div className="relative inline-flex items-center justify-center">
        {/* Pulse ring - only when recording */}
        {isRecording && (
          <span
            className="absolute inset-0 rounded-full animate-pulse-ring pointer-events-none"
            style={{
              backgroundColor: "transparent",
              border: "2px solid var(--red-500)",
            }}
            data-testid="recording-pulse-ring"
          />
        )}

        <motion.button
          type="button"
          data-testid={isRecording ? "stop-recording-btn" : "start-recording-btn"}
          onClick={handleClick}
          disabled={isDisabled}
          whileTap={isDisabled ? undefined : { scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className={cn(
            "rounded-full flex items-center justify-center",
            "transition-colors duration-200",
            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2",
            bgClass,
            isDisabled && "opacity-60 cursor-not-allowed",
            !isDisabled && "cursor-pointer",
          )}
          style={{ width: size, height: size }}
          aria-label={label}
        >
          {icon}
        </motion.button>
      </div>

      {/* Label text */}
      <span
        className="text-sm font-medium text-[var(--muted-foreground)]"
        data-testid="recording-label"
      >
        {label}
      </span>

      {/* Hotkey hint */}
      {!isProcessing && (
        <span
          className="text-xs"
          style={{ color: "var(--text-tertiary, #94a3b8)" }}
          data-testid="recording-hotkey-hint"
        >
          Click or press Alt+=
        </span>
      )}
    </div>
  );
}

export default RecordingButton;
