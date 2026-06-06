# Coding Conventions

**Analysis Date:** 2026-06-05

## Naming Patterns

**Files:**
- Python modules: `snake_case.py` — e.g., `asr_client.py`, `dictation_orchestrator.py`
- TypeScript/React components: `PascalCase.tsx` — e.g., `RecordingButton.tsx`, `SettingsPage.tsx`
- Test files: `test_*.py` (Python), `*.test.tsx` (React) — e.g., `test_asr_client.py`, `RecordingButton.test.tsx`
- Config files: kebab-case — e.g., `vite.renderer.config.ts`

**Functions:**
- Python: `snake_case` for all functions and methods
  - Private methods: `_leading_underscore` — e.g., `_backoff_delay()`, `_is_retryable()`
  - Async functions: prefixed with `async def` — e.g., `async def transcribe()`
- TypeScript: `camelCase` for functions and methods
  - React components: `PascalCase` function name — e.g., `export function RecordingButton()`
  - Utility functions: `camelCase` — e.g., `cn(...)` in `src/electron/renderer/lib/utils.ts`

**Variables:**
- Python: `snake_case` — e.g., `audio_bytes`, `session_id`, `error_category`
- TypeScript: `camelCase` — e.g., `isRecording`, `onStart`, `settingsWindow`
- Constants: `UPPER_SNAKE_CASE` in Python, `camelCase` or `PascalCase` in TS
- Type annotations are mandatory: Python uses `str | None`, TypeScript uses explicit types

**Types:**
- Python: Use `from __future__ import annotations` for forward references
  - Custom exceptions: PascalCase ending in `Error` — e.g., `ASRError`, `RetryExhaustedError`, `PolishError`
  - Pydantic models: PascalCase — e.g., `Settings(BaseSettings)`
- TypeScript: Interfaces use `PascalCase` — e.g., `ButtonProps`, `RecordingButtonProps`
  - Type aliases: `PascalCase` — e.g., `ButtonVariant`, `ButtonSize`

**Classes:**
- Python: `PascalCase` — e.g., `ASRClient`, `RetryPolicy`, `DictationOrchestrator`
- Test classes: `TestPascalCase` — e.g., `TestAudioRecorderStart`, `TestHistoryStore`

## Code Style

**Formatting:**
- Python: Ruff (line-length 100, target Python 3.11)
  - Config in `pyproject.toml`:
    ```toml
    [tool.ruff]
    line-length = 100
    target-version = "py311"
    ```
- TypeScript: No explicit formatter configured (no Prettier config found)
  - `tsc --noEmit` is used as lint check (`npm run lint`)
  - Strict mode enabled in `tsconfig.json`

**Linting:**
- Python: Ruff with rules `E`, `F`, `W`, `I`, `N`, `UP`, `B`, `C4`, `SIM`
  - Google docstyle convention enforced via pydocstyle
  - Run: `ruff check .` or via `uv run ruff check .`
- TypeScript: TypeScript compiler (`tsc --noEmit`) for type checking
  - No ESLint or Biome configuration present

**Import Organization:**
- Python: Standard library → third-party → local (enforced by Ruff rule `I`)
  - Example from `src/backend/dictation_orchestrator.py`:
    ```python
    import asyncio
    import time
    import uuid
    from collections.abc import Awaitable, Callable
    from typing import Any

    from backend.asr_client import ASRClient, ASRError
    from backend.config import Settings
    ```
- TypeScript: React imports first, then third-party libraries, then local modules
  - Aliases used for i18n in vitest config to resolve `../lib/i18n` paths

## Error Handling

**Patterns:**
- Custom exceptions with categorical error types:
  ```python
  class ASRError(Exception):
      def __init__(self, message: str, error_category: str = "unknown") -> None:
          self.error_category = error_category
          super().__init__(message)
  ```
- Error categories: `"auth"`, `"timeout"`, `"rate_limit"`, `"server_error"`, `"malformed"`, `"unknown"`
- Pipeline errors prefixed with stage: `f"asr:{e.error_category}"`, `f"inject:{type(e).__name__}"`
- Use `from None` for exception chaining when the original traceback is not relevant:
  ```python
  except httpx.TimeoutException:
      raise ASRError("ASR request timed out", error_category="timeout") from None
  ```
- TypeScript: Functions return result objects or throw; no `Result<T, E>` pattern observed

## Logging

**Framework:** `structlog` (Python backend only)

**Patterns:**
- Use `get_logger(__name__)` from `backend.logging_config`
- Structured logging with keyword arguments (not string interpolation):
  ```python
  logger.info("pipeline_started", session_id=session_id, audio_bytes=len(audio_bytes))
  logger.error("asr_failed", session_id=session_id, error=str(e), category=e.error_category)
  ```
- Log redaction for secrets: API keys, tokens, and authorization headers are masked to `***`
- JSON Lines format for log files with rotation by size
- Correlation IDs tracked via `session_id` across a single dictation session

## Comments

**When to Comment:**
- Module-level docstrings for every Python file explaining purpose
- Google-style docstrings for classes and public methods:
  ```python
  """Client for cloud ASR via an OpenAI-compatible chat completions endpoint.

  Args:
      api_key: API key passed in the ``api-key`` header.
      base_url: Base URL of the ASR API (default Mimo ASR).
      retry_policy: Optional RetryPolicy instance; uses default if not given.
  """
  ```
- Inline comments only for non-obvious logic (e.g., timing explanations in `main.ts`)
- Section dividers in large files:
  ```python
  # ------------------------------------------------------------------
  # Success path
  # ------------------------------------------------------------------
  ```

**JSDoc/TSDoc:**
- TypeScript files use minimal JSDoc; types are expressed via TypeScript annotations
- Electron main process uses block comments for function documentation

## Function Design

**Size:** Functions should fit on screen (~30 lines). Larger functions are split at logical boundaries.

**Parameters:**
- Use keyword arguments for optional parameters in Python
- Use TypeScript interfaces for component props
- Default values defined at the parameter level

**Return Values:**
- Python async functions return typed values: `async def transcribe(...) -> str:`
- Dictation pipeline returns session dicts: `dict` with `status`, `raw_text`, `polished_text`, etc.
- TypeScript components return `JSX.Element`

## Module Design

**Exports:**
- Python: explicit imports, no wildcard imports
- TypeScript: named exports for components: `export function Button()`, `export const Button = forwardRef(...)`
- Barrel files not used; import directly from source

**File Size:**
- If a file exceeds 200 lines during implementation, consider splitting per `docs/modules.md` boundaries

## Type Annotations

**Python:**
- Use union syntax `str | None` (Python 3.11+)
- TypeVar for generics: `T = TypeVar("T")`
- `collections.abc` for abstract base classes: `Awaitable`, `Callable`

**TypeScript:**
- Strict mode enabled: `"strict": true` in `tsconfig.json`
- Explicit return types on exported functions
- Interface extension for HTML attributes: `interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>`

## Tailwind CSS Conventions

**Utility Composition:**
- Use `cn()` helper from `src/electron/renderer/lib/utils.ts` to merge Tailwind classes:
  ```typescript
  import { cn } from "../lib/utils.js";
  className={cn("bg-brand-600", isDisabled && "opacity-50")}
  ```
- `clsx` + `tailwind-merge` for conditional class merging
- Custom color tokens: `brand-500`, `dark-700`, `text-tertiary`

## Async Patterns

**Python:**
- All I/O is async using `asyncio`
- `pytest-asyncio` with `auto` mode (no explicit event loop fixture needed)
- `AsyncMock` from `unittest.mock` for mocking async methods

**TypeScript:**
- `async/await` for Promise-based operations
- IPC handlers use `async` functions: `ipcMain.handle("start-dictation", async () => { ... })`

---

*Convention analysis: 2026-06-06 (refreshed)*
