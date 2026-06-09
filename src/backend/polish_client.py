"""Polish client for cloud LLM API to correct/polish ASR transcripts."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from backend.polish_sanitizer import sanitize_polish_output
from backend.retry_policy import RetryExhaustedError, RetryPolicy

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Layer 1: Regex pre-processing — strip obvious filler words before the LLM.
# These are unambiguous fillers that never carry meaning at the start/end of
# a sentence or between clauses.  Context-dependent words like 那个, 就是,
# 然后 are left for the LLM to judge.
# ---------------------------------------------------------------------------

# Standalone filler interjections, optionally followed by punctuation/space.
# Matches at start of string, after whitespace/punctuation, or at end of string.
_FILLER_PATTERN = re.compile(
    r"(?:^|(?<=[\s，,。！!？?、]))"   # boundary before
    r"[嗯呃啊哦噢唔]+"
    r"(?:[，,。！!？?、\s]*)",        # trailing punctuation/space
)

# Trailing fillers at end of string (no trailing punctuation needed).
_TRAILING_FILLER = re.compile(r"[，,。！!？?、\s]*[嗯呃啊哦噢唔]+\s*$")

# Repeated filler clusters like "呃呃呃" or "嗯嗯"
_REPEATED_FILLER = re.compile(r"[嗯呃啊哦噢唔]{2,}[，,。！!？?、\s]*")


def strip_fillers(text: str) -> str:
    """Remove obvious Chinese filler interjections via regex.

    This is the cheap first pass before the LLM.  Only removes unambiguous
    fillers (嗯/啊/呃/哦/噢/唔) — context-dependent words like 那个/就是/然后
    are left for the LLM layer.
    """
    result = _REPEATED_FILLER.sub("", text)
    result = _FILLER_PATTERN.sub("", result)
    result = _TRAILING_FILLER.sub("", result)
    # Clean up any double spaces or leading/trailing commas left behind.
    result = re.sub(r"[，,]{2,}", "，", result)
    result = re.sub(r"^\s*[，,。！!？?、]\s*", "", result)
    result = re.sub(r"\s{2,}", " ", result)
    return result.strip()


# ---------------------------------------------------------------------------
# Layer 2: LLM conservative cleanup prompt
# ---------------------------------------------------------------------------

class PolishError(Exception):
    """Custom exception for polish client errors."""

    def __init__(self, message: str, error_category: str = "unknown") -> None:
        self.error_category = error_category
        super().__init__(message)


def _polish_is_retryable(exc: Exception) -> bool:
    """Determines whether a polish API error should be retried."""
    if isinstance(exc, PolishError):
        return exc.error_category in ("timeout", "rate_limit", "server_error")
    return RetryPolicy._is_retryable(exc)


class PolishClient:
    """Client for the cloud LLM polish API.

    Sends ASR transcripts with optional dictionary context to the LLM
    and returns the polished text.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://api.openai.com/v1",
        model: str = "gpt-4o-mini",
        retry_policy: RetryPolicy | None = None,
    ) -> None:
        self._api_key = api_key or ""
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(30.0))
        self._retry_policy = retry_policy or RetryPolicy()

    async def warmup(self) -> None:
        """Pre-warm the HTTP connection pool to the LLM API server.

        Sends a lightweight GET request to establish TCP + TLS connections.
        This is fire-and-forget — failures are logged but never raised.
        """
        try:
            await self._client.get(self._base_url, timeout=5.0)
        except Exception:
            logger.debug("LLM connection warmup failed (non-blocking)")

    async def polish(
        self,
        raw_text: str,
        prompt_template: str,
        dictionary_entries: list[dict] | None = None,
        timeout: float = 30.0,
    ) -> str:
        """Send a raw transcript to the LLM and return the polished text.

        Uses exponential-backoff retry for retryable failures (timeout,
        5xx, 429).  The returned text is sanitized via
        ``sanitize_polish_output()`` to strip common LLM artifacts.

        Args:
            raw_text: The raw ASR transcript to polish.
            prompt_template: Template string with {text} placeholder.
            dictionary_entries: Optional list of dicts with 'term'/'definition'.
            timeout: HTTP request timeout in seconds.

        Returns:
            Polished text from the LLM, or raw_text on failure.

        Raises:
            PolishError: On auth failure, rate limiting, or timeout.
        """
        # Layer 1: cheap regex pre-processing
        preprocessed = strip_fillers(raw_text)
        if not preprocessed:
            return raw_text

        # Layer 2: LLM conservative cleanup — minimal intervention only
        polish_instruction = (
            "你是一个 ASR 文本清理专家。你的任务是对语音识别的原始文本做最小程度的修正。"
            "只做以下操作，不要做其他任何修改：\n"
            "1. 去除残余的语气词和口头禅（那个、就是说、对吧 等，仅在无实际语义时）\n"
            "2. 去除无意义的重复（如'我觉得我觉得'→'我觉得'）\n"
            "3. 添加标点符号（逗号、句号、问号）\n"
            "4. 修正明显的错别字\n\n"
            "严格禁止：\n"
            "- 不要改写、重述或正式化表达\n"
            "- 不要改变原意或增删信息\n"
            "- 不要调整语序\n"
            "- 输出长度必须与输入接近，不得大幅缩短\n"
            "- 只返回修正后的纯文本，不要加任何解释"
        )

        few_shot = (
            "示例 1：\n"
            "原文：呃我觉得这个方案那个挺好的\n"
            "修正：我觉得这个方案挺好的。\n\n"
            "示例 2：\n"
            "原文：你现在帮我看一下那个就是那个 F12 的 bug\n"
            "修正：你现在帮我看一下 F12 的 bug。\n\n"
            "示例 3：\n"
            "原文：回答一下你是谁\n"
            "修正：回答一下你是谁\n\n"
            "示例 4：\n"
            "原文：然后那个润色似乎还是不能用就是说它没有真正做润色\n"
            "修正：然后润色似乎还是不能用，它没有真正做润色。\n"
        )

        # Build user prompt with dictionary terms inline
        user_content_parts: list[str] = [
            polish_instruction,
            "",
            few_shot,
        ]

        if dictionary_entries:
            entries_text = _format_dictionary(dictionary_entries)
            user_content_parts.extend([
                "",
                entries_text,
            ])

        user_content_parts.extend([
            "",
            f"原文：{preprocessed}",
            "修正：",
        ])

        user_content = "\n".join(user_content_parts)

        messages: list[dict[str, str]] = [
            {"role": "user", "content": user_content}
        ]

        body: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": 0.1,
            "thinking": {"type": "disabled"},
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }

        async def _do_request() -> str:
            """Inner HTTP call – raises PolishError on retryable failures,
            returns raw_text on non-retryable failures."""
            try:
                response = await self._client.post(
                    f"{self._base_url}/chat/completions",
                    headers=headers,
                    content=json.dumps(body),
                    timeout=timeout,
                )
            except httpx.TimeoutException:
                raise PolishError(
                    "API request timed out", error_category="timeout"
                ) from None

            status = response.status_code

            if status == 401:
                raise PolishError(
                    "Authentication failed: invalid LLM API key",
                    error_category="auth",
                )
            if status == 429:
                raise PolishError(
                    "Rate limit exceeded", error_category="rate_limit"
                )
            if 500 <= status < 600:
                raise PolishError(
                    f"API server error: HTTP {status}",
                    error_category="server_error",
                )
            if status >= 400:
                return preprocessed

            try:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError, json.JSONDecodeError):
                return preprocessed

            if not content:
                return preprocessed

            return content

        try:
            result = await self._retry_policy.execute(
                _do_request, is_retryable=_polish_is_retryable
            )
        except RetryExhaustedError as exc:
            if exc.last_exception is not None:
                raise exc.last_exception from exc
            return preprocessed

        # Sanitize the LLM output before returning
        return sanitize_polish_output(result)


def _format_dictionary(entries: list[dict]) -> str:
    """Format dictionary entries into a prompt context string.

    Instructs the LLM to replace canonical/pronunciation variants with
    the canonical term.
    """
    lines: list[str] = [
        "【术语替换】以下是你必须执行的术语替换规则：",
        "请将原文中出现的以下术语（包括发音相近或拼写相近的变体）",
        "**强制替换**为规范写法。即使原文只有轻微差异，也必须替换：",
    ]
    for entry in entries:
        term = entry.get("term", "")
        definition = entry.get("definition", "")
        pronunciation = entry.get("pronunciation", "")
        if pronunciation:
            lines.append(
                f"  → 规范写法：{term}"
                f"（注意：原文可能出现 '{pronunciation}' 这种发音/拼写相近的形式）"
                f"{(': ' + definition) if definition else ''}"
            )
        else:
            lines.append(f"  → 规范写法：{term}{(': ' + definition) if definition else ''}")
    lines.append("  必须执行上述替换，不能只清理语气词。")
    return "\n".join(lines)
