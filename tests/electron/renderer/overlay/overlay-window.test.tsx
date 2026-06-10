import "@testing-library/jest-dom";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { OverlayWindow } from "../../../../src/electron/renderer/overlay/overlay-window.js";
import type {
  DictationStatus,
  VoiceAPI,
} from "../../../../src/electron/renderer/overlay/types.js";

vi.mock("src/electron/renderer/lib/i18n.js", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        overlay_ready: "Ready",
        overlay_recording: "Recording...",
        overlay_transcribing: "Transcribing...",
        overlay_polishing: "Polishing...",
        overlay_completed: "Done",
        overlay_failed: "Failed",
        overlay_network_slow: "Network is slow, please wait",
      };
      return map[key] || key;
    },
    language: "en",
    setLanguage: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map of phase → expected CSS variable for the status dot background */
const DOT_COLORS: Record<string, string> = {
  idle: "var(--muted-foreground)",
  recording: "var(--status-recording)",
  transcribing: "var(--primary)",
  polishing: "var(--purple-500)",
  completed: "var(--status-success)",
  failed: "var(--status-error)",
};

/** Check that a status dot has the expected background via inline style */
function expectDotColorForPhase(phase: string): void {
  const dot = screen.getByTestId("status-dot");
  expect(dot).toBeDefined();
  expect(dot).toHaveStyle(`background: ${DOT_COLORS[phase]}`);
}

/** Return the current status label text */
function getLabel(): string {
  const el = screen.getByTestId("status-label");
  return el.textContent ?? "";
}

/** Return true when the progress bar element is present */
function hasProgressBar(): boolean {
  return screen.queryByTestId("progress-bar") !== null;
}

/** Return the fill width as a percentage string */
function getProgressWidth(): string {
  const fill = screen.getByTestId("progress-bar-fill");
  return fill.style.width;
}

/** Return true when the timer element is present */
function hasTimer(): boolean {
  return screen.queryByTestId("timer") !== null;
}

// ---------------------------------------------------------------------------
// Mock voiceAPI
// ---------------------------------------------------------------------------

let onStatusCb: ((s: DictationStatus) => void) | null = null;
let onLevelCb: ((level: number) => void) | null = null;
let onPartialCb: ((text: string) => void) | null = null;

function createMockAPI(): VoiceAPI {
  onStatusCb = null;
  onLevelCb = null;
  onPartialCb = null;
  return {
    getBackendConfig: vi.fn(),
    startDictation: vi.fn(),
    stopDictation: vi.fn(),
    showOverlay: vi.fn(),
    hideOverlay: vi.fn(),
    onToggleDictation: vi.fn(),
    getHotkey: vi.fn(),
    setHotkey: vi.fn(),
    copyToClipboard: vi.fn(),
    onStatusUpdate: vi.fn((cb: (s: DictationStatus) => void) => {
      onStatusCb = cb;
      return () => {
        onStatusCb = null;
      };
    }),
    onMicrophoneLevel: vi.fn((cb: (level: number) => void) => {
      onLevelCb = cb;
      return () => {
        onLevelCb = null;
      };
    }),
    onPartialTranscript: vi.fn((cb: (text: string) => void) => {
      onPartialCb = cb;
      return () => {
        onPartialCb = null;
      };
    }),
    revealFile: vi.fn(),
  };
}

beforeEach(() => {
  window.voiceAPI = createMockAPI();
});

afterEach(() => {
  delete (window as any).voiceAPI;
  onStatusCb = null;
  onLevelCb = null;
  onPartialCb = null;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OverlayWindow", () => {
  // ── Status rendering ─────────────────────────────────────────────────

  it("renders idle status", () => {
    render(<OverlayWindow />);

    expect(getLabel()).toBe("Ready");
    expectDotColorForPhase("idle");
    expect(hasProgressBar()).toBe(false);
    expect(hasTimer()).toBe(false);
  });

  it("renders recording status with label", () => {
    render(<OverlayWindow initialStatus={{ phase: "recording" }} />);

    expect(getLabel()).toBe("Recording...");
    expectDotColorForPhase("recording");
  });

  it("renders transcribing status with label", () => {
    render(<OverlayWindow initialStatus={{ phase: "transcribing" }} />);

    expect(getLabel()).toBe("Transcribing...");
    expectDotColorForPhase("transcribing");
  });

  it("renders polishing status with label", () => {
    render(<OverlayWindow initialStatus={{ phase: "polishing" }} />);

    expect(getLabel()).toBe("Polishing...");
    expectDotColorForPhase("polishing");
  });

  it("renders completed status with label", async () => {
    render(<OverlayWindow initialStatus={{ phase: "completed" }} />);

    expect(getLabel()).toBe("Done");
    expectDotColorForPhase("completed");
    // Progress bar shows initially (fades out after 2s)
    await waitFor(() => expect(hasProgressBar()).toBe(true));
  });

  // ── Progress bar ─────────────────────────────────────────────────────

  it("shows progress bar during recording", () => {
    render(<OverlayWindow initialStatus={{ phase: "recording" }} />);
    expect(hasProgressBar()).toBe(true);
  });

  it("shows progress bar during transcribing", () => {
    render(<OverlayWindow initialStatus={{ phase: "transcribing" }} />);
    expect(hasProgressBar()).toBe(true);
  });

  it("shows progress bar during polishing", () => {
    render(<OverlayWindow initialStatus={{ phase: "polishing" }} />);
    expect(hasProgressBar()).toBe(true);
  });

  it("shows progress bar during completed", () => {
    render(<OverlayWindow initialStatus={{ phase: "completed" }} />);
    expect(hasProgressBar()).toBe(true);
  });

  it("shows progress bar during failed", () => {
    render(
      <OverlayWindow
        initialStatus={{ phase: "failed", error: "err" }}
      />,
    );
    expect(hasProgressBar()).toBe(true);
  });

  it("hides progress bar when idle", () => {
    render(<OverlayWindow />);
    expect(hasProgressBar()).toBe(false);
  });

  // ── Timer ───────────────────────────────────────────────────────────

  it("shows timer during recording and updates elapsed time", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    render(<OverlayWindow initialStatus={{ phase: "recording" }} />);

    expect(hasTimer()).toBe(true);
    expect(screen.getByTestId("timer").textContent).toBe("0.0s");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("timer").textContent).toBe("0.5s");

    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(screen.getByTestId("timer").textContent).toBe("1.8s");

    vi.useRealTimers();
  });

  it("hides timer when not recording", () => {
    render(<OverlayWindow />);
    expect(hasTimer()).toBe(false);

    render(<OverlayWindow initialStatus={{ phase: "transcribing" }} />);
    expect(hasTimer()).toBe(false);
  });

  it("resets timer when transitioning between phases", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    render(<OverlayWindow />);

    // Transition to recording
    act(() => {
      onStatusCb!({ phase: "recording" });
    });
    expect(hasTimer()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByTestId("timer").textContent).toBe("1.2s");

    // Transition away — timer disappears
    act(() => {
      onStatusCb!({ phase: "transcribing" });
    });
    expect(hasTimer()).toBe(false);

    vi.useRealTimers();
  });

  // ── Mic level wave (still rendered during recording) ────────────────

  it("shows mic wave overlay during recording with level", () => {
    render(<OverlayWindow initialStatus={{ phase: "recording" }} />);

    expect(hasProgressBar()).toBe(true);
    expect(screen.queryByTestId("mic-wave-overlay")).toBeNull();

    act(() => {
      onLevelCb!(0.5);
    });
    expect(screen.getByTestId("mic-wave-overlay")).toBeDefined();
  });

  // ── Slow-network warning ──────────────────────────────────────────────

  it("shows network warning when transcribing exceeds 3s threshold", () => {
    vi.useFakeTimers();
    render(<OverlayWindow initialStatus={{ phase: "transcribing" }} />);

    // Initially no warning
    expect(screen.queryByTestId("slow-warning")).toBeNull();

    // Advance past 3s
    act(() => {
      vi.advanceTimersByTime(3200);
    });
    expect(screen.getByTestId("slow-warning")).toBeDefined();
    expect(screen.getByTestId("slow-warning").textContent).toBe(
      "Network is slow, please wait",
    );

    vi.useRealTimers();
  });

  it("shows network warning when polishing exceeds 2.5s threshold", () => {
    vi.useFakeTimers();
    render(<OverlayWindow initialStatus={{ phase: "polishing" }} />);

    expect(screen.queryByTestId("slow-warning")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(2700);
    });
    expect(screen.getByTestId("slow-warning")).toBeDefined();

    vi.useRealTimers();
  });

  it("does not show warning within threshold for transcribing", () => {
    vi.useFakeTimers();
    render(<OverlayWindow initialStatus={{ phase: "transcribing" }} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId("slow-warning")).toBeNull();

    vi.useRealTimers();
  });

  it("hides network warning when phase changes to completed", () => {
    vi.useFakeTimers();
    render(<OverlayWindow />);

    // Trigger warning by going into transcribing and waiting past threshold
    act(() => {
      onStatusCb!({ phase: "transcribing" });
    });
    act(() => {
      vi.advanceTimersByTime(3200);
    });
    expect(screen.getByTestId("slow-warning")).toBeDefined();

    // Phase changes to completed — warning disappears
    act(() => {
      onStatusCb!({ phase: "completed" });
    });
    expect(screen.queryByTestId("slow-warning")).toBeNull();

    vi.useRealTimers();
  });

  it("hides network warning when phase changes to idle", () => {
    vi.useFakeTimers();
    render(<OverlayWindow />);

    act(() => {
      onStatusCb!({ phase: "polishing" });
    });
    act(() => {
      vi.advanceTimersByTime(2700);
    });
    expect(screen.getByTestId("slow-warning")).toBeDefined();

    // Back to idle
    act(() => {
      onStatusCb!({ phase: "idle" });
    });
    expect(screen.queryByTestId("slow-warning")).toBeNull();

    vi.useRealTimers();
  });

  // ── Status transitions ──────────────────────────────────────────────

  it("status changes when onStatusUpdate fires through full pipeline", async () => {
    render(<OverlayWindow />);

    expect(getLabel()).toBe("Ready");

    // recording
    act(() => {
      onStatusCb!({ phase: "recording" });
    });
    await waitFor(() => expect(getLabel()).toBe("Recording..."));
    expectDotColorForPhase("recording");
    expect(hasProgressBar()).toBe(true);
    expect(hasTimer()).toBe(true);

    // transcribing
    act(() => {
      onStatusCb!({ phase: "transcribing" });
    });
    await waitFor(() => expect(getLabel()).toBe("Transcribing..."));
    expectDotColorForPhase("transcribing");
    expect(hasProgressBar()).toBe(true);
    expect(hasTimer()).toBe(false);

    // polishing
    act(() => {
      onStatusCb!({ phase: "polishing" });
    });
    await waitFor(() => expect(getLabel()).toBe("Polishing..."));
    expectDotColorForPhase("polishing");
    expect(hasProgressBar()).toBe(true);

    // failed
    act(() => {
      onStatusCb!({
        phase: "failed",
        error: "something went wrong",
      });
    });
    await waitFor(() => expect(getLabel()).toBe("Failed"));
    expectDotColorForPhase("failed");
    expect(hasProgressBar()).toBe(true);

    // back to idle
    act(() => {
      onStatusCb!({ phase: "idle" });
    });
    await waitFor(() => expect(getLabel()).toBe("Ready"));
    expect(hasProgressBar()).toBe(false);
  });

  // ── Cleanup ─────────────────────────────────────────────────────────

  it("removes event listeners on unmount", () => {
    let registeredStatusCb: ((s: DictationStatus) => void) | null = null;
    let registeredLevelCb: ((level: number) => void) | null = null;

    const mockAPI: VoiceAPI = {
      getBackendConfig: vi.fn(),
      startDictation: vi.fn(),
      stopDictation: vi.fn(),
      showOverlay: vi.fn(),
      hideOverlay: vi.fn(),
      onToggleDictation: vi.fn(),
      getHotkey: vi.fn(),
      setHotkey: vi.fn(),
      copyToClipboard: vi.fn(),
      onStatusUpdate: vi.fn((cb: (s: DictationStatus) => void) => {
        registeredStatusCb = cb;
        return () => {
          registeredStatusCb = null;
        };
      }),
      onMicrophoneLevel: vi.fn((cb: (level: number) => void) => {
        registeredLevelCb = cb;
        return () => {
          registeredLevelCb = null;
        };
      }),
      onPartialTranscript: vi.fn(),
      revealFile: vi.fn(),
    };

    window.voiceAPI = mockAPI;

    const { unmount } = render(<OverlayWindow />);

    expect(registeredStatusCb).not.toBeNull();
    expect(registeredLevelCb).not.toBeNull();
    expect(mockAPI.onStatusUpdate).toHaveBeenCalledOnce();
    expect(mockAPI.onMicrophoneLevel).toHaveBeenCalledOnce();

    unmount();

    expect(registeredStatusCb).toBeNull();
    expect(registeredLevelCb).toBeNull();
  });
});
