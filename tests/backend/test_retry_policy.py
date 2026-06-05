"""Tests for the RetryPolicy module."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from backend.retry_policy import RetryExhaustedError, RetryPolicy


class TestRetryPolicy:
    """Test suite for RetryPolicy exponential backoff with jitter."""

    # ------------------------------------------------------------------
    # Success on first attempt
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_success_on_first_attempt(self) -> None:
        """Returns the result immediately when the call succeeds."""
        policy = RetryPolicy(max_attempts=3)

        async def succeed() -> str:
            return "ok"

        result = await policy.execute(succeed)
        assert result == "ok"

    # ------------------------------------------------------------------
    # Success on second attempt after retryable failure
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_success_after_retryable_failure(self) -> None:
        """Retries and returns the result when the first attempt fails with
        a retryable error (e.g. a 5xx status)."""
        policy = RetryPolicy(max_attempts=3, base_delay=0.01)
        call_count = 0

        async def eventually_succeeds() -> str:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("500 Internal Server Error")
            return "success"

        with patch("asyncio.sleep", AsyncMock()):
            result = await policy.execute(eventually_succeeds)

        assert result == "success"
        assert call_count == 2

    # ------------------------------------------------------------------
    # Failure after max retries on persistent retryable error
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_failure_after_max_retries(self) -> None:
        """Raises RetryExhaustedError after exhausting all attempts."""
        policy = RetryPolicy(max_attempts=3, base_delay=0.01)
        call_count = 0

        async def always_fails() -> str:
            nonlocal call_count
            call_count += 1
            raise RuntimeError("503 Service Unavailable")

        with patch("asyncio.sleep", AsyncMock()), pytest.raises(
            RetryExhaustedError
        ) as exc_info:
            await policy.execute(always_fails)

        assert call_count == 3  # initial + 2 retries = 3 total
        assert "503" in str(exc_info.value) or "retry" in str(exc_info.value).lower()

    # ------------------------------------------------------------------
    # No retry on non-retryable error (4xx except 429)
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_no_retry_on_non_retryable_error(self) -> None:
        """Does not retry on non-retryable errors (e.g. 4xx)."""
        policy = RetryPolicy(max_attempts=3, base_delay=0.01)
        call_count = 0

        # A non-retryable error — the policy should re-raise immediately
        class NonRetryableError(Exception):
            def __init__(self) -> None:
                super().__init__("bad request (400)")

        def is_retryable(exc: Exception) -> bool:
            return False

        async def fail_with_400() -> str:
            nonlocal call_count
            call_count += 1
            raise NonRetryableError()

        with patch("asyncio.sleep", AsyncMock()), pytest.raises(NonRetryableError):
            await policy.execute(
                fail_with_400,
                is_retryable=is_retryable,
            )

        assert call_count == 1  # no retry

    # ------------------------------------------------------------------
    # Backoff delays increase
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_backoff_delays_increase(self) -> None:
        """Each retry delay is greater than the previous one (backoff)."""
        policy = RetryPolicy(max_attempts=4, base_delay=1.0, max_delay=30.0)
        call_count = 0
        recorded_delays: list[float] = []

        async def fail_three_times() -> str:
            nonlocal call_count
            call_count += 1
            if call_count <= 3:
                raise RuntimeError("502 Bad Gateway")
            return "ok"

        async def fake_sleep(delay: float) -> None:
            recorded_delays.append(delay)

        with patch("asyncio.sleep", fake_sleep):
            result = await policy.execute(fail_three_times)

        assert result == "ok"
        assert call_count == 4  # 3 failures + 1 success
        assert len(recorded_delays) == 3  # 3 retries = 3 sleeps
        # Each delay should be larger than the previous
        for i in range(1, len(recorded_delays)):
            assert recorded_delays[i] >= recorded_delays[i - 1], (
                f"Delay {recorded_delays[i]} should be >= previous {recorded_delays[i-1]}"
            )

    # ------------------------------------------------------------------
    # Default is_retryable handles HTTP-like error classification
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_default_is_retryable_accepts_retryable_errors(self) -> None:
        """The default is_retryable returns True for timeout, 5xx, and 429."""
        policy = RetryPolicy(max_attempts=3, base_delay=0.01)

        # These should be considered retryable
        assert policy._is_retryable(TimeoutError("timeout"))
        assert policy._is_retryable(RuntimeError("500 Internal Server Error"))
        assert policy._is_retryable(RuntimeError("429 Too Many Requests"))

    @pytest.mark.asyncio
    async def test_default_is_retryable_rejects_non_retryable(self) -> None:
        """The default is_retryable returns False for non-retryable errors."""
        policy = RetryPolicy(max_attempts=3, base_delay=0.01)

        # These should NOT be retryable
        assert not policy._is_retryable(RuntimeError("400 Bad Request"))
        assert not policy._is_retryable(RuntimeError("403 Forbidden"))
        assert not policy._is_retryable(RuntimeError("404 Not Found"))
        assert not policy._is_retryable(ValueError("some other error"))
