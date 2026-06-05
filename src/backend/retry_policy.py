"""Retry policy with exponential backoff and jitter for HTTP requests.

Provides RetryPolicy, an async wrapper that retries callables on
retryable failures (timeout, 5xx, 429) with configurable exponential
backoff and random jitter.
"""

from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

T = TypeVar("T")


class RetryExhaustedError(Exception):
    """Raised when all retry attempts have been exhausted."""

    def __init__(self, message: str, last_exception: Exception | None = None) -> None:
        self.last_exception = last_exception
        super().__init__(message)


class RetryPolicy:
    """Async retry policy with exponential backoff and jitter.

    Args:
        max_attempts: Maximum number of execution attempts (default 3).
        base_delay: Base delay in seconds for backoff calculation (default 1.0).
        max_delay: Maximum delay in seconds (default 30.0).
    """

    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 30.0,
    ) -> None:
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay

    async def execute(
        self,
        callable: Callable[..., Awaitable[T]],
        *args: Any,
        **kwargs: Any,
    ) -> T:
        """Execute *callable* with retries on retryable failures.

        Args:
            callable: An async callable to execute.
            *args: Positional arguments forwarded to *callable*.
            **kwargs: Keyword arguments forwarded to *callable*.

        Kwargs:
            is_retryable: Optional callable ``(Exception) -> bool`` that
                determines whether an exception is retryable.  When omitted
                the default heuristic is used.

        Returns:
            The result of the successful callable invocation.

        Raises:
            RetryExhaustedError: After all attempts are exhausted.
            Any non-retryable exception is re-raised immediately.
        """
        is_retryable_fn = kwargs.pop("is_retryable", None)
        if is_retryable_fn is None:
            is_retryable_fn = self._is_retryable

        last_exception: Exception | None = None

        for attempt in range(self.max_attempts):
            try:
                return await callable(*args, **kwargs)
            except Exception as exc:
                last_exception = exc
                if not is_retryable_fn(exc):
                    raise
                if attempt < self.max_attempts - 1:
                    delay = self._backoff_delay(attempt)
                    await asyncio.sleep(delay)

        # All attempts exhausted
        raise RetryExhaustedError(
            f"All {self.max_attempts} retry attempts exhausted. "
            f"Last error: {last_exception}",
            last_exception=last_exception,
        )

    def _backoff_delay(self, attempt: int) -> float:
        """Calculate backoff delay with jitter for the given *attempt* index."""
        delay = self.base_delay * (2.0**attempt)
        capped = min(delay, self.max_delay)
        jitter = random.uniform(0, self.base_delay)
        return capped + jitter

    @staticmethod
    def _is_retryable(exc: Exception) -> bool:
        """Default retry classification.

        Returns True for:
        - TimeoutError (including httpx.TimeoutException)
        - RuntimeError whose message suggests a 5xx or 429 status

        Returns False for everything else (including 4xx errors other than 429).
        """
        if isinstance(exc, TimeoutError):
            return True

        msg = str(exc).lower()
        # 5xx server errors
        if "500" in msg or "502" in msg or "503" in msg or "504" in msg:
            return True
        # 429 rate limit
        return "429" in msg
