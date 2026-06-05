# Testing Patterns

**Analysis Date:** 2026-06-05

## Test Framework

**Backend (Python):**
- Runner: `pytest` >= 8.0.0 with `pytest-asyncio` >= 0.23.0
- Config: `pyproject.toml`
  ```toml
  [tool.pytest.ini_options]
  testpaths = ["tests/backend"]
  pythonpath = ["src"]
  asyncio_mode = "auto"
  markers = ["real_api: tests that call real cloud APIs"]
  ```
- Coverage: `pytest-cov` >= 7.1.0 (in dependency-groups dev)

**Frontend (TypeScript/React):**
- Runner: `vitest` ^1.6.0
- Environment: `jsdom`
- Config: `vitest.config.ts`
  ```typescript
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "tests/electron/**/*.test.{ts,tsx}",
      "src/electron/renderer/components/**/__tests__/*.test.{ts,tsx}"
    ],
  }
  ```
- Assertion library: `@testing-library/jest-dom` ^6.9.1

**Run Commands:**
```bash
# Python backend tests
uv run pytest

# Python with coverage
uv run pytest --cov

# Frontend renderer tests
npm run test        # vitest run (CI)
npm run test:watch  # vitest (watch mode)

# Real API tests (opt-in, requires env var)
ASR_LINUX_RUN_REAL_API=1 uv run pytest -m real_api
```

## Test File Organization

**Location:**
- Python: `tests/backend/` — 22 test files covering the entire backend
- React components (co-located): `src/electron/renderer/components/__tests__/` and `src/electron/renderer/components/ui/__tests__/`
- React pages (separate): `tests/electron/renderer/components/`, `tests/electron/renderer/overlay/`, `tests/electron/renderer/settings/`
- Electron main: `tests/electron/backend-supervisor.test.ts`

**Naming:**
- Python: `test_<module_name>.py` — e.g., `test_asr_client.py`, `test_dictation_orchestrator.py`
- TypeScript: `*.test.{ts,tsx}` — e.g., `RecordingButton.test.tsx`, `settings-window.test.tsx`

**Structure:**
```
tests/
├── backend/
│   ├── conftest.py          # Shared fixtures (FastAPI client)
│   ├── test_baseline.py     # Health endpoint smoke test
│   ├── test_api.py          # Route protection, token auth, LLM probes
│   ├── test_asr_client.py   # Cloud ASR API client
│   ├── test_audio_recorder.py
│   ├── test_clipboard_manager.py
│   ├── test_config.py       # Settings validation
│   ├── test_config_store.py
│   ├── test_database.py
│   ├── test_diagnostics.py
│   ├── test_dictation_orchestrator.py  # Full pipeline integration
│   ├── test_dictation_routes.py
│   ├── test_dictionary_manager.py
│   ├── test_history_retry.py
│   ├── test_history_store.py
│   ├── test_logging.py      # JSON format, rotation, redaction
│   ├── test_polish_client.py
│   ├── test_polish_sanitizer.py
│   ├── test_prompt_manager.py
│   ├── test_retry_policy.py
│   ├── test_text_injector.py
│   └── test_websocket.py
└── electron/
    ├── baseline.test.ts
    ├── backend-supervisor.test.ts
    └── renderer/
        ├── components/
        ├── overlay/
        └── settings/
```

## Test Structure

**Python — Function-based tests:**
```python
@pytest.mark.asyncio
async def test_transcribe_returns_parsed_text():
    async with respx.mock:
        respx.post(_chat_url()).respond(200, json={...})
        client = ASRClient(api_key=TEST_API_KEY)
        result = await client.transcribe(AUDIO_BYTES)
        assert result == TRANSCRIPT
```

**Python — Class-based tests (preferred for grouped behavior):**
```python
class TestAudioRecorderStart:
    """Tests for AudioRecorder.start()."""

    @pytest.mark.asyncio
    async def test_start_recording(self, recorder, mock_create_subprocess, make_mock_process) -> None:
        """start() returns a session_id and sets is_recording to True."""
        ...
```

**TypeScript — React component tests:**
```typescript
/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

describe("RecordingButton", () => {
  const onStart = vi.fn();
  const onStop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows idle state with Mic icon and Start Recording label", () => {
    render(<RecordingButton isRecording={false} isProcessing={false} onStart={onStart} onStop={onStop} />);
    expect(screen.getByTestId("recording-mic")).toBeInTheDocument();
    expect(screen.getByTestId("recording-label")).toHaveTextContent("Start Recording");
  });
});
```

**Patterns:**
- Use `pytest.mark.asyncio` on every async test function
- Use docstrings on test functions describing the behavior under test
- Section comments divide test files by feature area:
  ```python
  # ------------------------------------------------------------------
  # Success path
  # ------------------------------------------------------------------
  ```
- `beforeEach(() => { vi.clearAllMocks(); })` resets mocks between React tests

## Mocking

**Python — HTTP API mocking:**
- Use `respx` to mock HTTP at the transport boundary (not deep inside the pipeline)
- Always use `async with respx.mock:` context manager
- Example from `tests/backend/test_asr_client.py`:
  ```python
  async with respx.mock:
      route = respx.post(_chat_url()).respond(200, json={"choices": [...]})
      client = ASRClient(api_key=TEST_API_KEY)
      result = await client.transcribe(AUDIO_BYTES)
      assert request.headers["api-key"] == TEST_API_KEY
  ```

**Python — Monkeypatching:**
- Use `pytest.MonkeyPatch` for environment variables and module-level functions
- Example from `tests/backend/test_audio_recorder.py`:
  ```python
  @pytest.fixture
  def mock_create_subprocess():
      with patch("backend.audio_recorder.asyncio.create_subprocess_exec", new_callable=AsyncMock) as mock:
          yield mock
  ```

**Python — Async mocking:**
- Use `AsyncMock` from `unittest.mock` for async methods
- Patch `asyncio.sleep` with `AsyncMock()` to speed up retry/backoff tests:
  ```python
  with patch("asyncio.sleep", AsyncMock()):
      result = await policy.execute(eventually_succeeds)
  ```

**TypeScript — Vitest mocking:**
- Mock `window.voiceAPI` in renderer tests (never call Python directly):
  ```typescript
  const mockVoiceAPI = {
    getBackendConfig: vi.fn().mockResolvedValue(mockBackendConfig),
    startDictation: vi.fn(),
    stopDictation: vi.fn(),
    onStatusUpdate: vi.fn().mockReturnValue(vi.fn()),
  };
  Object.assign(window, { voiceAPI: mockVoiceAPI });
  ```
- Mock `fetch` globally for backend integration tests:
  ```typescript
  vi.stubGlobal("fetch", defaultFetch);
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
  ```
- Mock i18n translations to avoid async loading:
  ```typescript
  vi.mock("../../../../src/electron/renderer/lib/i18n.js", () => ({
    useTranslation: () => ({ t: (key: string) => map[key] || key })
  }));
  ```

**What to Mock:**
- Cloud HTTP APIs (respx / mocked fetch)
- Audio subprocesses (`arecord`)
- `asyncio.sleep` in retry/backoff tests
- Clipboard tools (`xsel`, `xclip`)
- Desktop commands (`xdotool`, `xprop`)
- `window.voiceAPI` in renderer tests

**What NOT to Mock:**
- The code under test itself (split at real boundaries instead)
- Internal data transformations (test them directly)
- SQLite persistence layer (use temporary databases)

## Fixtures and Factories

**Shared Fixtures (`tests/backend/conftest.py`):**
```python
@pytest.fixture
async def client():
    """Async HTTP client for FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

**Test-local fixtures:**
```python
@pytest.fixture(autouse=True)
async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Initialize database for each test."""
    monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
    await init_database()
    yield
```

**Factory fixtures:**
```python
@pytest.fixture
def make_mock_process():
    def _make(stderr_lines: list[str] | None = None) -> MockProcess:
        return MockProcess(stderr_lines=stderr_lines)
    return _make
```

**TypeScript mock factories:**
```typescript
function createMockVoiceAPI() {
  return {
    getBackendConfig: vi.fn<() => Promise<typeof mockBackendConfig | null>>(),
    startDictation: vi.fn<() => Promise<void>>(),
    // ...
  };
}
```

## Coverage

**Requirements:** Not explicitly enforced in CI, but `pytest-cov` is installed.

**View Coverage:**
```bash
uv run pytest --cov=backend --cov-report=term-missing
uv run pytest --cov=backend --cov-report=html
```

## Test Types

**Unit Tests:**
- Pure functions and state machines
- Fast, no I/O, run often
- Examples: `strip_fillers()` regex tests, `RetryPolicy` backoff math, `Settings` validation

**Integration Tests:**
- SQLite with temporary databases (`tmp_path` + `monkeypatch`)
- Local backend routes via ASGI transport (`httpx.AsyncClient` + `ASGITransport`)
- WebSocket events via fake WebSocket objects
- File cleanup with temporary directories
- Mocked cloud APIs (default test runs)

**Contract Tests:**
- Electron-to-backend API shape verification
- Request/response schema validation
- IPC handler contracts

**E2E Tests:**
- Not currently implemented
- Playwright reserved for GUI smoke tests after app shell exists

## TDD Requirements

Per `docs/tdd.md`:

**TDD is required for:**
- API client request building, response parsing, timeout handling, retry decisions
- ASR and polish pipeline state transitions
- Prompt rendering and dictionary/term replacement behavior
- History persistence, failed-audio retention, and cleanup rules
- Logging configuration, log rotation, and log redaction
- Text injection decision logic
- Configuration validation and migration

**TDD loop:**
1. Write or update the smallest test that describes expected behavior
2. Run the test and confirm it fails for the right reason
3. Implement the smallest change that makes it pass
4. Run the relevant test set
5. Refactor only while tests stay green

**Cloud API mocking rule:**
- Cloud ASR and LLM APIs must be mocked in default test runs
- Real API tests are opt-in and skipped unless `ASR_LINUX_RUN_REAL_API=1` is set
- Mark real API tests with `@pytest.mark.real_api`

## Common Patterns

**Async Testing:**
```python
@pytest.mark.asyncio
async def test_async_behavior():
    with patch("asyncio.sleep", AsyncMock()):
        result = await service.do_something()
    assert result == expected
```

**Error Testing:**
```python
with pytest.raises(ASRError) as exc_info:
    await client.transcribe(b"audio")
assert exc_info.value.error_category == "timeout"
```

**Database Isolation:**
```python
@pytest.fixture(autouse=True)
async def setup_db(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ASR_LINUX_DATA_DIR", str(tmp_path))
    await init_database()
    yield
```

**State Reset Between Tests:**
```python
@pytest.fixture(autouse=True)
def reset_probe_client():
    FakeProbeClient.status_code = 200
    FakeProbeClient.calls = []
    yield
```

**React Component State Testing:**
```typescript
it("calls onStart when clicked in idle state", () => {
  render(<RecordingButton isRecording={false} isProcessing={false} onStart={onStart} onStop={onStop} />);
  fireEvent.click(screen.getByTestId("start-recording-btn"));
  expect(onStart).toHaveBeenCalledTimes(1);
});
```

**Async React Testing:**
```typescript
it("renders the API configuration section", async () => {
  mockFetchOnce([]);
  render(<SettingsWindow />);
  await waitFor(() => {
    expect(screen.getByLabelText("ASR API Key")).toBeInTheDocument();
  });
});
```

## Testing Best Practices Observed

1. **Mock at the boundary:** HTTP APIs mocked at the transport level (`respx`), not inside business logic
2. **Use temporary resources:** `tmp_path` for files, `monkeypatch` for env vars, in-memory SQLite
3. **Test both success and failure paths:** Every feature file has happy-path and error-path tests
4. **Test redaction:** Logging tests verify secrets are not written to disk
5. **Test idempotency:** Double-start on recorder returns same session_id; stop when not recording returns None
6. **Avoid real network in default runs:** All cloud API tests use `respx.mock` or mocked `fetch`
7. **Render tests use `data-testid`:** Components expose `data-testid` attributes for reliable test selection
8. **Accessibility in tests:** Use `screen.getByRole()`, `screen.getByLabelText()` where possible
9. **Patch `asyncio.sleep`:** Prevents slow tests when testing retry/backoff behavior
10. **Reset global state:** `autouse=True` fixtures clear connection lists and mock state between tests

---

*Testing analysis: 2026-06-05*
