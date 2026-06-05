/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PhaseIndicator } from "../../../../src/electron/renderer/components/PhaseIndicator";
import {
  I18nProvider,
  createI18nState,
} from "../../../../src/electron/renderer/lib/i18n";

function I18nTestWrapper({ children }: { children: React.ReactNode }) {
  const i18n = createI18nState("en");
  return <I18nProvider value={i18n}>{children}</I18nProvider>;
}

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nTestWrapper>{ui}</I18nTestWrapper>);
}

describe("PhaseIndicator", () => {
  it("shows idle state with ready message", () => {
    renderWithI18n(<PhaseIndicator phase="idle" />);

    expect(screen.getByText("Idle")).toBeInTheDocument();
    expect(screen.getByTestId("phase-indicator")).toBeInTheDocument();
  });

  it("shows recording phase with red status text", () => {
    renderWithI18n(<PhaseIndicator phase="recording" />);

    expect(screen.getByTestId("phase-status-text")).toHaveTextContent(
      "Recording",
    );
  });

  it("shows transcribing (ASR) phase", () => {
    renderWithI18n(<PhaseIndicator phase="transcribing" />);

    expect(screen.getByTestId("phase-status-text")).toHaveTextContent(
      "Transcribing",
    );
    expect(screen.getByTestId("phase-step-transcribing")).toBeInTheDocument();
  });

  it("shows polishing (LLM) phase", () => {
    renderWithI18n(<PhaseIndicator phase="polishing" />);

    expect(screen.getByTestId("phase-status-text")).toHaveTextContent(
      "Polishing",
    );
    expect(screen.getByTestId("phase-step-polishing")).toBeInTheDocument();
  });

  it("shows completed phase with green color", () => {
    renderWithI18n(<PhaseIndicator phase="completed" />);

    expect(screen.getByTestId("phase-status-text")).toHaveTextContent(
      "Completed",
    );
  });

  it("shows failed phase with red color", () => {
    renderWithI18n(<PhaseIndicator phase="failed" />);

    expect(screen.getByTestId("phase-status-text")).toHaveTextContent(
      "Failed",
    );
  });

  it("renders all pipeline steps for non-idle phases", () => {
    renderWithI18n(<PhaseIndicator phase="transcribing" />);

    expect(screen.getByTestId("phase-step-recording")).toBeInTheDocument();
    expect(screen.getByTestId("phase-step-transcribing")).toBeInTheDocument();
    expect(screen.getByTestId("phase-step-polishing")).toBeInTheDocument();
    expect(screen.getByTestId("phase-step-completed")).toBeInTheDocument();
  });
});
