/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TabSidebar } from "../TabSidebar.js";

describe("TabSidebar", () => {
  // Helper: get the desktop sidebar
  function getDesktopSidebar() {
    return screen.getByTestId("tab-sidebar");
  }

  // 1. Renders both desktop and mobile navs
  it("renders both desktop and mobile navigation", () => {
    render(<TabSidebar activeTab="dictate" onTabChange={vi.fn()} />);
    expect(screen.getByTestId("tab-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("tab-sidebar-mobile")).toBeInTheDocument();
  });

  // 2. Desktop nav has all 4 tabs
  it("renders all four tabs in desktop nav", () => {
    render(<TabSidebar activeTab="dictate" onTabChange={vi.fn()} />);
    const sidebar = getDesktopSidebar();
    expect(within(sidebar).getByTestId("tab-dashboard")).toBeInTheDocument();
    expect(within(sidebar).getByTestId("tab-dictate")).toBeInTheDocument();
    expect(within(sidebar).getByTestId("tab-history")).toBeInTheDocument();
    expect(within(sidebar).getByTestId("tab-settings")).toBeInTheDocument();
  });

  // 3. Active tab has correct styling on desktop
  it("highlights the active tab on desktop", () => {
    render(<TabSidebar activeTab="dashboard" onTabChange={vi.fn()} />);
    const sidebar = getDesktopSidebar();
    const dashboardTab = within(sidebar).getByTestId("tab-dashboard");
    expect(dashboardTab).toHaveClass("text-[var(--sidebar-text-active)]");
    expect(dashboardTab).toHaveAttribute("style", expect.stringContaining("var(--sidebar-bg-active)"));
  });

  // 4. Inactive tabs have default styling on desktop
  it("shows inactive tabs with default styling on desktop", () => {
    render(<TabSidebar activeTab="dashboard" onTabChange={vi.fn()} />);
    const sidebar = getDesktopSidebar();
    const dictateTab = within(sidebar).getByTestId("tab-dictate");
    expect(dictateTab).toHaveClass("text-[var(--sidebar-text)]");
    expect(dictateTab).not.toHaveAttribute("style", expect.stringContaining("var(--sidebar-bg-active)"));
  });

  // 5. Click event on desktop tab fires with correct tab id
  it("calls onTabChange when clicking a desktop tab", () => {
    const onTabChange = vi.fn();
    render(<TabSidebar activeTab="dictate" onTabChange={onTabChange} />);
    const sidebar = getDesktopSidebar();
    fireEvent.click(within(sidebar).getByTestId("tab-dashboard"));
    expect(onTabChange).toHaveBeenCalledWith("dashboard");
  });

  // 6. Click event works for each desktop tab
  it("calls onTabChange for each desktop tab", () => {
    const onTabChange = vi.fn();
    render(<TabSidebar activeTab="settings" onTabChange={onTabChange} />);
    const sidebar = getDesktopSidebar();
    fireEvent.click(within(sidebar).getByTestId("tab-dictate"));
    expect(onTabChange).toHaveBeenCalledWith("dictate");
    fireEvent.click(within(sidebar).getByTestId("tab-history"));
    expect(onTabChange).toHaveBeenCalledWith("history");
    fireEvent.click(within(sidebar).getByTestId("tab-settings"));
    expect(onTabChange).toHaveBeenCalledWith("settings");
  });

  // 7. Active tab in desktop has active indicator bar
  it("active tab has indicator bar on desktop", () => {
    render(<TabSidebar activeTab="history" onTabChange={vi.fn()} />);
    const sidebar = getDesktopSidebar();
    const historyTab = within(sidebar).getByTestId("tab-history");
    const indicator = historyTab.querySelector(".opacity-100");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass("w-[3px]");
  });

  // 8. Mobile nav renders all 4 tabs
  it("renders all four tabs in mobile nav", () => {
    render(<TabSidebar activeTab="dictate" onTabChange={vi.fn()} />);
    const mobile = screen.getByTestId("tab-sidebar-mobile");
    expect(within(mobile).getByTestId("tab-dashboard")).toBeInTheDocument();
    expect(within(mobile).getByTestId("tab-dictate")).toBeInTheDocument();
    expect(within(mobile).getByTestId("tab-history")).toBeInTheDocument();
    expect(within(mobile).getByTestId("tab-settings")).toBeInTheDocument();
  });

  // 9. Mobile nav click fires correctly
  it("calls onTabChange when clicking a mobile tab", () => {
    const onTabChange = vi.fn();
    render(<TabSidebar activeTab="dictate" onTabChange={onTabChange} />);
    const mobile = screen.getByTestId("tab-sidebar-mobile");
    fireEvent.click(within(mobile).getByTestId("tab-dashboard"));
    expect(onTabChange).toHaveBeenCalledWith("dashboard");
  });
});
