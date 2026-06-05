import { useEffect, useRef } from "react";
import type { PipelinePhase } from "../settings/types.js";

interface WaveformVisualizerProps {
  micLevel: number;
  isRecording: boolean;
  phase: PipelinePhase;
  width?: number;
  height?: number;
  barCount?: number;
}

const PHASE_COLORS: Record<PipelinePhase, string> = {
  idle: "#94a3b8",
  recording: "#f43f5e",
  transcribing: "#6366f1",
  polishing: "#8b5cf6",
  completed: "#10b981",
  failed: "#ef4444",
};

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

export function WaveformVisualizer({
  micLevel,
  isRecording,
  phase,
  width = 400,
  height = 64,
  barCount = 14,
}: WaveformVisualizerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothedRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const barWidth = 4;
    const barGap = (width - barCount * barWidth) / (barCount + 1);
    const baseHeight = 4;
    const maxHeight = height * 0.8;
    const color = isRecording ? PHASE_COLORS[phase] : "#e2e8f0";

    function draw(c: CanvasRenderingContext2D) {
      c.clearRect(0, 0, width, height);

      // EMA smoothing
      smoothedRef.current =
        smoothedRef.current * 0.7 + micLevel * 0.3;
      const level = smoothedRef.current;

      const isSilent = level < 0.02;

      for (let i = 0; i < barCount; i++) {
        let barHeight: number;
        if (isSilent || !isRecording) {
          barHeight = baseHeight;
        } else {
          const freq = 0.5 + 0.5 * Math.sin(i * 0.8);
          barHeight = baseHeight + level * maxHeight * freq;
        }

        const x = barGap + i * (barWidth + barGap);
        const y = height / 2 - barHeight / 2;

        // Second layer (brighter background)
        if (isRecording) {
          c.fillStyle = lightenColor(color, 80);
          c.globalAlpha = 0.4;
          c.beginPath();
          c.roundRect(x - 1, y - 1, barWidth + 2, barHeight + 2, 3);
          c.fill();
          c.globalAlpha = 1;
        }

        // Main bar
        c.fillStyle = color;
        if (isRecording && level >= 0.02) {
          c.shadowColor = color;
          c.shadowBlur = 12 * level;
        } else {
          c.shadowBlur = 0;
        }

        c.beginPath();
        c.roundRect(x, y, barWidth, barHeight, 2);
        c.fill();

        c.shadowBlur = 0;
      }

      animFrameRef.current = requestAnimationFrame(() => draw(c));
    }

    animFrameRef.current = requestAnimationFrame(() => draw(ctx));

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [micLevel, isRecording, phase, width, height, barCount]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="waveform-canvas"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        display: "block",
        borderRadius: "8px",
      }}
      aria-label="Microphone level waveform visualization"
    />
  );
}

export default WaveformVisualizer;
