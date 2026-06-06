import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardPage } from "../DashboardPage.js";
import type { BackendConfig, HistorySession } from "../../settings/types.js";

vi.mock("../../lib/i18n.js", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        dashboard_title: "Dashboard",
        loading: "Loading...",
        no_sessions: "No sessions yet",
        no_sessions_desc: "Your dictation sessions will appear here",
        stat_active_sessions: "Active Sessions",
        stat_success_rate: "Success Rate",
        stat_avg_duration: "Avg Duration",
        stat_total_chars: "Total Chars",
        chars: "chars",
        status_completed: "completed",
        status_failed: "failed",
        status_recording: "recording",
      };
      return map[key] || key;
    },
    language: "en",
    setLanguage: vi.fn(),
  }),
}));

const mockBackendConfig: BackendConfig = {
  url: "http://127.0.0.1:42003",
  token: "test-token-12345678",
};

const mockSessions: HistorySession[] = [
  { id: 1, session_id: "sess-001", raw_text: "Hello world", polished_text: "Hello world!", status: "completed", timing_ms: 1500, prompt_id: null, error_type: null, failed_audio_path: null, created_at: "2025-06-05T10:00:00Z" },
  { id: 2, session_id: "sess-002", raw_text: "Test dictation", polished_text: null, status: "completed", timing_ms: 2300, prompt_id: null, error_type: null, failed_audio_path: null, created_at: "2025-06-05T11:00:00Z" },
  { id: 3, session_id: "sess-003", raw_text: "", polished_text: "", status: "failed", timing_ms: null, prompt_id: null, error_type: "asr_error", failed_audio_path: null, created_at: "2025-06-05T09:00:00Z" },
  { id: 4, session_id: "sess-004", raw_text: "Another session with longer text for testing purposes", polished_text: null, status: "completed", timing_ms: 3200, prompt_id: null, error_type: null, failed_audio_path: null, created_at: "2025-06-04T15:00:00Z" },
  { id: 5, session_id: "sess-005", raw_text: "Short", polished_text: null, status: "recording", timing_ms: null, prompt_id: null, error_type: null, failed_audio_path: null, created_at: "2025-06-05T12:00:00Z" },
  { id: 6, session_id: "sess-006", raw_text: "Extra session beyond 5", polished_text: null, status: "completed", timing_ms: 800, prompt_id: null, error_type: null, failed_audio_path: null, created_at: "2025-06-03T10:00:00Z" },
];

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      daily_usage: [],
      hourly_distribution: {},
      avg_latency: { asr_ms: null, polish_ms: null, total_ms: null },
      latency_trend: [],
    }),
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DashboardPage", () => {
  it("renders the dashboard title", async () => {
    render(<DashboardPage backendConfig={mockBackendConfig} history={mockSessions} />);
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("shows empty state when no history", async () => {
    render(<DashboardPage backendConfig={mockBackendConfig} history={[]} />);
    expect(await screen.findByText("No sessions yet")).toBeInTheDocument();
  });

  it("displays stat cards with history data", async () => {
    render(<DashboardPage backendConfig={null} history={mockSessions} />);
    expect(await screen.findByText("Active Sessions")).toBeInTheDocument();
    expect(screen.getByText("Success Rate")).toBeInTheDocument();
    expect(screen.getByText("Avg Duration")).toBeInTheDocument();
    expect(screen.getByText("Total Chars")).toBeInTheDocument();
  });

  it("calculates success rate correctly (4/6 = 67%)", async () => {
    render(<DashboardPage backendConfig={null} history={mockSessions} />);
    expect(await screen.findByText("67%")).toBeInTheDocument();
  });

  it("calculates average duration correctly", async () => {
    render(<DashboardPage backendConfig={null} history={mockSessions} />);
    await screen.findByText("Dashboard");
    // Only sessions with non-null timing_ms:
    // (1500 + 2300 + 3200 + 800) / 4 = 1950ms → 1.9s
    const content = document.body.textContent || "";
    expect(content).toContain("1.9s");
  });

  it("calculates total chars correctly", async () => {
    render(<DashboardPage backendConfig={mockBackendConfig} history={mockSessions} />);
    expect(await screen.findByText("105")).toBeInTheDocument();
  });
});
