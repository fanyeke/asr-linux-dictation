/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "../Input.tsx";

describe("Input", () => {
  // 1. Default rendering
  it("renders input element", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with placeholder", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  // 2. Label
  it("renders label when provided", () => {
    render(<Input label="Username" />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("associates label with input via id", () => {
    render(<Input label="Email" id="email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "email");
  });

  // 3. Error state
  it("shows error message when error is provided", () => {
    render(<Input label="Name" error="Name is required" />);
    expect(screen.getByTestId("input-error")).toHaveTextContent("Name is required");
  });

  it("applies error styles to input", () => {
    render(<Input error="Error" />);
    expect(screen.getByRole("textbox")).toHaveClass("border-red-500");
  });

  it("sets aria-invalid when error is present", () => {
    render(<Input error="Error" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  // 4. Helper text
  it("shows helper text when provided", () => {
    render(<Input helperText="Enter your full name" />);
    expect(screen.getByTestId("input-helper")).toHaveTextContent("Enter your full name");
  });

  it("does not show helper text when error is present", () => {
    render(<Input helperText="Helper" error="Error" />);
    expect(screen.queryByTestId("input-helper")).not.toBeInTheDocument();
    expect(screen.getByTestId("input-error")).toBeInTheDocument();
  });

  // 5. Left icon
  it("renders left icon", () => {
    render(<Input leftIcon={<span data-testid="icon" />} />);
    expect(screen.getByTestId("input-left-icon")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("adds left padding when left icon is present", () => {
    render(<Input leftIcon={<span>🔍</span>} />);
    expect(screen.getByRole("textbox")).toHaveClass("pl-9");
  });

  // 6. Right element
  it("renders right element", () => {
    render(<Input rightElement={<span data-testid="right-el" />} />);
    expect(screen.getByTestId("input-right-element")).toBeInTheDocument();
    expect(screen.getByTestId("right-el")).toBeInTheDocument();
  });

  it("adds right padding when right element is present", () => {
    render(<Input rightElement={<span>X</span>} />);
    expect(screen.getByRole("textbox")).toHaveClass("pr-9");
  });

  // 7. Disabled state
  it("renders disabled state", () => {
    render(<Input disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("textbox")).toHaveClass("cursor-not-allowed");
  });

  // 8. Event handling
  it("calls onChange when typing", () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a" } });
    expect(onChange).toHaveBeenCalled();
  });

  // 9. Additional className
  it("accepts additional className", () => {
    render(<Input className="extra-class" />);
    expect(screen.getByRole("textbox")).toHaveClass("extra-class");
  });

  // 10. Accessibility - aria-describedby for error
  it("links error message via aria-describedby", () => {
    render(<Input label="Test" error="Required" />);
    const input = screen.getByLabelText("Test");
    const errorId = input.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    const errorEl = document.getElementById(errorId!);
    expect(errorEl).toHaveTextContent("Required");
  });

  it("links helper text via aria-describedby", () => {
    render(<Input label="Test" helperText="Help text" />);
    const input = screen.getByLabelText("Test");
    const helperId = input.getAttribute("aria-describedby");
    expect(helperId).toBeTruthy();
    const helperEl = document.getElementById(helperId!);
    expect(helperEl).toHaveTextContent("Help text");
  });

  it("has display name", () => {
    expect(Input.displayName).toBe("Input");
  });
});
