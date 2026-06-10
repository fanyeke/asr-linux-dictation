import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardPage } from "../DashboardPage.js";
import type { BackendConfig } from "../../settings/types.js";

vi.mock("../../lib/i18n.js", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        dashboard_title: "Dashboard",
        range_today: "Today",
        range_7d: "7 Days",
        range_30d: "30 Days",
        stat_total_sessions: "Total Calls",
        stat_success_rate: "Success Rate",
        stat_avg_duration: "Avg Duration",
        stat_total_chars: "Total Chars",
        chart_today_usage: "Today's Usage",
        chart_trend: "Usage Trend",
        chart_latency: "Latency Trend",
        chart_no_data: "No data",
        chart_insufficient_data: "Insufficient data",
        stats_since_hint: "Stats recorded since feature activation",
        empty_today_title: "No usage recorded today",
        empty_today_desc: "Data will appear here after your first dictation",
        empty_7d_title: "No usage in the past 7 days",
        empty_7d_desc: "Start dictating to see statistics",
        empty_30d_title: "No usage in the past 30 days",
        empty_30d_desc: "Start dictating to see statistics",
        loading: "Loading...",
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

const mockStatsResponse = {
  summary: {
    total_sessions: 42,
    success_count: 38,
    fail_count: 4,
    total_chars: 3200,
    avg_asr_ms: 620,
    avg_polish_ms: 850,
    avg_total_ms: 1520,
  },
  timeline: [
    { slot: "00", count: 3, successes: 3 },
    { slot: "01", count: 0, successes: 0 },
    { slot: "02", count: 0, successes: 0 },
    { slot: "10", count: 5, successes: 4 },
    { slot: "11", count: 8, successes: 7 },
    { slot: "14", count: 12, successes: 11 },
    { slot: "15", count: 6, successes: 6 },
    { slot: "16", count: 4, successes: 4 },
    { slot: "17", count: 2, successes: 2 },
    { slot: "18", count: 1, successes: 1 },
    { slot: "19", count: 1, successes: 0 },
  ],
  latency_trend: [
    { asr_ms: 600, polish_ms: 800, total_ms: 1400, created_at: "2026-06-05T10:00:00Z" },
    { asr_ms: 650, polish_ms: 900, total_ms: 1550, created_at: "2026-06-05T11:00:00Z" },
    { asr_ms: 580, polish_ms: 780, total_ms: 1360, created_at: "2026-06-05T12:00:00Z" },
  ],
};

const emptyStatsResponse = {
  summary: {
    total_sessions: 0,
    success_count: 0,
    fail_count: 0,
    total_chars: 0,
    avg_asr_ms: null,
    avg_polish_ms: null,
    avg_total_ms: null,
  },
  timeline: [
    { slot: "00", count: 0, successes: 0 },
    { slot: "01", count: 0, successes: 0 },
    { slot: "02", count: 0, successes: 0 },
  ],
  latency_trend: [],
};

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockStatsResponse),
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DashboardPage", () => {
  it("shows range selector tabs", async () => {
    render(<DashboardPage backendConfig={mockBackendConfig} />);
    expect(await screen.findByText("Today")).toBeInTheDocument();
    expect(screen.getByText("7 Days")).toBeInTheDocument();
    expect(screen.getByText("30 Days")).toBeInTheDocument();
  });

  it("shows stat cards with server data", async () => {
    render(<DashboardPage backendConfig={mockBackendConfig} />);
    expect(await screen.findByText("Total Calls")).toBeInTheDocument();
    expect(screen.getByText("Success Rate")).toBeInTheDocument();
    expect(screen.getByText("Avg Duration")).toBeInTheDocument();
    expect(screen.getByText("Total Chars")).toBeInTheDocument();
  });

  it("displays total sessions count", async () => {
    render(<DashboardPage backendConfig={mockBackendConfig} />);
    expect(await screen.findByText("42")).toBeInTheDocument();
  });

  it("displays success rate percentage", async () => {
    render(<DashboardPage backendConfig={mockBackendConfig} />);
    // 38/42 = 90% (rounded)
    expect(await screen.findByText("90%")).toBeInTheDocument();
  });

  it("displays total char count", async () => {
    render(<DashboardPage backendConfig={mockBackendConfig} />);
    expect(await screen.findByText("3200")).toBeInTheDocument();
  });

  it("shows empty state when no stats data", async () => {
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyStatsResponse),
    } as Response);

    render(<DashboardPage backendConfig={mockBackendConfig} />);
    expect(await screen.findByText("No usage recorded today")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    // Return a promise that never resolves to keep loading state
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));

    render(<DashboardPage backendConfig={mockBackendConfig} />);
    // Loading skeleton should be visible (no crash)
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("fetches with range=7d when 7 Days tab clicked", async () => {
    let capturedUrl = "";
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = typeof url === "string" ? url : "";
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockStatsResponse),
      } as Response);
    });

    render(<DashboardPage backendConfig={mockBackendConfig} />);
    const btn = await screen.findByText("7 Days");
    btn.click();

    await waitFor(() => {
      expect(capturedUrl).toContain("range=7d");
    });
  });

  it("handles null backendConfig gracefully", async () => {
    render(<DashboardPage backendConfig={null} />);
    // Should still render range selector tabs
    expect(await screen.findByText("Today")).toBeInTheDocument();
  });
});
