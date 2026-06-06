import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryPage } from "../HistoryPage.js";
import type { HistorySession } from "../../settings/types.js";

vi.mock("framer-motion", () => ({
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("../../lib/i18n.js", () => ({
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
        result_raw: "Raw",
        result_polished: "Polished",
        result_error: "Error",
        copy: "Copy",
        copied: "Copied!",
        export_history: "Export",
        export_format_txt: "Text",
        export_format_md: "Markdown",
        export_title: "Export",
        cancel: "Cancel",
        open_audio: "Audio",
      };
      return map[key] || key;
    },
    language: "en",
    setLanguage: vi.fn(),
  }),
}));

const mockSessions: HistorySession[] = [
  {
    id: 1, session_id: "sess-001",
    raw_text: "Hello world", polished_text: "Hello world!",
    status: "completed", timing_ms: 1500,
    prompt_id: null, error_type: null,
    failed_audio_path: null, created_at: "2025-06-05T10:00:00Z",
  },
  {
    id: 2, session_id: "sess-002",
    raw_text: "Test dictation", polished_text: null,
    status: "failed", timing_ms: null,
    prompt_id: null, error_type: "asr_error",
    failed_audio_path: null, created_at: "2025-06-05T11:00:00Z",
  },
];

const mockConfig = { url: "http://localhost:8000", token: "test-token" };

describe("HistoryPage", () => {
  it("renders the history title", () => {
    render(<HistoryPage history={[]} backendConfig={mockConfig} onRefresh={vi.fn()} />);
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("shows empty state when no history", () => {
    render(<HistoryPage history={[]} backendConfig={mockConfig} onRefresh={vi.fn()} />);
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  it("renders history rows", () => {
    render(<HistoryPage history={mockSessions} backendConfig={mockConfig} onRefresh={vi.fn()} />);
    expect(screen.getByTestId("session-header-1")).toBeInTheDocument();
    expect(screen.getByTestId("session-header-2")).toBeInTheDocument();
  });

  it("shows status badges", () => {
    render(<HistoryPage history={mockSessions} backendConfig={mockConfig} onRefresh={vi.fn()} />);
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("expands a row", () => {
    render(<HistoryPage history={mockSessions} backendConfig={mockConfig} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByTestId("session-detail-1")).toBeInTheDocument();
  });

  it("shows retry button for failed sessions", () => {
    render(<HistoryPage history={mockSessions} backendConfig={mockConfig} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByTestId("session-header-2"));
    expect(screen.getByTestId("retry-btn-2")).toBeInTheDocument();
  });

  it("shows error type for failed sessions", () => {
    render(<HistoryPage history={mockSessions} backendConfig={mockConfig} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByTestId("session-header-2"));
    expect(screen.getByText("Error: asr_error")).toBeInTheDocument();
  });

  it("calls refresh when refresh button is clicked", () => {
    const onRefresh = vi.fn();
    render(<HistoryPage history={mockSessions} backendConfig={mockConfig} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByTestId("refresh-history-btn"));
    expect(onRefresh).toHaveBeenCalled();
  });
});
