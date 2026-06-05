/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionListItem } from "../SessionListItem.js";
import type { HistorySession } from "../../settings/types.js";

// Mock framer-motion to render children directly without animation wrappers
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      // Strip framer-motion specific props
      const {
        initial,
        animate,
        exit,
        transition,
        variants,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        key,
        ...rest
      } = props;
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
  // 1. Renders status badge with correct text
  it("renders the status badge", () => {
    render(
      <SessionListItem session={createMockSession({ status: "completed" })} />,
    );
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  // 2. Renders formatted timestamp
  it("renders the formatted timestamp", () => {
    render(<SessionListItem session={createMockSession()} />);
    // toLocaleString output varies by environment; check for year digits
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  // 3. Renders duration when timing_ms is present
  it("shows duration when timing_ms is provided", () => {
    render(
      <SessionListItem
        session={createMockSession({ timing_ms: 2500 })}
      />,
    );
    expect(screen.getByText("2.5s")).toBeInTheDocument();
  });

  // 4. Does not show duration when timing_ms is null
  it("does not show duration when timing_ms is null", () => {
    render(
      <SessionListItem
        session={createMockSession({ timing_ms: null })}
      />,
    );
    expect(screen.queryByText(/^\d+\.\ds$/)).not.toBeInTheDocument();
  });

  // 5. Shows char count
  it("shows char count", () => {
    render(
      <SessionListItem
        session={createMockSession({ raw_text: "Hello" })}
      />,
    );
    expect(screen.getByText("5 chars")).toBeInTheDocument();
  });

  // 6. Clicking header toggles expand/collapse
  it("toggles detail visibility on header click", () => {
    render(
      <SessionListItem session={createMockSession()} />,
    );
    const header = screen.getByTestId("session-header-1");

    // Initially collapsed - detail not rendered
    expect(
      screen.queryByTestId("session-detail-1"),
    ).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(header);
    expect(screen.getByTestId("session-detail-1")).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(header);
    expect(
      screen.queryByTestId("session-detail-1"),
    ).not.toBeInTheDocument();
  });

  // 7. Shows raw text when expanded
  it("displays raw text when expanded", () => {
    render(
      <SessionListItem
        session={createMockSession({ raw_text: "Test transcription" })}
      />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByText("Test transcription")).toBeInTheDocument();
  });

  // 8. Shows polished text when it differs from raw text
  it("displays polished text when present and different from raw", () => {
    render(
      <SessionListItem
        session={createMockSession({
          raw_text: "raw text",
          polished_text: "polished text",
        })}
      />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByText("polished text")).toBeInTheDocument();
  });

  // 9. Shows error for failed sessions
  it("shows error type for failed sessions when expanded", () => {
    render(
      <SessionListItem
        session={createMockSession({
          status: "failed",
          error_type: "asr_error",
        })}
      />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByText("Error: asr_error")).toBeInTheDocument();
  });

  // 10. Shows retry button for failed sessions
  it("shows retry button for failed sessions when expanded", () => {
    render(
      <SessionListItem
        session={createMockSession({
          status: "failed",
          raw_text: "some text",
        })}
        onRetry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByTestId("retry-btn-1")).toBeInTheDocument();
  });

  // 11. Does not show retry button for completed sessions
  it("does not show retry button for non-failed sessions", () => {
    render(
      <SessionListItem
        session={createMockSession({ status: "completed" })}
        onRetry={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.queryByTestId("retry-btn-1")).not.toBeInTheDocument();
  });

  // 12. Calls onRetry when retry button clicked
  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn();
    render(
      <SessionListItem
        session={createMockSession({
          status: "failed",
          raw_text: "some text",
        })}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    fireEvent.click(screen.getByTestId("retry-btn-1"));
    expect(onRetry).toHaveBeenCalledWith("sess-test-001");
  });

  // 13. Retry button does not propagate click to header
  it("retry button click does not collapse the detail", () => {
    const onRetry = vi.fn();
    render(
      <SessionListItem
        session={createMockSession({
          status: "failed",
          raw_text: "some text",
        })}
        onRetry={onRetry}
      />,
    );
    // Expand first
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByTestId("session-detail-1")).toBeInTheDocument();

    // Click retry - detail should stay
    fireEvent.click(screen.getByTestId("retry-btn-1"));
    expect(screen.getByTestId("session-detail-1")).toBeInTheDocument();
  });

  // 14. Renders session ID in detail
  it("shows session ID in expanded detail", () => {
    render(
      <SessionListItem
        session={createMockSession({ session_id: "sess-abc-123" })}
      />,
    );
    fireEvent.click(screen.getByTestId("session-header-1"));
    expect(screen.getByText("sess-abc-123")).toBeInTheDocument();
  });
});
