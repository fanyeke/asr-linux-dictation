/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryPage } from "../HistoryPage.js";
import type { BackendConfig, HistorySession } from "../../settings/types.js";

const mockBackendConfig: BackendConfig = {
  url: "http://127.0.0.1:42003",
  token: "test-token-12345678",
};

const mockSessions: HistorySession[] = [
  {
    id: 1,
    session_id: "sess-001",
    raw_text: "Hello world",
    polished_text: "Hello world!",
    status: "completed",
    timing_ms: 1500,
    prompt_id: null,
    error_type: null,
    created_at: "2025-06-05T10:00:00Z",
  },
  {
    id: 2,
    session_id: "sess-002",
    raw_text: "Test dictation session",
    polished_text: null,
    status: "failed",
    timing_ms: null,
    prompt_id: null,
    error_type: "asr_error",
    created_at: "2025-06-05T11:00:00Z",
  },
];

const emptySessions: HistorySession[] = [];

describe("HistoryPage", () => {
  // 1. Renders the title
  it("renders the history title", () => {
    render(
      <HistoryPage
        history={emptySessions}
        backendConfig={mockBackendConfig}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  // 2. Shows EmptyState when no sessions
  it("shows empty state when no sessions exist", () => {
    render(
      <HistoryPage
        history={emptySessions}
        backendConfig={mockBackendConfig}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
    expect(
      screen.getByText("Your dictation history will appear here"),
    ).toBeInTheDocument();
  });

  // 3. Renders session list items when history exists
  it("renders session items for each history entry", () => {
    render(
      <HistoryPage
        history={mockSessions}
        backendConfig={mockBackendConfig}
        onRefresh={vi.fn()}
      />,
    );
    // Should show session headers
    expect(screen.getByTestId("session-header-1")).toBeInTheDocument();
    expect(screen.getByTestId("session-header-2")).toBeInTheDocument();
  });

  // 4. Shows status badges for sessions
  it("displays status badges for sessions", () => {
    render(
      <HistoryPage
        history={mockSessions}
        backendConfig={mockBackendConfig}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  // 5. Refresh button exists
  it("has a refresh button", () => {
    render(
      <HistoryPage
        history={mockSessions}
        backendConfig={mockBackendConfig}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByTestId("refresh-history-btn")).toBeInTheDocument();
  });

  // 6. Calls onRefresh when refresh button clicked
  it("calls onRefresh when refresh button is clicked", () => {
    const onRefresh = vi.fn();
    render(
      <HistoryPage
        history={mockSessions}
        backendConfig={mockBackendConfig}
        onRefresh={onRefresh}
      />,
    );
    fireEvent.click(screen.getByTestId("refresh-history-btn"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  // 7. Clicking a session header expands it
  it("expands a session item on click", () => {
    render(
      <HistoryPage
        history={mockSessions}
        backendConfig={mockBackendConfig}
        onRefresh={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId("session-detail-1"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByTestId("session-detail-1")).toBeInTheDocument();
  });

  // 8. Shows raw text when session is expanded
  it("displays raw text when session is expanded", () => {
    render(
      <HistoryPage
        history={mockSessions}
        backendConfig={mockBackendConfig}
        onRefresh={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  // 9. Shows retry button for failed sessions
  it("shows retry button for failed sessions when expanded", () => {
    render(
      <HistoryPage
        history={mockSessions}
        backendConfig={mockBackendConfig}
        onRefresh={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("session-header-2"));
    expect(screen.getByTestId("retry-btn-2")).toBeInTheDocument();
  });

  // 10. Does not show empty state when history has items
  it("does not show empty state when sessions exist", () => {
    render(
      <HistoryPage
        history={mockSessions}
        backendConfig={mockBackendConfig}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });
});
