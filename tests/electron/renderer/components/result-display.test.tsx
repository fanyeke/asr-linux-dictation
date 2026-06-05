/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultDisplay } from "../../../../src/electron/renderer/components/ResultDisplay";

vi.mock("../../../../src/electron/renderer/lib/i18n.js", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        result_error: "Error",
        result_raw: "Raw Text",
        result_polished: "Polished",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("ResultDisplay", () => {
  it("renders nothing when no result or error", () => {
    const { container } = render(<ResultDisplay result={null} error={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows ASR raw text with ASR label", () => {
    render(
      <ResultDisplay
        result={{
          rawText: "hello world",
          polishedText: null,
          status: "completed",
          timingMs: 1500,
          errorType: null,
        }}
        error={null}
      />,
    );

    expect(screen.getByText("ASR")).toBeInTheDocument();
    expect(screen.getByTestId("result-raw-text")).toHaveTextContent(
      "hello world",
    );
  });

  it("shows both ASR and LLM results when they differ", () => {
    render(
      <ResultDisplay
        result={{
          rawText: "hello world",
          polishedText: "Hello, world!",
          status: "completed",
          timingMs: 2000,
          errorType: null,
        }}
        error={null}
      />,
    );

    expect(screen.getByText("ASR")).toBeInTheDocument();
    expect(screen.getByText("LLM")).toBeInTheDocument();
    expect(screen.getByTestId("result-raw-text")).toHaveTextContent(
      "hello world",
    );
    expect(screen.getByTestId("result-polished-text")).toHaveTextContent(
      "Hello, world!",
    );
  });

  it("hides LLM section when polished text equals raw text", () => {
    render(
      <ResultDisplay
        result={{
          rawText: "same text",
          polishedText: "same text",
          status: "completed",
          timingMs: 1000,
          errorType: null,
        }}
        error={null}
      />,
    );

    expect(screen.getByText("ASR")).toBeInTheDocument();
    expect(screen.queryByText("LLM")).not.toBeInTheDocument();
  });

  it("shows timing info", () => {
    render(
      <ResultDisplay
        result={{
          rawText: "test",
          polishedText: null,
          status: "completed",
          timingMs: 3500,
          errorType: null,
        }}
        error={null}
      />,
    );

    expect(screen.getByTestId("result-timing")).toHaveTextContent("3500ms");
  });

  it("shows error with error type", () => {
    render(
      <ResultDisplay
        result={null}
        error={{
          message: "ASR service timeout",
          errorType: "asr:timeout",
          rawText: "partial text",
        }}
      />,
    );

    expect(
      screen.getByText("Error: asr:timeout"),
    ).toBeInTheDocument();
    expect(screen.getByText("ASR service timeout")).toBeInTheDocument();
    expect(screen.getByText("partial text")).toBeInTheDocument();
  });

  it("shows generic error without error type", () => {
    render(
      <ResultDisplay
        result={null}
        error={{ message: "Network error" }}
      />,
    );

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("renders within Card component with correct data-testid", () => {
    render(
      <ResultDisplay
        result={{
          rawText: "test",
          polishedText: null,
          status: "completed",
          timingMs: null,
          errorType: null,
        }}
        error={null}
      />,
    );

    expect(screen.getByTestId("result-display")).toBeInTheDocument();
  });

  it("shows empty placeholder when rawText is empty", () => {
    render(
      <ResultDisplay
        result={{
          rawText: "",
          polishedText: null,
          status: "completed",
          timingMs: null,
          errorType: null,
        }}
        error={null}
      />,
    );

    expect(screen.getByTestId("result-raw-text")).toHaveTextContent("(empty)");
  });
});
