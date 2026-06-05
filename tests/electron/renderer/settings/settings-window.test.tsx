/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { SettingsWindow } from "../../../../src/electron/renderer/settings/settings-window";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockPrompts = [
  { id: 1, name: "General", template: "Polish this", is_active: true },
  { id: 2, name: "Technical", template: "Fix grammar", is_active: false },
];

const mockDictionary = [
  {
    id: 1,
    canonical_term: "ASR",
    aliases: "automatic speech recognition",
    notes: "",
    category: "tech",
    enforcement_level: "suggested",
  },
  {
    id: 2,
    canonical_term: "FastAPI",
    aliases: null,
    notes: "Python web framework",
    category: "tech",
    enforcement_level: "suggested",
  },
];

const mockHistory = [
  {
    id: 1,
    session_id: "sess_001",
    raw_text: "hello world",
    polished_text: "Hello, world!",
    status: "completed",
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: 2,
    session_id: "sess_002",
    raw_text: "test failed",
    status: "failed",
    error_type: "asr_error",
    created_at: "2025-01-02T00:00:00Z",
  },
];

const mockBackendConfig = { url: "http://localhost:8000", token: "test-token-abc" };

// ---------------------------------------------------------------------------
// Mock window.voiceAPI
// ---------------------------------------------------------------------------

function createMockVoiceAPI() {
  return {
    getBackendConfig: vi.fn<() => Promise<typeof mockBackendConfig | null>>(),
    startDictation: vi.fn<() => Promise<void>>(),
    stopDictation: vi.fn<() => Promise<any>>(),
    showOverlay: vi.fn<() => void>(),
    hideOverlay: vi.fn<() => void>(),
    onStatusUpdate: vi
      .fn<(cb: (status: unknown) => void) => () => void>()
      .mockReturnValue(vi.fn()),
    onMicrophoneLevel: vi
      .fn<(cb: (level: number) => void) => () => void>()
      .mockReturnValue(vi.fn()),
    onToggleDictation: vi
      .fn<(cb: () => void) => () => void>()
      .mockReturnValue(vi.fn()),
    getHotkey: vi.fn<() => Promise<string | null>>().mockResolvedValue("F12"),
    setHotkey: vi.fn<(hotkey: string) => Promise<string | null>>(),
  };
}

let mockVoiceAPI: ReturnType<typeof createMockVoiceAPI>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock fetch to return a successful JSON response. */
function mockFetchOnce(data: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

/** Mock fetch with an array of responses for sequential calls. */
function mockFetchSequence(responses: unknown[]) {
  const mock = vi.fn<(...args: unknown[]) => Promise<Response>>();
  responses.forEach((data) => {
    mock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    } as Response);
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(mock);
  return mock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockVoiceAPI = createMockVoiceAPI();
  (window as any).voiceAPI = mockVoiceAPI;
  mockVoiceAPI.getBackendConfig.mockResolvedValue(mockBackendConfig);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsWindow", () => {
  it("renders the API configuration section", async () => {
    mockFetchOnce([]);
    render(<SettingsWindow />);

    await waitFor(() => {
      expect(screen.getByLabelText("ASR API Key")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("LLM API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("Enable LLM Polish")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save api settings/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /test asr key/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /test llm key/i }),
    ).toBeInTheDocument();
  });

  it("saves separate ASR and LLM API settings", async () => {
    const fetchMock = mockFetchSequence([
      [],
      [],
      [],
      {
        asr_api_key: "asr-old",
        llm_api_key: "llm-old",
        asr_base_url: "https://asr.example.com/v1",
        asr_model: "asr-old-model",
        llm_enabled: true,
        llm_base_url: "https://api.openai.com/v1",
        llm_model: "gpt-4o-mini",
        hotkey: "Alt+=",
      },
    ]);

    render(<SettingsWindow />);

    await waitFor(() => {
      expect(screen.getByLabelText("ASR API Key")).toHaveValue("asr-old");
    });

    fireEvent.change(screen.getByLabelText("ASR API Key"), {
      target: { value: "asr-new" },
    });
    fireEvent.change(screen.getByLabelText("LLM API Key"), {
      target: { value: "llm-new" },
    });
    fireEvent.change(screen.getByLabelText("LLM Base URL"), {
      target: { value: "https://llm.example.com/v1" },
    });
    fireEvent.change(screen.getByLabelText("LLM Model"), {
      target: { value: "gpt-test" },
    });
    fireEvent.click(screen.getByLabelText("Enable LLM Polish"));
    fireEvent.click(screen.getByRole("button", { name: /save api settings/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        `${mockBackendConfig.url}/config`,
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        }),
      );
    });

    const body = JSON.parse(
      (fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string,
    );
    expect(body).toMatchObject({
      asr_api_key: "asr-new",
      llm_api_key: "llm-new",
      llm_enabled: false,
      llm_base_url: "https://llm.example.com/v1",
      llm_model: "gpt-test",
    });
    expect(body).not.toHaveProperty("api_key");
  });

  it("toggles ASR and LLM API key visibility", async () => {
    mockFetchSequence([
      [],
      [],
      [],
      {
        asr_api_key: "asr-secret",
        llm_api_key: "llm-secret",
        asr_base_url: "https://asr.example.com/v1",
        asr_model: "asr-model",
        llm_enabled: true,
        llm_base_url: "https://api.openai.com/v1",
        llm_model: "gpt-4o-mini",
        hotkey: "Alt+=",
      },
    ]);

    render(<SettingsWindow />);

    const asrInput = await screen.findByLabelText("ASR API Key");
    const llmInput = screen.getByLabelText("LLM API Key");

    expect(asrInput).toHaveAttribute("type", "password");
    expect(llmInput).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show ASR API Key" }));
    fireEvent.click(screen.getByRole("button", { name: "Show LLM API Key" }));

    expect(asrInput).toHaveAttribute("type", "text");
    expect(llmInput).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Hide ASR API Key" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide LLM API Key" }));

    expect(asrInput).toHaveAttribute("type", "password");
    expect(llmInput).toHaveAttribute("type", "password");
  });

  it("captures hotkey from keyboard events instead of text entry", async () => {
    mockFetchOnce([]);
    mockVoiceAPI.setHotkey.mockResolvedValue("Ctrl+Shift+K");

    render(<SettingsWindow />);

    const hotkeyInput = await screen.findByLabelText("Global Hotkey");
    expect(hotkeyInput).toHaveAttribute("readonly");

    fireEvent.change(hotkeyInput, { target: { value: "typed text" } });
    expect(hotkeyInput).toHaveValue("Alt+=");

    fireEvent.keyDown(hotkeyInput, {
      key: "k",
      code: "KeyK",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(hotkeyInput).toHaveValue("Ctrl+Shift+K");

    fireEvent.click(screen.getByRole("button", { name: /save hotkey/i }));

    await waitFor(() => {
      expect(mockVoiceAPI.setHotkey).toHaveBeenCalledWith("Ctrl+Shift+K");
    });
  });

  it("ignores dictation hotkey toggles while editing the hotkey field", async () => {
    mockFetchOnce([]);

    let toggleCallback: (() => void) | undefined;
    mockVoiceAPI.onToggleDictation.mockImplementation((cb: () => void) => {
      toggleCallback = cb;
      return vi.fn();
    });

    render(<SettingsWindow />);

    const hotkeyInput = await screen.findByLabelText("Global Hotkey");
    expect(toggleCallback).toBeDefined();

    fireEvent.focus(hotkeyInput);
    fireEvent.keyDown(hotkeyInput, {
      key: "=",
      code: "Equal",
      altKey: true,
    });

    await act(async () => {
      toggleCallback!();
    });

    expect(mockVoiceAPI.startDictation).not.toHaveBeenCalled();

    fireEvent.blur(hotkeyInput);

    await act(async () => {
      toggleCallback!();
    });

    await waitFor(() => {
      expect(mockVoiceAPI.startDictation).toHaveBeenCalledTimes(1);
    });
  });

  it("renders the microphone test section", async () => {
    mockFetchOnce([]);
    render(<SettingsWindow />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /start recording/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders prompts from mock data", async () => {
    mockFetchOnce(mockPrompts);

    render(<SettingsWindow />);

    await waitFor(() => {
      expect(screen.getByText("General")).toBeInTheDocument();
      expect(screen.getByText("Technical")).toBeInTheDocument();
    });
  });

  it("renders dictionary entries from mock data", async () => {
    mockFetchSequence([[], mockDictionary, mockHistory]);

    render(<SettingsWindow />);

    await waitFor(() => {
      expect(screen.getByText("ASR")).toBeInTheDocument();
    });

    expect(screen.getByText("FastAPI")).toBeInTheDocument();
  });

  it("renders history sessions with status badges", async () => {
    mockFetchSequence([[], [], mockHistory]);

    render(<SettingsWindow />);

    await waitFor(() => {
      expect(screen.getByText("completed")).toBeInTheDocument();
      expect(screen.getByText("failed")).toBeInTheDocument();
    });
  });

  it("calls the backend health endpoint on 'Test Connection' click", async () => {
    // Stub initial data fetch
    mockFetchOnce([]);
    render(<SettingsWindow />);

    // Wait for initial load to complete (the Test Connection button becomes visible)
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /test asr key/i }),
      ).toBeInTheDocument();
    });

    // Replace fetch with a spy for the test-asr-key call
    const testSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ valid: true, message: "ASR key is valid" }),
      } as Response);

    fireEvent.click(screen.getByRole("button", { name: /test asr key/i }));

    await waitFor(() => {
      expect(testSpy).toHaveBeenCalledWith(
        `${mockBackendConfig.url}/test-asr-key`,
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-token": mockBackendConfig.token,
          }),
        }),
      );
    });
  });

  it("saves the typed ASR key before testing it", async () => {
    mockFetchSequence([
      [],
      [],
      [],
      {
        asr_api_key: "",
        llm_api_key: "",
        asr_base_url: "https://asr.example.com/v1",
        asr_model: "asr-model",
        llm_enabled: true,
        llm_base_url: "https://api.openai.com/v1",
        llm_model: "gpt-4o-mini",
        hotkey: "Alt+=",
      },
    ]);

    render(<SettingsWindow />);

    const asrKeyInput = await screen.findByLabelText("ASR API Key");
    fireEvent.change(asrKeyInput, {
      target: { value: "typed-asr-key" },
    });

    const testFetch = vi.fn<(...args: unknown[]) => Promise<Response>>();
    testFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(""),
    } as Response);
    testFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ valid: true, message: "ASR key is valid" }),
    } as Response);
    vi.spyOn(globalThis, "fetch").mockImplementation(testFetch);

    fireEvent.click(screen.getByRole("button", { name: /test asr key/i }));

    await waitFor(() => {
      expect(testFetch).toHaveBeenNthCalledWith(
        1,
        `${mockBackendConfig.url}/config`,
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        }),
      );
      expect(testFetch).toHaveBeenNthCalledWith(
        2,
        `${mockBackendConfig.url}/test-asr-key`,
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-token": mockBackendConfig.token,
          }),
        }),
      );
    });

    const saveBody = JSON.parse(
      (testFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(saveBody).toMatchObject({
      asr_api_key: "typed-asr-key",
      asr_base_url: "https://asr.example.com/v1",
      asr_model: "asr-model",
    });
  });

  it("saves the typed LLM settings before testing them", async () => {
    mockFetchSequence([
      [],
      [],
      [],
      {
        asr_api_key: "",
        llm_api_key: "",
        asr_base_url: "https://asr.example.com/v1",
        asr_model: "asr-model",
        llm_enabled: true,
        llm_base_url: "https://api.openai.com/v1",
        llm_model: "gpt-4o-mini",
        hotkey: "Alt+=",
      },
    ]);

    render(<SettingsWindow />);

    const llmKeyInput = await screen.findByLabelText("LLM API Key");
    fireEvent.change(llmKeyInput, {
      target: { value: "typed-llm-key" },
    });
    fireEvent.change(screen.getByLabelText("LLM Base URL"), {
      target: { value: "https://llm.example.com/v1" },
    });
    fireEvent.change(screen.getByLabelText("LLM Model"), {
      target: { value: "gpt-test" },
    });

    const testFetch = vi.fn<(...args: unknown[]) => Promise<Response>>();
    testFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(""),
    } as Response);
    testFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ valid: true, message: "LLM key is valid" }),
    } as Response);
    vi.spyOn(globalThis, "fetch").mockImplementation(testFetch);

    fireEvent.click(screen.getByRole("button", { name: /test llm key/i }));

    await waitFor(() => {
      expect(testFetch).toHaveBeenNthCalledWith(
        1,
        `${mockBackendConfig.url}/config`,
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        }),
      );
      expect(testFetch).toHaveBeenNthCalledWith(
        2,
        `${mockBackendConfig.url}/test-llm-key`,
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-token": mockBackendConfig.token,
          }),
        }),
      );
    });

    const saveBody = JSON.parse(
      (testFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(saveBody).toMatchObject({
      llm_api_key: "typed-llm-key",
      llm_base_url: "https://llm.example.com/v1",
      llm_model: "gpt-test",
    });
  });

  it("updates the level bar when microphone level events arrive", async () => {
    mockFetchOnce([]);

    let levelCallback: ((level: number) => void) | undefined;
    mockVoiceAPI.onMicrophoneLevel.mockImplementation(
      (cb: (level: number) => void) => {
        levelCallback = cb;
        return vi.fn();
      },
    );

    render(<SettingsWindow />);

    // Wait for initial load to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /start recording/i }),
      ).toBeInTheDocument();
    });

    // Simulate incoming mic levels
    expect(levelCallback).toBeDefined();

    act(() => {
      levelCallback!(0.75);
      levelCallback!(0.5);
    });

    await waitFor(() => {
      const levelBar = screen.getByTestId("mic-level-bar");
      const innerBar = levelBar.querySelector("div");
      expect(innerBar).toHaveStyle({ width: "50%" });
    });
  });

  it("renders the diagnostics section with masked token and URL", async () => {
    mockFetchOnce([]);

    render(<SettingsWindow />);

    await waitFor(() => {
      expect(screen.getByText(/http:\/\/localhost:8000/)).toBeInTheDocument();
    });

    // Token should be partially masked (first 4 + last 4 visible)
    expect(screen.getByText(/test.*abc/)).toBeInTheDocument();
  });

  it("shows an error state when backend config cannot be loaded", async () => {
    mockVoiceAPI.getBackendConfig.mockResolvedValue(null);

    render(<SettingsWindow />);

    await waitFor(() => {
      expect(
        screen.getByText(/failed to load backend configuration/i),
      ).toBeInTheDocument();
    });
  });

  it("ignores hotkey toggles while stop processing is still pending", async () => {
    mockFetchOnce([]);

    let toggleCallback: (() => void) | undefined;
    mockVoiceAPI.onToggleDictation.mockImplementation((cb: () => void) => {
      toggleCallback = cb;
      return vi.fn();
    });

    let resolveStop: (value: unknown) => void = () => undefined;
    mockVoiceAPI.startDictation.mockResolvedValue(undefined);
    mockVoiceAPI.stopDictation.mockReturnValue(
      new Promise((resolve) => {
        resolveStop = resolve;
      }),
    );

    render(<SettingsWindow />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start recording/i })).toBeInTheDocument();
    });
    expect(toggleCallback).toBeDefined();

    await act(async () => {
      toggleCallback!();
    });
    await waitFor(() => {
      expect(mockVoiceAPI.startDictation).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      toggleCallback!();
    });
    await waitFor(() => {
      expect(mockVoiceAPI.stopDictation).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      toggleCallback!();
    });

    expect(mockVoiceAPI.startDictation).toHaveBeenCalledTimes(1);
    expect(mockVoiceAPI.stopDictation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveStop({ status: "completed" });
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start recording/i })).toBeInTheDocument();
    });

    await act(async () => {
      toggleCallback!();
    });

    await waitFor(() => {
      expect(mockVoiceAPI.startDictation).toHaveBeenCalledTimes(2);
    });
  });
});
