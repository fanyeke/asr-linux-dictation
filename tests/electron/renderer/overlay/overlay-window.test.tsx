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

/** Map of phase → expected Tailwind bg class on the status dot */
const DOT_COLORS: Record<string, string> = {
  idle: "bg-gray-500",
  recording: "bg-red-500",
  transcribing: "bg-brand-500",
  polishing: "bg-purple-500",
  failed: "bg-red-500",
};

/** Check that a status dot has the expected background class for a phase */
function expectDotColorForPhase(phase: string): void {
  const dot = screen.getByTestId("status-dot");
  expect(dot).toBeDefined();
  expect(dot.className).toContain(DOT_COLORS[phase]);
}

/** Return the current status label text */
function getLabel(): string {
  const el = screen.getByTestId("status-label");
  return el.textContent ?? "";
}

/** Return true when the level bar element is present */
function hasLevelBar(): boolean {
  return screen.queryByTestId("level-bar") !== null;
}

/** Return the fill width as a percentage string (e.g. "50%") */
function getLevelBarWidth(): string {
  const fill = screen.getByTestId("level-bar-fill");
  return fill.style.width;
}

/** Return true when the mini step bar is present */
function hasStepBar(): boolean {
  return screen.queryByTestId("step-bar") !== null;
}

/** Return the state attribute for a given step dot */
function getStepState(stepKey: string): string | null {
  const dot = screen.queryByTestId(`step-dot-${stepKey}`);
  return dot?.getAttribute("data-state") ?? null;
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

function createMockAPI(): VoiceAPI {
  onStatusCb = null;
  onLevelCb = null;
  return {
    getBackendConfig: vi.fn(),
    startDictation: vi.fn(),
    stopDictation: vi.fn(),
    showOverlay: vi.fn(),
    hideOverlay: vi.fn(),
    onToggleDictation: vi.fn(),
    getHotkey: vi.fn(),
    setHotkey: vi.fn(),
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
    expect(hasLevelBar()).toBe(false);
    expect(hasStepBar()).toBe(false);
    expect(hasTimer()).toBe(false);
  });

  it("renders recording status with label", () => {
    render(<OverlayWindow initialStatus={{ phase: "recording" }} />);

    expect(getLabel()).toBe("Recording...");
    expectDotColorForPhase("recording");
  });

  // ── Level bar ───────────────────────────────────────────────────────

  it("shows level bar during recording", () => {
    render(<OverlayWindow initialStatus={{ phase: "recording" }} />);

    expect(hasLevelBar()).toBe(true);
  });

  it("shows level bar during transcribing", () => {
    render(<OverlayWindow initialStatus={{ phase: "transcribing" }} />);

    expect(hasLevelBar()).toBe(true);
  });

  it("shows level bar during polishing", () => {
    render(<OverlayWindow initialStatus={{ phase: "polishing" }} />);

    expect(hasLevelBar()).toBe(true);
  });

  it("shows level bar during completed", () => {
    render(<OverlayWindow initialStatus={{ phase: "completed" }} />);

    expect(hasLevelBar()).toBe(true);
  });

  it("shows level bar during failed", () => {
    render(
      <OverlayWindow
        initialStatus={{ phase: "failed", error: "err" }}
      />,
    );

    expect(hasLevelBar()).toBe(true);
  });

  it("hides level bar when idle", () => {
    render(<OverlayWindow />);

    expect(hasLevelBar()).toBe(false);
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

  // ── Step bar ────────────────────────────────────────────────────────

  it("shows step bar during recording with correct states", () => {
    render(<OverlayWindow initialStatus={{ phase: "recording" }} />);

    expect(hasStepBar()).toBe(true);
    expect(getStepState("recording")).toBe("current");
    expect(getStepState("transcribing")).toBe("pending");
    expect(getStepState("polishing")).toBe("pending");
    expect(getStepState("completed")).toBe("pending");
  });

  it("shows correct step states for transcribing", () => {
    render(<OverlayWindow initialStatus={{ phase: "transcribing" }} />);

    expect(getStepState("recording")).toBe("completed");
    expect(getStepState("transcribing")).toBe("current");
    expect(getStepState("polishing")).toBe("pending");
    expect(getStepState("completed")).toBe("pending");
  });

  it("shows correct step states for polishing", () => {
    render(<OverlayWindow initialStatus={{ phase: "polishing" }} />);

    expect(getStepState("recording")).toBe("completed");
    expect(getStepState("transcribing")).toBe("completed");
    expect(getStepState("polishing")).toBe("current");
    expect(getStepState("completed")).toBe("pending");
  });

  it("shows all steps completed for completed phase", () => {
    render(<OverlayWindow initialStatus={{ phase: "completed" }} />);

    expect(getStepState("recording")).toBe("completed");
    expect(getStepState("transcribing")).toBe("completed");
    expect(getStepState("polishing")).toBe("completed");
    expect(getStepState("completed")).toBe("completed");
  });

  it("shows last step current for failed phase", () => {
    render(
      <OverlayWindow
        initialStatus={{ phase: "failed", error: "err" }}
      />,
    );

    expect(getStepState("recording")).toBe("completed");
    expect(getStepState("transcribing")).toBe("completed");
    expect(getStepState("polishing")).toBe("completed");
    expect(getStepState("completed")).toBe("current");
  });

  it("hides step bar when idle", () => {
    render(<OverlayWindow />);
    expect(hasStepBar()).toBe(false);
  });

  it("step bar reacts to phase transitions", () => {
    render(<OverlayWindow />);

    expect(hasStepBar()).toBe(false);

    act(() => {
      onStatusCb!({ phase: "recording" });
    });
    expect(hasStepBar()).toBe(true);
    expect(getStepState("recording")).toBe("current");

    act(() => {
      onStatusCb!({ phase: "transcribing" });
    });
    expect(getStepState("recording")).toBe("completed");
    expect(getStepState("transcribing")).toBe("current");

    act(() => {
      onStatusCb!({ phase: "completed" });
    });
    expect(getStepState("recording")).toBe("completed");
    expect(getStepState("transcribing")).toBe("completed");
    expect(getStepState("polishing")).toBe("completed");
    expect(getStepState("completed")).toBe("completed");
  });

  // ── Mic level updates ───────────────────────────────────────────────

  it("level updates when onMicrophoneLevel fires", () => {
    render(<OverlayWindow initialStatus={{ phase: "recording" }} />);

    expect(hasLevelBar()).toBe(true);
    expect(getLevelBarWidth()).toBe("0%");

    // Fire level update
    act(() => {
      onLevelCb!(0.5);
    });
    expect(getLevelBarWidth()).toBe("50%");

    act(() => {
      onLevelCb!(1.0);
    });
    expect(getLevelBarWidth()).toBe("100%");

    act(() => {
      onLevelCb!(0.0);
    });
    expect(getLevelBarWidth()).toBe("0%");
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
    expect(hasLevelBar()).toBe(true);
    expect(hasTimer()).toBe(true);

    // transcribing
    act(() => {
      onStatusCb!({ phase: "transcribing" });
    });
    await waitFor(() => expect(getLabel()).toBe("Transcribing..."));
    expectDotColorForPhase("transcribing");
    expect(hasLevelBar()).toBe(true);
    expect(hasTimer()).toBe(false);
    expect(getStepState("recording")).toBe("completed");
    expect(getStepState("transcribing")).toBe("current");

    // polishing
    act(() => {
      onStatusCb!({ phase: "polishing" });
    });
    await waitFor(() => expect(getLabel()).toBe("Polishing..."));
    expectDotColorForPhase("polishing");
    expect(hasLevelBar()).toBe(true);

    // failed
    act(() => {
      onStatusCb!({
        phase: "failed",
        error: "something went wrong",
      });
    });
    await waitFor(() => expect(getLabel()).toBe("Failed"));
    expectDotColorForPhase("failed");
    expect(hasLevelBar()).toBe(true);

    // back to idle
    act(() => {
      onStatusCb!({ phase: "idle" });
    });
    await waitFor(() => expect(getLabel()).toBe("Ready"));
    expect(hasLevelBar()).toBe(false);
    expect(hasStepBar()).toBe(false);
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
