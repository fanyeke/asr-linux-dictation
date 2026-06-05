/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HistoryPage } from "../../../../src/electron/renderer/components/HistoryPage";

// Mock framer-motion to render children directly
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, animate, exit, transition, variants, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("../../../../src/electron/renderer/lib/i18n.js", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        history_title: "History",
        no_history: "No sessions yet",
        no_history_desc: "Your dictation history will appear here",
        refresh: "Refresh",
        retry: "Retry",
        status_completed: "completed",
        status_failed: "failed",
        result_raw: "Raw transcription",
        result_polished: "Polished result",
        result_error: "Error",
      };
      return map[key] || key;
    },
    language: "en",
    setLanguage: vi.fn(),
  }),
}));

const mockHistory = [
  {
    id: 1,
    session_id: "sess_001",
    raw_text: "hello world from ASR",
    polished_text: "Hello, world from ASR!",
    status: "completed",
    timing_ms: 1500,
    prompt_id: null,
    error_type: null,
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: 2,
    session_id: "sess_002",
    raw_text: "transcription failed text",
    polished_text: null,
    status: "failed",
    timing_ms: null,
    prompt_id: null,
    error_type: "asr:timeout",
    created_at: "2025-01-02T00:00:00Z",
  },
];

const mockConfig = { url: "http://localhost:8000", token: "test-token" };

describe("HistoryPage", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "completed" }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the history title", () => {
    render(
      <HistoryPage history={[]} backendConfig={mockConfig} onRefresh={vi.fn()} />,
    );

    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("shows empty state when no history", () => {
    render(
      <HistoryPage history={[]} backendConfig={mockConfig} onRefresh={vi.fn()} />,
    );

    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
    expect(
      screen.getByText("Your dictation history will appear here"),
    ).toBeInTheDocument();
  });

  it("renders history rows", () => {
    render(
      <HistoryPage
        history={mockHistory}
        backendConfig={mockConfig}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByTestId("session-header-1")).toBeInTheDocument();
    expect(screen.getByTestId("session-header-2")).toBeInTheDocument();
  });

  it("shows status badges", () => {
    render(
      <HistoryPage
        history={mockHistory}
        backendConfig={mockConfig}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("expands a row to show ASR and LLM text", async () => {
    render(
      <HistoryPage
        history={mockHistory}
        backendConfig={mockConfig}
        onRefresh={vi.fn()}
      />,
    );

    // Click on the first row header to expand
    fireEvent.click(screen.getByTestId("session-header-1"));

    // With mocked AnimatePresence, detail is always visible
    expect(screen.getByTestId("session-detail-1")).toBeInTheDocument();

    // Should show ASR and LLM labels
    expect(screen.getByText("ASR")).toBeInTheDocument();
    expect(screen.getByText("LLM")).toBeInTheDocument();
  });

  it("shows retry button for failed sessions with raw text", async () => {
    render(
      <HistoryPage
        history={mockHistory}
        backendConfig={mockConfig}
        onRefresh={vi.fn()}
      />,
    );

    // Expand the failed session
    fireEvent.click(screen.getByTestId("session-header-2"));

    expect(screen.getByTestId("retry-btn-2")).toBeInTheDocument();
  });

  it("shows error type for failed sessions", async () => {
    render(
      <HistoryPage
        history={mockHistory}
        backendConfig={mockConfig}
        onRefresh={vi.fn()}
      />,
    );

    // Expand the failed session
    fireEvent.click(screen.getByTestId("session-header-2"));

    expect(screen.getByText("Error: asr:timeout")).toBeInTheDocument();
  });

  it("calls refresh when refresh button is clicked", () => {
    const onRefresh = vi.fn();
    render(
      <HistoryPage
        history={mockHistory}
        backendConfig={mockConfig}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.click(screen.getByTestId("refresh-history-btn"));
    expect(onRefresh).toHaveBeenCalled();
  });
});
