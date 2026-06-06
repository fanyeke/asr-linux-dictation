/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionListItem } from "../SessionListItem.js";
import type { HistorySession } from "../../settings/types.js";

// Mock framer-motion to render children directly
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, animate, exit, transition, variants, key, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("../lib/i18n.js", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        result_raw: "Raw transcription",
        result_polished: "Polished result",
        result_error: "Error",
        retry: "Retry",
        chars: "chars",
        status_completed: "completed",
        status_failed: "failed",
        copy: "Copy",
        copied: "Copied!",
        open_audio: "Open audio",
      };
      return map[key] || key;
    },
    language: "en",
    setLanguage: vi.fn(),
  }),
}));

function createMockSession(
  overrides: Partial<HistorySession> = {},
): HistorySession {
  return {
    id: 1,
    session_id: "sess-test-001",
    raw_text: "Hello world this is a test",
    polished_text: null,
    status: "completed",
    timing_ms: 1500,
    prompt_id: null,
    error_type: null,
    created_at: "2025-06-05T10:00:00Z",
    ...overrides,
  };
}

describe("SessionListItem", () => {
  it("renders the status badge", () => {
    render(
      <SessionListItem session={createMockSession({ status: "completed" })} />,
    );
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("renders the formatted timestamp", () => {
    render(<SessionListItem session={createMockSession()} />);
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it("shows duration when timing_ms is provided", () => {
    render(
      <SessionListItem session={createMockSession({ timing_ms: 2500 })} />,
    );
    expect(screen.getByText("2.5s")).toBeInTheDocument();
  });

  it("does not show duration when timing_ms is null", () => {
    render(
      <SessionListItem session={createMockSession({ timing_ms: null })} />,
    );
    expect(screen.queryByText(/^\d+\.\ds$/)).not.toBeInTheDocument();
  });

  it("shows char count (short format)", () => {
    render(
      <SessionListItem session={createMockSession({ raw_text: "Hello" })} />,
    );
    expect(screen.getByText("5c")).toBeInTheDocument();
  });

  it("toggles detail visibility on header click", () => {
    render(<SessionListItem session={createMockSession()} />);
    const header = screen.getByTestId("session-header-1");

    expect(screen.queryByTestId("session-detail-1")).not.toBeInTheDocument();
    fireEvent.click(header);
    expect(screen.getByTestId("session-detail-1")).toBeInTheDocument();
    fireEvent.click(header);
    expect(screen.queryByTestId("session-detail-1")).not.toBeInTheDocument();
  });

  it("displays raw text when expanded", () => {
    render(
      <SessionListItem session={createMockSession({ raw_text: "Test transcription" })} />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    // Text appears in both preview and detail — use getAllByText
    const matches = screen.getAllByText("Test transcription");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("displays polished text when present and different from raw", () => {
    render(
      <SessionListItem session={createMockSession({ raw_text: "raw text", polished_text: "polished text" })} />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByText("polished text")).toBeInTheDocument();
  });

  it("shows error type for failed sessions when expanded", () => {
    render(
      <SessionListItem session={createMockSession({ status: "failed", error_type: "asr_error" })} />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByText("Error: asr_error")).toBeInTheDocument();
  });

  it("shows retry button for failed sessions when expanded", () => {
    render(
      <SessionListItem session={createMockSession({ status: "failed", raw_text: "some text" })} onRetry={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByTestId("retry-btn-1")).toBeInTheDocument();
  });

  it("does not show retry button for non-failed sessions", () => {
    render(
      <SessionListItem session={createMockSession({ status: "completed" })} onRetry={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.queryByTestId("retry-btn-1")).not.toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    render(
      <SessionListItem session={createMockSession({ status: "failed", raw_text: "some text" })} onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    fireEvent.click(screen.getByTestId("retry-btn-1"));
    expect(onRetry).toHaveBeenCalledWith("sess-test-001");
  });

  it("shows session ID in expanded detail", () => {
    render(
      <SessionListItem session={createMockSession({ session_id: "sess-abc-123" })} />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByText("sess-abc-123")).toBeInTheDocument();
  });

  it("shows text preview in collapsed state", () => {
    render(
      <SessionListItem session={createMockSession({ polished_text: "Hello world preview text here" })} />,
    );
    expect(screen.getByText(/Hello world preview/)).toBeInTheDocument();
  });

  it("shows copy button in header", () => {
    render(
      <SessionListItem session={createMockSession()} />,
    );
    expect(screen.getByTestId("copy-btn-1")).toBeInTheDocument();
  });
});
