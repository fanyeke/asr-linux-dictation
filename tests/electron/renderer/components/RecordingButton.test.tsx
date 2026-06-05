/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecordingButton } from "../../../../src/electron/renderer/components/RecordingButton";

vi.mock("../../../../src/electron/renderer/lib/i18n.js", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        start_recording: "Start Recording",
        stop_recording: "Stop Recording",
        phase_polishing: "Processing...",
      };
      return map[key] || key;
    },
    language: "en",
    setLanguage: vi.fn(),
  }),
}));

describe("RecordingButton", () => {
  const onStart = vi.fn();
  const onStop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows idle state with Mic icon and Start Recording label", () => {
    render(
      <RecordingButton
        isRecording={false}
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    expect(screen.getByTestId("recording-mic")).toBeInTheDocument();
    expect(screen.getByTestId("recording-label")).toHaveTextContent(
      "Start Recording",
    );
    expect(screen.getByTestId("recording-hotkey-hint")).toBeInTheDocument();
  });

  it("shows recording state with Square icon and Stop Recording label", () => {
    render(
      <RecordingButton
        isRecording={true}
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    expect(screen.getByTestId("recording-square")).toBeInTheDocument();
    expect(screen.getByTestId("recording-label")).toHaveTextContent(
      "Stop Recording",
    );
    expect(screen.getByTestId("recording-hotkey-hint")).toBeInTheDocument();
  });

  it("shows processing state with spinner and Processing... label", () => {
    render(
      <RecordingButton
        isRecording={false}
        isProcessing={true}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    expect(screen.getByTestId("recording-spinner")).toBeInTheDocument();
    expect(screen.getByTestId("recording-label")).toHaveTextContent(
      "Processing...",
    );
    expect(
      screen.queryByTestId("recording-hotkey-hint"),
    ).not.toBeInTheDocument();
  });

  it("calls onStart when clicked in idle state", () => {
    render(
      <RecordingButton
        isRecording={false}
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    fireEvent.click(screen.getByTestId("start-recording-btn"));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
  });

  it("calls onStop when clicked in recording state", () => {
    render(
      <RecordingButton
        isRecording={true}
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    fireEvent.click(screen.getByTestId("stop-recording-btn"));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("does not call either callback when processing", () => {
    render(
      <RecordingButton
        isRecording={false}
        isProcessing={true}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    const btn = screen.getByTestId("start-recording-btn");
    fireEvent.click(btn);
    expect(onStart).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });

  it("is disabled when processing", () => {
    render(
      <RecordingButton
        isRecording={false}
        isProcessing={true}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    expect(screen.getByTestId("start-recording-btn")).toBeDisabled();
  });

  it("shows pulse ring when recording", () => {
    render(
      <RecordingButton
        isRecording={true}
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    expect(screen.getByTestId("recording-pulse-ring")).toBeInTheDocument();
  });

  it("does not show pulse ring when not recording", () => {
    render(
      <RecordingButton
        isRecording={false}
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    expect(
      screen.queryByTestId("recording-pulse-ring"),
    ).not.toBeInTheDocument();
  });

  it("renders with default size 80", () => {
    render(
      <RecordingButton
        isRecording={false}
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    const btn = screen.getByTestId("start-recording-btn");
    expect(btn).toHaveStyle({ width: "80px", height: "80px" });
  });

  it("renders with custom size", () => {
    render(
      <RecordingButton
        isRecording={false}
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
        size={100}
      />,
    );

    const btn = screen.getByTestId("start-recording-btn");
    expect(btn).toHaveStyle({ width: "100px", height: "100px" });
  });

  it("renders container with correct testid", () => {
    render(
      <RecordingButton
        isRecording={false}
        isProcessing={false}
        onStart={onStart}
        onStop={onStop}
      />,
    );

    expect(
      screen.getByTestId("recording-button-container"),
    ).toBeInTheDocument();
  });
});
