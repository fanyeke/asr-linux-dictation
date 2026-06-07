/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../ThemeProvider.js";
import type { ReactNode } from "react";

// ── Test helper that consumes the theme context ──────────────────────
function ThemeConsumer(): JSX.Element {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <span data-testid="resolved-theme-value">{resolvedTheme}</span>
      <button data-testid="set-light" onClick={() => setTheme("light")}>
        Light
      </button>
      <button data-testid="set-dark" onClick={() => setTheme("dark")}>
        Dark
      </button>
      <button data-testid="set-system" onClick={() => setTheme("system")}>
        System
      </button>
    </div>
  );
}

function renderWithTheme(ui: ReactNode): ReturnType<typeof render> {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

// ── Mocks ────────────────────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-reduced-motion");

  // Mock matchMedia for prefers-color-scheme
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? false : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("ThemeProvider", () => {
  it("renders children without crashing", () => {
    renderWithTheme(<div data-testid="child">Hello</div>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("defaults to light theme when no localStorage value set", () => {
    renderWithTheme(<ThemeConsumer />);
    expect(screen.getByTestId("theme-value").textContent).toBe("light");
    expect(screen.getByTestId("resolved-theme-value").textContent).toBe("light");
  });

  it("applies light theme by default (no .dark class)", () => {
    renderWithTheme(<ThemeConsumer />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("applies .dark class when theme is set to dark", () => {
    renderWithTheme(<ThemeConsumer />);
    act(() => {
      screen.getByTestId("set-dark").click();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByTestId("theme-value").textContent).toBe("dark");
  });

  it("removes .dark class when theme is set back to light", () => {
    renderWithTheme(<ThemeConsumer />);
    act(() => {
      screen.getByTestId("set-dark").click();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      screen.getByTestId("set-light").click();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByTestId("theme-value").textContent).toBe("light");
  });

  it("persists theme choice to localStorage", () => {
    renderWithTheme(<ThemeConsumer />);
    act(() => {
      screen.getByTestId("set-dark").click();
    });
    expect(localStorage.getItem("asr-linux-theme")).toBe("dark");
  });

  it("reads initial theme from localStorage", () => {
    localStorage.setItem("asr-linux-theme", "dark");
    renderWithTheme(<ThemeConsumer />);
    expect(screen.getByTestId("theme-value").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("resolves to light when system prefers light", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? false : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderWithTheme(<ThemeConsumer />);
    act(() => {
      screen.getByTestId("set-system").click();
    });
    expect(screen.getByTestId("resolved-theme-value").textContent).toBe("light");
  });

  it("resolves to dark when system prefers dark", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? true : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderWithTheme(<ThemeConsumer />);
    act(() => {
      screen.getByTestId("set-system").click();
    });
    expect(screen.getByTestId("resolved-theme-value").textContent).toBe("dark");
  });

  it("sets data-reduced-motion attribute when reduced motion is preferred", () => {
    // Simulate reduced motion preference
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? true : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderWithTheme(<ThemeConsumer />);
    expect(document.documentElement.getAttribute("data-reduced-motion")).toBe("true");
  });

  it("does not set data-reduced-motion when reduced motion is not preferred", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderWithTheme(<ThemeConsumer />);
    expect(document.documentElement.getAttribute("data-reduced-motion")).toBeNull();
  });

  it("useTheme throws when used outside ThemeProvider", () => {
    // Suppress console.error for the expected error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ThemeConsumer />)).toThrow(
      "useTheme must be used within a ThemeProvider",
    );
    consoleSpy.mockRestore();
  });

  it("uses custom storageKey when provided", () => {
    render(
      <ThemeProvider storageKey="custom-theme-key">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    act(() => {
      screen.getByTestId("set-dark").click();
    });
    expect(localStorage.getItem("custom-theme-key")).toBe("dark");
    expect(localStorage.getItem("asr-linux-theme")).toBeNull();
  });

  it("uses custom defaultTheme when no localStorage value set", () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme-value").textContent).toBe("dark");
  });
});
