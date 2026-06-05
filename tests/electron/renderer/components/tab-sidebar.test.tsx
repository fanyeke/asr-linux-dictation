/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TabSidebar } from "../../../../src/electron/renderer/components/TabSidebar";

describe("TabSidebar", () => {
  it("renders both desktop and mobile navigation", () => {
    render(<TabSidebar activeTab="dictate" onTabChange={vi.fn()} />);
    expect(screen.getByTestId("tab-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("tab-sidebar-mobile")).toBeInTheDocument();
  });

  it("shows tab labels in desktop sidebar", () => {
    render(<TabSidebar activeTab="dictate" onTabChange={vi.fn()} />);
    const sidebar = screen.getByTestId("tab-sidebar");
    expect(within(sidebar).getByText("Dashboard")).toBeInTheDocument();
    expect(within(sidebar).getByText("Dictate")).toBeInTheDocument();
    expect(within(sidebar).getByText("History")).toBeInTheDocument();
    expect(within(sidebar).getByText("Settings")).toBeInTheDocument();
  });

  it("highlights the active tab with CSS classes in desktop sidebar", () => {
    render(<TabSidebar activeTab="history" onTabChange={vi.fn()} />);
    const sidebar = screen.getByTestId("tab-sidebar");

    const historyBtn = within(sidebar).getByTestId("tab-history");
    const dictateBtn = within(sidebar).getByTestId("tab-dictate");

    expect(historyBtn).toHaveClass("bg-brand-500/15");
    expect(historyBtn).toHaveClass("text-white");
    expect(dictateBtn).not.toHaveClass("bg-brand-500/15");
    expect(dictateBtn).toHaveClass("text-gray-500");
  });

  it("renders all four tabs in desktop sidebar", () => {
    render(<TabSidebar activeTab="dictate" onTabChange={vi.fn()} />);
    const sidebar = screen.getByTestId("tab-sidebar");
    expect(within(sidebar).getByTestId("tab-dashboard")).toBeInTheDocument();
    expect(within(sidebar).getByTestId("tab-dictate")).toBeInTheDocument();
    expect(within(sidebar).getByTestId("tab-history")).toBeInTheDocument();
    expect(within(sidebar).getByTestId("tab-settings")).toBeInTheDocument();
  });
});
