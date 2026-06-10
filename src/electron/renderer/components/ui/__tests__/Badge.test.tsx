/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../Badge.tsx";

describe("Badge", () => {
  // 1. Default rendering
  it("renders children correctly", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByTestId("badge")).toHaveTextContent("Active");
  });

  it("renders with default variant (neutral) and size (md)", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-[var(--muted)]");
    expect(badge).toHaveClass("text-[var(--muted-foreground)]");
    expect(badge).toHaveClass("px-2.5");
  });

  // 2. All variants
  it.each([
    ["success", "bg-[var(--success-bg)]", "text-[var(--success-text)]"],
    ["error", "bg-[var(--error-bg)]", "text-[var(--error-text)]"],
    ["warning", "bg-[var(--warning-bg)]", "text-[var(--warning-text)]"],
    ["info", "bg-[var(--info-bg)]", "text-[var(--info-text)]"],
    ["neutral", "bg-[var(--muted)]", "text-[var(--muted-foreground)]"],
    ["recording", "bg-[var(--error-bg)]", "text-[var(--error-text)]"],
    ["processing", "bg-[var(--brand-50)]", "text-[var(--brand-700)]"],
  ] as const)("renders %s variant with correct styles", (variant, expectedBg, expectedText) => {
    render(<Badge variant={variant}>{variant}</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass(expectedBg);
    expect(badge).toHaveClass(expectedText);
  });

  // 3. All sizes
  it.each(["sm", "md"] as const)("renders %s size", (size) => {
    render(<Badge size={size}>{size}</Badge>);
    const badge = screen.getByTestId("badge");
    if (size === "sm") {
      expect(badge).toHaveClass("px-2");
    } else {
      expect(badge).toHaveClass("px-2.5");
    }
  });

  // 4. Dot
  it("shows dot when dot is true", () => {
    render(<Badge dot>With dot</Badge>);
    expect(screen.getByTestId("badge-dot")).toBeInTheDocument();
  });

  it("shows dot for recording variant even without dot prop", () => {
    render(<Badge variant="recording">Recording</Badge>);
    expect(screen.getByTestId("badge-dot")).toBeInTheDocument();
  });

  it("does not show dot by default for non-recording variants", () => {
    render(<Badge variant="success">Success</Badge>);
    expect(screen.queryByTestId("badge-dot")).not.toBeInTheDocument();
  });

  // 5. Pulse animation
  it("applies pulse animation when pulse is true", () => {
    render(<Badge pulse>Pulsing</Badge>);
    expect(screen.getByTestId("badge")).toHaveClass("animate-pulse");
  });

  it("applies pulse animation for recording variant", () => {
    render(<Badge variant="recording">Recording</Badge>);
    expect(screen.getByTestId("badge")).toHaveClass("animate-pulse");
  });

  it("does not apply pulse by default", () => {
    render(<Badge>Normal</Badge>);
    expect(screen.getByTestId("badge")).not.toHaveClass("animate-pulse");
  });

  // 6. Additional className
  it("accepts additional className", () => {
    render(<Badge className="extra-class">Styled</Badge>);
    expect(screen.getByTestId("badge")).toHaveClass("extra-class");
  });

  // 7. Accessibility
  it("dot has aria-hidden attribute", () => {
    render(<Badge dot>With dot</Badge>);
    expect(screen.getByTestId("badge-dot")).toHaveAttribute("aria-hidden", "true");
  });

  // 8. Shape
  it("has rounded-full class", () => {
    render(<Badge>Rounded</Badge>);
    expect(screen.getByTestId("badge")).toHaveClass("rounded-full");
  });

  it("has font-semibold class", () => {
    render(<Badge>Bold</Badge>);
    expect(screen.getByTestId("badge")).toHaveClass("font-semibold");
  });
});
