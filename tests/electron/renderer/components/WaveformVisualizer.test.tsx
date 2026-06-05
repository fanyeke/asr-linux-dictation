/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WaveformVisualizer } from "../../../../src/electron/renderer/components/WaveformVisualizer";

describe("WaveformVisualizer", () => {
  beforeEach(() => {
    // Mock requestAnimationFrame
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (_cb: FrameRequestCallback) => 1,
    );

    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(
      (_handle: number) => {},
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders canvas element", () => {
    render(
      <WaveformVisualizer
        micLevel={0}
        isRecording={false}
        phase="idle"
      />,
    );

    const canvas = screen.getByTestId("waveform-canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe("CANVAS");
  });

  it("sets correct width and height via style", () => {
    render(
      <WaveformVisualizer
        micLevel={0.5}
        isRecording={true}
        phase="recording"
        width={400}
        height={64}
      />,
    );

    const canvas = screen.getByTestId("waveform-canvas") as HTMLCanvasElement;
    expect(canvas.style.width).toBe("400px");
    expect(canvas.style.height).toBe("64px");
  });

  it("accepts custom barCount", () => {
    render(
      <WaveformVisualizer
        micLevel={0}
        isRecording={false}
        phase="idle"
        barCount={20}
      />,
    );

    expect(screen.getByTestId("waveform-canvas")).toBeInTheDocument();
  });

  it("sets aria-label on canvas", () => {
    render(
      <WaveformVisualizer
        micLevel={0}
        isRecording={false}
        phase="idle"
      />,
    );

    const canvas = screen.getByTestId("waveform-canvas");
    expect(canvas).toHaveAttribute(
      "aria-label",
      "Microphone level waveform visualization",
    );
  });

  it("renders in recording state", () => {
    render(
      <WaveformVisualizer
        micLevel={0.8}
        isRecording={true}
        phase="recording"
      />,
    );

    expect(screen.getByTestId("waveform-canvas")).toBeInTheDocument();
  });

  it("handles silent micLevel correctly", () => {
    render(
      <WaveformVisualizer
        micLevel={0.01}
        isRecording={true}
        phase="recording"
      />,
    );

    expect(screen.getByTestId("waveform-canvas")).toBeInTheDocument();
  });
});
