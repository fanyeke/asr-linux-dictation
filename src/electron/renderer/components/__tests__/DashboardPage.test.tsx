/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardPage } from "../DashboardPage.js";
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
    raw_text: "Test dictation",
    polished_text: null,
    status: "completed",
    timing_ms: 2300,
    prompt_id: null,
    error_type: null,
    created_at: "2025-06-05T11:00:00Z",
  },
  {
    id: 3,
    session_id: "sess-003",
    raw_text: "",
    polished_text: "",
    status: "failed",
    timing_ms: null,
    prompt_id: null,
    error_type: "asr_error",
    created_at: "2025-06-05T09:00:00Z",
  },
  {
    id: 4,
    session_id: "sess-004",
    raw_text: "Another session with longer text for testing purposes",
    polished_text: null,
    status: "completed",
    timing_ms: 3200,
    prompt_id: null,
    error_type: null,
    created_at: "2025-06-04T15:00:00Z",
  },
  {
    id: 5,
    session_id: "sess-005",
    raw_text: "Short",
    polished_text: null,
    status: "recording",
    timing_ms: null,
    prompt_id: null,
    error_type: null,
    created_at: "2025-06-05T12:00:00Z",
  },
  {
    id: 6,
    session_id: "sess-006",
    raw_text: "Extra session beyond 5",
    polished_text: null,
    status: "completed",
    timing_ms: 800,
    prompt_id: null,
    error_type: null,
    created_at: "2025-06-03T10:00:00Z",
  },
];

const emptySessions: HistorySession[] = [];

describe("DashboardPage", () => {
  // 1. Renders the title
  it("renders the dashboard title", () => {
    render(
      <DashboardPage
        backendConfig={mockBackendConfig}
        history={emptySessions}
      />,
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  // 2. Shows EmptyState when no history
  it("shows empty state when no sessions exist", () => {
    render(
      <DashboardPage
        backendConfig={mockBackendConfig}
        history={emptySessions}
      />,
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  // 3. Shows stat cards with correct values
  it("displays correct stats with history data", () => {
    render(
      <DashboardPage
        backendConfig={mockBackendConfig}
        history={mockSessions}
      />,
    );

    // Active sessions: 1 (recording) + within 24h counts
    expect(screen.getByText("Active Sessions")).toBeInTheDocument();
    expect(screen.getByText("Success Rate")).toBeInTheDocument();
    expect(screen.getByText("Avg Duration")).toBeInTheDocument();
    expect(screen.getByText("Total Chars")).toBeInTheDocument();
  });

  // 4. Success rate calculation (4 completed out of 6 total = 67%)
  it("calculates success rate correctly", () => {
    render(
      <DashboardPage
        backendConfig={mockBackendConfig}
        history={mockSessions}
      />,
    );
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  // 5. Avg duration calculation
  it("calculates average duration correctly", () => {
    render(
      <DashboardPage
        backendConfig={mockBackendConfig}
        history={mockSessions}
      />,
    );
    // (1500 + 2300 + 3200 + 800) / 4 = 1950ms
    // Rendered value: 1.9s
    expect(screen.getByText("1.9s")).toBeInTheDocument();
  });

  // 6. Total chars calculation
  it("calculates total chars correctly", () => {
    render(
      <DashboardPage
        backendConfig={mockBackendConfig}
        history={mockSessions}
      />,
    );
    // "Hello world"(11) + "Test dictation"(14) + ""(0) + "Another session with longer text for testing purposes"(53) + "Short"(5) + "Extra session beyond 5"(22) = 105
    expect(screen.getByText("105")).toBeInTheDocument();
  });

  // 7. Shows only 5 recent sessions
  it("shows at most 5 recent sessions", () => {
    render(
      <DashboardPage
        backendConfig={mockBackendConfig}
        history={mockSessions}
      />,
    );
    const badges = screen.getAllByTestId("badge");
    // Should have 5 session badges (not the 6th)
    expect(badges.length).toBe(5);
  });

  // 8. Shows status badges with correct variants
  it("renders status badges for sessions", () => {
    render(
      <DashboardPage
        backendConfig={mockBackendConfig}
        history={mockSessions}
      />,
    );
    // Multiple completed badges so use getAllByText
    const completedBadges = screen.getAllByText("completed");
    expect(completedBadges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("recording")).toBeInTheDocument();
  });

  // 9. All-zero stats when history is empty
  it("shows zero for all stats when history is empty", () => {
    render(
      <DashboardPage
        backendConfig={mockBackendConfig}
        history={emptySessions}
      />,
    );
    // Two "0" values (Active Sessions + Total Chars)
    const zeroElements = screen.getAllByText("0");
    expect(zeroElements.length).toBe(2);
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("0s")).toBeInTheDocument();
  });
});
