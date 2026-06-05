/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toast } from "../../../../src/electron/renderer/components/Toast";

describe("Toast", () => {
  it("renders container but no toast element when message is null", () => {
    const { container } = render(<Toast message={null} />);
    // Container wrapper is always rendered (fixed position div)
    expect(container.firstChild).toBeInTheDocument();
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  });

  it("renders the message when provided", () => {
    render(<Toast message="Settings saved" />);

    expect(screen.getByTestId("toast")).toHaveTextContent("Settings saved");
  });

  it("updates when message changes", () => {
    const { rerender } = render(<Toast message="First" />);
    expect(screen.getByTestId("toast")).toHaveTextContent("First");

    rerender(<Toast message="Second" />);
    // AnimatePresence may keep both toasts during exit animation
    const allToasts = screen.getAllByTestId("toast");
    expect(allToasts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});
