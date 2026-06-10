import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../lib/i18n.js";
import type {
  BackendConfig,
  DictationResultData,
  PipelinePhase,
} from "../settings/types.js";
import { AnimatePresence } from "framer-motion";
import { Card } from "./ui/Card.js";
import { Button } from "./ui/Button.js";
import { PhaseIndicator } from "./PhaseIndicator.js";
import { RecordingButton } from "./RecordingButton.js";
import { WaveformVisualizer } from "./WaveformVisualizer.js";
import { ResultDisplay } from "./ResultDisplay.js";

interface DictatePageProps {
  backendConfig: BackendConfig | null;
  isRecording: boolean;
  isProcessing: boolean;
  micLevel: number;
  phase: PipelinePhase;
  result: DictationResultData | null;
  error: { message: string; errorType?: string; rawText?: string } | null;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onRefreshHistory: () => Promise<void>;
}

export function DictatePage({
  isRecording,
  isProcessing,
  micLevel,
  phase,
  result,
  error,
  onStartRecording,
  onStopRecording,
}: DictatePageProps): JSX.Element {
  const { t } = useTranslation();
  const [partialText, setPartialText] = useState("");
  const partialRef = useRef<HTMLDivElement>(null);

  // Subscribe to partial transcript events during recording
  useEffect(() => {
    const api = window.voiceAPI;
    if (!api?.onPartialTranscript) return;
    return api.onPartialTranscript(setPartialText);
  }, []);

  // Clear partial text when recording stops
  useEffect(() => {
    if (!isRecording) {
      setPartialText("");
    }
  }, [isRecording]);

  // Auto-scroll partial text to show latest recognized words
  useEffect(() => {
    if (partialRef.current) {
      partialRef.current.scrollTop = partialRef.current.scrollHeight;
    }
  }, [partialText]);

  const handleStart = useCallback(async () => {
    await onStartRecording();
  }, [onStartRecording]);

  const handleStop = useCallback(async () => {
    await onStopRecording();
  }, [onStopRecording]);

  const handleQuickTest = useCallback(async () => {
    if (isRecording || isProcessing) return;
    await onStartRecording();
    setTimeout(async () => {
      await onStopRecording();
    }, 2000);
  }, [isRecording, isProcessing, onStartRecording, onStopRecording]);

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      {/* Phase indicator */}
      <PhaseIndicator phase={phase} />

      {/* Hero card - centered mic button + waveform */}
      <Card padding="lg" className="flex flex-col items-center gap-6">
        <RecordingButton
          isRecording={isRecording}
          isProcessing={isProcessing}
          onStart={handleStart}
          onStop={handleStop}
        />

        <WaveformVisualizer
          micLevel={micLevel}
          isRecording={isRecording}
          phase={phase}
          width={400}
          height={64}
          barCount={14}
        />

        {/* Partial transcript text */}
        {(isRecording && partialText) && (
          <div
            data-testid="partial-text"
            ref={partialRef}
            className="w-full h-14 text-sm text-[var(--muted-foreground)] text-left px-2 overflow-y-auto whitespace-normal break-words leading-tight"
          >
            {partialText}
          </div>
        )}

        {/* Quick Test button */}
        <div className="self-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleQuickTest}
            disabled={isRecording || isProcessing}
          >
            {t("quick_test")}
          </Button>
        </div>
      </Card>

      {/* Result display */}
      <AnimatePresence>
        {(result || error) && (
          <ResultDisplay result={result} error={error} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default DictatePage;
