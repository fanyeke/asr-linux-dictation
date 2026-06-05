/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Card } from "../Card.tsx";

describe("Card", () => {
  // 1. Default rendering
  it("renders children correctly", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("renders with default padding (md)", () => {
    render(<Card>Content</Card>);
    expect(screen.getByText("Content")).toHaveClass("p-5");
  });

  // 2. All padding sizes
  it.each(["sm", "md", "lg"] as const)("renders with %s padding", (padding) => {
    render(<Card padding={padding}>Content</Card>);
    const expectedPadding = padding === "sm" ? "p-4" : padding === "md" ? "p-5" : "p-6";
    expect(screen.getByText("Content")).toHaveClass(expectedPadding);
  });

  // 3. Hoverable
  it("applies hover styles when hoverable is true", () => {
    render(<Card hoverable>Hover me</Card>);
    const card = screen.getByText("Hover me");
    expect(card).toHaveClass("hover:shadow-card-hover");
    expect(card).toHaveClass("hover:-translate-y-0.5");
    expect(card).toHaveClass("transition-all");
    expect(card).toHaveClass("duration-200");
  });

  it("does not apply hover styles when hoverable is false", () => {
    render(<Card>No hover</Card>);
    const card = screen.getByText("No hover");
    expect(card).not.toHaveClass("hover:shadow-card-hover");
  });

  // 4. Clickable
  it("applies cursor-pointer when clickable is true", () => {
    render(<Card clickable>Click me</Card>);
    expect(screen.getByText("Click me")).toHaveClass("cursor-pointer");
  });

  it("has role button when clickable", () => {
    render(<Card clickable>Click me</Card>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("has tabIndex 0 when clickable", () => {
    render(<Card clickable>Click me</Card>);
    expect(screen.getByRole("button")).toHaveAttribute("tabindex", "0");
  });

  // 5. Event handling
  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <Card clickable onClick={onClick}>
        Click me
      </Card>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when not clickable", () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>No click</Card>);
    const card = screen.getByText("No click");
    fireEvent.click(card);
    expect(onClick).not.toHaveBeenCalled();
  });

  // 6. Keyboard navigation
  it("calls onClick on Enter key when clickable", () => {
    const onClick = vi.fn();
    render(
      <Card clickable onClick={onClick}>
        Press Enter
      </Card>,
    );
    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onClick).toHaveBeenCalled();
  });

  it("calls onClick on Space key when clickable", () => {
    const onClick = vi.fn();
    render(
      <Card clickable onClick={onClick}>
        Press Space
      </Card>,
    );
    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: " " });
    expect(onClick).toHaveBeenCalled();
  });

  // 7. Additional className
  it("accepts additional className", () => {
    render(<Card className="extra-class">Content</Card>);
    expect(screen.getByText("Content")).toHaveClass("extra-class");
  });

  // 8. Default styles
  it("has default card styles", () => {
    render(<Card>Styled card</Card>);
    const card = screen.getByText("Styled card");
    expect(card).toHaveClass("bg-white");
    expect(card).toHaveClass("border");
    expect(card).toHaveClass("border-gray-200");
    expect(card).toHaveClass("rounded-lg");
    expect(card).toHaveClass("shadow-card");
  });
});
