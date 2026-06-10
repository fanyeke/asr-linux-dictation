/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../Button.tsx";

describe("Button", () => {
  // 1. Default rendering
  it("renders children correctly", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("renders with default variant and size", () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-[var(--brand-600)]");
    expect(button).toHaveClass("h-9");
  });

  // 2. All variants
  it.each(["primary", "secondary", "ghost", "danger", "icon"] as const)(
    "renders %s variant",
    (variant) => {
      render(<Button variant={variant}>{variant === "icon" ? <span data-testid="icon" /> : variant}</Button>);
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    },
  );

  // 3. All sizes
  it.each(["sm", "md", "lg"] as const)("renders %s size", (size) => {
    render(<Button size={size}>Size {size}</Button>);
    const button = screen.getByRole("button");
    if (size === "sm") expect(button).toHaveClass("h-8");
    if (size === "md") expect(button).toHaveClass("h-9");
    if (size === "lg") expect(button).toHaveClass("h-10");
  });

  // 4. Icon variant size
  it.each(["sm", "md", "lg"] as const)("renders icon variant with %s size", (size) => {
    render(
      <Button variant="icon" size={size}>
        <span data-testid="icon" />
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass("rounded-full");
    expect(button).toHaveClass("p-2");
    if (size === "sm") expect(button).toHaveClass("h-8");
    if (size === "md") expect(button).toHaveClass("h-9");
    if (size === "lg") expect(button).toHaveClass("h-10");
  });

  // 5. Loading state
  it("shows loading spinner when isLoading is true", () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByTestId("button-loading-icon")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("replaces left icon with spinner when loading", () => {
    const { rerender } = render(
      <Button isLoading={false} leftIcon={<span data-testid="left-icon" />}>
        Test
      </Button>,
    );
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();

    rerender(
      <Button isLoading leftIcon={<span data-testid="left-icon" />}>
        Test
      </Button>,
    );
    expect(screen.getByTestId("button-loading-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("left-icon")).not.toBeInTheDocument();
  });

  // 6. Disabled state
  it("is disabled when disabled prop is passed", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveClass("opacity-50");
    expect(screen.getByRole("button")).toHaveClass("cursor-not-allowed");
  });

  it("is disabled when isLoading is true", () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  // 7. Event handling
  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Click
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  // 8. Left and right icons
  it("renders left icon", () => {
    render(<Button leftIcon={<span data-testid="left-icon" />}>Test</Button>);
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
  });

  it("renders right icon", () => {
    render(<Button rightIcon={<span data-testid="right-icon" />}>Test</Button>);
    expect(screen.getByTestId("right-icon")).toBeInTheDocument();
  });

  // 9. Accessibility
  it("passes aria-label to button", () => {
    render(<Button aria-label="Close dialog">X</Button>);
    expect(screen.getByRole("button", { name: /close dialog/i })).toBeInTheDocument();
  });

  it("has display name", () => {
    expect(Button.displayName).toBe("Button");
  });

  // 10. Additional className
  it("accepts additional className", () => {
    render(<Button className="extra-class">Test</Button>);
    expect(screen.getByRole("button")).toHaveClass("extra-class");
  });
});
