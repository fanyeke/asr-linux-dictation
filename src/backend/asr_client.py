"""ASR client for cloud speech recognition.

Provides ASRClient which communicates with the Mimo ASR API
(OpenAI-compatible chat completions endpoint) to transcribe audio.
"""

import base64
import logging
from typing import Any

import httpx

from backend.retry_policy import RetryExhaustedError, RetryPolicy

logger = logging.getLogger(__name__)


class ASRError(Exception):
    """ASR API error with a categorical classification.

    Attributes:
        error_category: One of "auth", "timeout", "rate_limit",
            "server_error", "malformed", or "unknown".
    """

    def __init__(self, message: str, error_category: str = "unknown") -> None:
        self.error_category = error_category
        super().__init__(message)


def _asr_is_retryable(exc: Exception) -> bool:
    """Determines whether an ASR error should be retried."""
    if isinstance(exc, ASRError):
        return exc.error_category in ("timeout", "rate_limit", "server_error")
    return RetryPolicy._is_retryable(exc)


class ASRClient:
    """Client for cloud ASR via an OpenAI-compatible chat completions endpoint.

    Args:
        api_key: API key passed in the ``api-key`` header.
        base_url: Base URL of the ASR API (default Mimo ASR).
        retry_policy: Optional RetryPolicy instance; uses default if not given.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://token-plan-cn.xiaomimimo.com/v1",
        model: str = "mimo-v2.5-asr",
        retry_policy: RetryPolicy | None = None,
    ) -> None:
        self.api_key = api_key or ""
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(30.0))
        self._retry_policy = retry_policy or RetryPolicy()
        self.supports_streaming: bool = False

    async def warmup(self) -> None:
        """Pre-warm the HTTP connection pool to the ASR API server.

        Sends a lightweight GET request to establish TCP + TLS connections.
        This is fire-and-forget — failures are logged but never raised.
        """
        try:
            await self._client.get(self.base_url, timeout=5.0)
        except Exception:
            logger.debug("ASR connection warmup failed (non-blocking)")

    async def transcribe(
        self,
        audio_bytes: bytes,
        audio_format: str = "wav",
        timeout: float = 30.0,
        language: str | None = None,
    ) -> str:
        """Transcribe audio bytes to text using the cloud ASR API.

        Uses exponential-backoff retry for retryable failures (timeout,
        5xx, 429).  Non-retryable failures (4xx other than 429, auth,
        malformed responses) are raised immediately.

        Args:
            audio_bytes: Raw audio data.
            audio_format: Audio format string (e.g. ``"wav"``, ``"mp3"``).
            timeout: Request timeout in seconds.
            language: Language code for transcription (e.g. ``"zh"``, ``"en"``).

        Returns:
            Transcribed text.

        Raises:
            ASRError: On any API or response-parsing failure, with
                ``error_category`` set appropriately.
        """
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        data_url = f"data:audio/{audio_format};base64,{audio_b64}"

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": data_url,
                                "format": audio_format,
                            },
                        },
                    ],
                },
            ],
        }
        if language and language != "auto":
            payload["language"] = language

        headers = {
            "Content-Type": "application/json",
            "api-key": self.api_key,
        }

        url = f"{self.base_url}/chat/completions"

        async def _do_request() -> str:
            """Inner HTTP call – raises ASRError on any failure."""
            try:
                response = await self._client.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=timeout,
                )
            except httpx.TimeoutException:
                raise ASRError("ASR request timed out", error_category="timeout") from None

            if response.status_code == 401:
                raise ASRError(
                    "Authentication failed (401) — check your API key",
                    error_category="auth",
                )
            if response.status_code == 429:
                raise ASRError(
                    "Rate limit exceeded (429) — try again later",
                    error_category="rate_limit",
                )
            if 500 <= response.status_code < 600:
                raise ASRError(
                    f"ASR server error: HTTP {response.status_code} {response.text[:200]}",
                    error_category="server_error",
                )
            if response.status_code >= 400:
                raise ASRError(
                    f"ASR API error: HTTP {response.status_code} {response.text[:200]}",
                    error_category="unknown",
                )

            try:
                data = response.json()
                text: str = data["choices"][0]["message"]["content"]  # type: ignore[typeddict-item]
            except (KeyError, IndexError, TypeError, ValueError) as exc:
                raise ASRError(
                    f"Malformed ASR response: {exc}",
                    error_category="malformed",
                ) from exc

            return text

        try:
            return await self._retry_policy.execute(_do_request, is_retryable=_asr_is_retryable)
        except RetryExhaustedError as exc:
            if exc.last_exception is not None:
                raise exc.last_exception from exc  # type: ignore[misc]
            raise ASRError(
                "ASR request failed after all retry attempts",
                error_category="unknown",
            ) from exc
