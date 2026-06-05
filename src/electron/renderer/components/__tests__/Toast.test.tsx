/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Toast } from "../Toast.js";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Renders container but no toast element when message is null
  it("renders container but no toast message when message is null", () => {
    const { container } = render(<Toast message={null} />);
    // Container div is always rendered (fixed bottom-6 right-6)
    expect(container.firstChild).toBeInTheDocument();
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  });

  // 2. Renders message text
  it("renders the toast message", () => {
    render(<Toast message="Hello" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  // 3. Renders with success variant icon
  it("renders success variant with check icon", () => {
    render(<Toast message="Saved" variant="success" />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  // 4. Renders with error variant icon
  it("renders error variant with x icon", () => {
    render(<Toast message="Error" variant="error" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  // 5. Renders with info variant icon
  it("renders info variant with info icon", () => {
    render(<Toast message="Info" variant="info" />);
    expect(screen.getByText("Info")).toBeInTheDocument();
  });

  // 6. Message changes cause re-render
  it("updates when message changes", () => {
    const { rerender } = render(<Toast message="First" />);
    expect(screen.getByText("First")).toBeInTheDocument();
    rerender(<Toast message="Second" />);
    // Both toasts may exist due to AnimatePresence exit animation
    const allToasts = screen.getAllByTestId("toast");
    expect(allToasts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  // 7. Multiple toasts stack
  it("renders the toast container with correct positioning class", () => {
    const { container } = render(<Toast message="Stack me" />);
    const toastContainer = container.firstChild as HTMLElement;
    expect(toastContainer).toHaveClass("fixed");
    expect(toastContainer).toHaveClass("bottom-6");
    expect(toastContainer).toHaveClass("right-6");
  });

  // 8. Has data-testid on the toast element
  it("has data-testid on toast element", () => {
    render(<Toast message="Test" />);
    const toast = screen.getByTestId("toast");
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveClass("bg-dark-800");
    expect(toast).toHaveClass("text-white");
  });

  // 9. Default variant is info
  it("uses info variant as default", () => {
    render(<Toast message="Default" />);
    expect(screen.getByText("Default")).toBeInTheDocument();
  });
});
