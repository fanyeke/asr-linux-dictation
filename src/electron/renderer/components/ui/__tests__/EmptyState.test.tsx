/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "../EmptyState.tsx";
import { Button } from "../Button.tsx";

describe("EmptyState", () => {
  // 1. Default rendering
  it("renders title correctly", () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("renders default icon (FileQuestion)", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByTestId("empty-state-default-icon")).toBeInTheDocument();
  });

  // 2. Description
  it("renders description when provided", () => {
    render(<EmptyState title="Empty" description="There are no items to display" />);
    expect(screen.getByText("There are no items to display")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  // 3. Custom icon
  it("renders custom icon instead of default", () => {
    render(<EmptyState title="Empty" icon={<span data-testid="custom-icon" />} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-state-default-icon")).not.toBeInTheDocument();
  });

  // 4. Action
  it("renders action element when provided", () => {
    render(
      <EmptyState
        title="Empty"
        action={<Button onClick={() => {}}>Add item</Button>}
      />,
    );
    expect(screen.getByRole("button", { name: /add item/i })).toBeInTheDocument();
  });

  it("triggers action onClick", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Empty"
        action={<Button onClick={onClick}>Add item</Button>}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // 5. All sizes
  it.each(["sm", "md", "lg"] as const)("renders %s size", (size) => {
    render(<EmptyState title="Empty" size={size} />);
    const container = screen.getByTestId("empty-state");
    expect(container).toBeInTheDocument();
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });

  // 6. Additional className
  it("accepts additional className", () => {
    render(<EmptyState title="Title" className="extra-class" />);
    expect(screen.getByTestId("empty-state")).toHaveClass("extra-class");
  });

  // 7. Layout classes
  it("has correct layout classes", () => {
    render(<EmptyState title="Title" />);
    const container = screen.getByTestId("empty-state");
    expect(container).toHaveClass("flex");
    expect(container).toHaveClass("flex-col");
    expect(container).toHaveClass("items-center");
    expect(container).toHaveClass("text-center");
  });

  // 8. Title styling
  it("has correct title styling", () => {
    render(<EmptyState title="Title" />);
    const title = screen.getByText("Title");
    expect(title).toHaveClass("text-dark-900");
    expect(title).toHaveClass("font-semibold");
  });

  // 9. Description styling
  it("has correct description styling", () => {
    render(<EmptyState title="Title" description="Description text" />);
    const description = screen.getByText("Description text");
    expect(description).toHaveClass("text-gray-500");
    expect(description).toHaveClass("max-w-[280px]");
  });

  // 10. Icon container styling
  it("has rounded-full icon container", () => {
    render(<EmptyState title="Title" />);
    const iconContainer = screen.getByTestId("empty-state").firstChild as HTMLElement;
    expect(iconContainer).toHaveClass("rounded-full");
    expect(iconContainer).toHaveClass("bg-gray-100");
    expect(iconContainer).toHaveClass("w-12");
    expect(iconContainer).toHaveClass("h-12");
  });
});
