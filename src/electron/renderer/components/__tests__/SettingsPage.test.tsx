/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SettingsPage } from "../SettingsPage.js";
import { ThemeProvider } from "../ThemeProvider.js";
import type { BackendConfig } from "../../settings/types.js";
import type { ReactNode } from "react";

const mockBackendConfig: BackendConfig = {
  url: "http://127.0.0.1:42003",
  token: "test-token-12345678",
};

const mockResponse = (ok: boolean, data: unknown) =>
  Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
  } as Response);

const defaultFetch = vi.fn((url: string) => {
  if (url.includes("/config") && !url.includes("test") && !url.includes("export")) {
    return mockResponse(true, {
      asr_api_key: "asr-key-123",
      llm_api_key: "llm-key-456",
      llm_enabled: true,
      hotkey: "Alt+=",
    });
  }
  if (url.includes("/prompts") || url.includes("/dictionary")) {
    return mockResponse(true, []);
  }
  if (url.includes("/export")) {
    return mockResponse(true, new Blob());
  }
  return mockResponse(true, { message: "ok" });
});

function renderWithTheme(ui: ReactNode) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

const mockVoiceAPI = {
  getBackendConfig: vi.fn().mockResolvedValue(mockBackendConfig),
  getHotkey: vi.fn().mockResolvedValue("Alt+="),
  setHotkey: vi.fn().mockResolvedValue("Alt+="),
  startDictation: vi.fn(),
  stopDictation: vi.fn(),
  showOverlay: vi.fn(),
  hideOverlay: vi.fn(),
  onStatusUpdate: vi.fn().mockReturnValue(vi.fn()),
  onMicrophoneLevel: vi.fn().mockReturnValue(vi.fn()),
  onToggleDictation: vi.fn().mockReturnValue(vi.fn()),
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", defaultFetch);
    // Mock matchMedia for jsdom compatibility
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    // Patch voiceAPI on the existing window
    Object.assign(window, { voiceAPI: mockVoiceAPI });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as { voiceAPI?: unknown }).voiceAPI;
    vi.clearAllMocks();
  });

  // 1. Renders the title
  it("renders the settings title", async () => {
    renderWithTheme(
      <SettingsPage
        backendConfig={mockBackendConfig}
        onToast={vi.fn()}
        onHotkeyChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });

  // 2. Renders all section cards
  it("renders all section headings", async () => {
    renderWithTheme(
      <SettingsPage
        backendConfig={mockBackendConfig}
        onToast={vi.fn()}
        onHotkeyChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("API Configuration")).toBeInTheDocument();
      expect(screen.getByText("Prompt Management")).toBeInTheDocument();
      expect(screen.getByText("Dictionary Management")).toBeInTheDocument();
      expect(screen.getByText("Diagnostics")).toBeInTheDocument();
    });
  });

  // 3. Shows empty state for prompts
  it("shows empty state when no prompts exist", async () => {
    renderWithTheme(
      <SettingsPage
        backendConfig={mockBackendConfig}
        onToast={vi.fn()}
        onHotkeyChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      const emptyStates = screen.getAllByTestId("empty-state");
      expect(emptyStates.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("No prompts yet")).toBeInTheDocument();
    });
  });

  // 4. Shows empty state for dictionary
  it("shows empty state when no dictionary entries exist", async () => {
    renderWithTheme(
      <SettingsPage
        backendConfig={mockBackendConfig}
        onToast={vi.fn()}
        onHotkeyChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      const emptyStates = screen.getAllByTestId("empty-state");
      // Should have at least 2 empty states (prompts + dictionary)
      expect(emptyStates.length).toBeGreaterThanOrEqual(2);
    });
  });

  // 5. Shows input fields
  it("renders API key inputs", async () => {
    renderWithTheme(
      <SettingsPage
        backendConfig={mockBackendConfig}
        onToast={vi.fn()}
        onHotkeyChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText("ASR API Key")).toBeInTheDocument();
      expect(screen.getByLabelText("LLM API Key")).toBeInTheDocument();
    });
  });

  // 6. Shows save and test buttons
  it("renders action buttons", async () => {
    renderWithTheme(
      <SettingsPage
        backendConfig={mockBackendConfig}
        onToast={vi.fn()}
        onHotkeyChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  // 7. Shows diagnostics info
  it("renders diagnostics with backend URL and token", async () => {
    renderWithTheme(
      <SettingsPage
        backendConfig={mockBackendConfig}
        onToast={vi.fn()}
        onHotkeyChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("http://127.0.0.1:42003")).toBeInTheDocument();
      // Token should be masked: test-token-12345678 -> test••••5678
      expect(screen.getByText("test••••5678")).toBeInTheDocument();
    });
  });

  // 8. Shows Open Logs button
  it("renders Open Logs button in diagnostics", async () => {
    renderWithTheme(
      <SettingsPage
        backendConfig={mockBackendConfig}
        onToast={vi.fn()}
        onHotkeyChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Open Logs")).toBeInTheDocument();
    });
  });

  // 9. Shows Export Diagnostics button
  it("renders Export Diagnostics button", async () => {
    renderWithTheme(
      <SettingsPage
        backendConfig={mockBackendConfig}
        onToast={vi.fn()}
        onHotkeyChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Export Diagnostics")).toBeInTheDocument();
    });
  });

  // 10. Shows connection badges
  it("displays connection badges", async () => {
    renderWithTheme(
      <SettingsPage
        backendConfig={mockBackendConfig}
        onToast={vi.fn()}
        onHotkeyChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      const badges = screen.getAllByTestId("badge");
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });
  });

  // 11. Shows normal page when no backend config (loading resolves quickly)
  it("renders settings page even without backend config", async () => {
    renderWithTheme(
      <SettingsPage
        backendConfig={null}
        onToast={vi.fn()}
        onHotkeyChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      // The component should still render the title
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });
});
