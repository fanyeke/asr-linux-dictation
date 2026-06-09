"""Tests for PolishClient module."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
import respx

from backend.polish_client import PolishClient, PolishError, strip_fillers

BASE_URL = "https://api.openai.com/v1"


# ---------------------------------------------------------------------------
# Layer 1 tests: strip_fillers regex
# ---------------------------------------------------------------------------


class TestStripFillers:
    """Tests for the regex filler removal pre-processing."""

    def test_removes_standalone_filler(self) -> None:
        assert strip_fillers("呃我觉得可以") == "我觉得可以"

    def test_removes_multiple_fillers(self) -> None:
        assert strip_fillers("嗯，呃，那个方案不错") == "那个方案不错"

    def test_removes_repeated_filler(self) -> None:
        assert strip_fillers("嗯嗯嗯好的") == "好的"

    def test_preserves_non_filler_content(self) -> None:
        assert strip_fillers("回答一下你是谁") == "回答一下你是谁"

    def test_handles_filler_at_end(self) -> None:
        result = strip_fillers("我觉得可以嗯")
        assert "嗯" not in result
        assert "我觉得可以" in result

    def test_handles_empty_after_fillers(self) -> None:
        # If the entire text is fillers, returns empty (which causes fallback)
        result = strip_fillers("嗯嗯嗯")
        assert result.strip() == ""

    def test_preserves_context_dependent_words(self) -> None:
        # 那个, 就是, 然后 are NOT removed by regex — left for LLM
        text = "那个方案我觉得就是很好然后就这样吧"
        result = strip_fillers(text)
        assert "那个" in result
        assert "就是" in result
        assert "然后" in result


@pytest.fixture
def client() -> PolishClient:
    """Return a PolishClient with a test api-key."""
    return PolishClient(api_key="test-key-123")


@pytest.mark.asyncio
async def test_polish_sends_correct_request(client: PolishClient) -> None:
    """Polish sends a POST with the rendered prompt and correct headers."""
    with respx.mock:
        route = respx.post(f"{BASE_URL}/chat/completions").mock(
            return_value=httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": "修正后的文本"}}],
                },
            )
        )

        result = await client.polish(
            raw_text="我吃过了",
            prompt_template="请修正以下文本：{text}",
        )

        assert result == "修正后的文本"
        assert route.called
        assert route.calls[0].request.headers["authorization"] == "Bearer test-key-123"
        assert "api-key" not in route.calls[0].request.headers
        request_body = route.calls[0].request.content
        body = json.loads(request_body)
        assert body["model"] == "gpt-4o-mini"
        last_msg = body["messages"][-1]
        assert last_msg["role"] == "user"
        assert "原文：我吃过了" in last_msg["content"]
        assert "修正：" in last_msg["content"]
        assert "示例" in last_msg["content"]


@pytest.mark.asyncio
async def test_polish_returns_parsed_text(client: PolishClient) -> None:
    """Polish returns sanitized content from the API response."""
    with respx.mock:
        respx.post(f"{BASE_URL}/chat/completions").mock(
            return_value=httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": " polished output "}}],
                },
            )
        )

        result = await client.polish(
            raw_text="hello world",
            prompt_template="correct: {text}",
        )

        # Sanitizer strips leading/trailing whitespace
        assert result == "polished output"


@pytest.mark.asyncio
async def test_polish_includes_dictionary_entries(client: PolishClient) -> None:
    """Polish includes dictionary entries in system context when provided."""
    with respx.mock:
        route = respx.post(f"{BASE_URL}/chat/completions").mock(
            return_value=httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": "修正后文本"}}],
                },
            )
        )

        entries = [
            {"term": "ASR", "definition": "自动语音识别"},
            {"term": "NLP", "definition": "自然语言处理"},
        ]

        await client.polish(
            raw_text="ASR 和 NLP",
            prompt_template="修正：{text}",
            dictionary_entries=entries,
        )

        body = json.loads(route.calls[0].request.content)
        assert len(body["messages"]) == 1
        # User message contains both dictionary context and the polish prompt
        assert body["messages"][0]["role"] == "user"
        assert "ASR" in body["messages"][0]["content"]
        assert "自动语音识别" in body["messages"][0]["content"]
        assert "NLP" in body["messages"][0]["content"]
        assert "自然语言处理" in body["messages"][0]["content"]
        assert "原文：ASR 和 NLP" in body["messages"][0]["content"]
        assert "修正：" in body["messages"][0]["content"]
        assert "示例" in body["messages"][0]["content"]


@pytest.mark.asyncio
async def test_polish_raises_on_server_error(client: PolishClient) -> None:
    """Polish raises PolishError with server_error category on 5xx."""
    with respx.mock:
        respx.post(f"{BASE_URL}/chat/completions").mock(return_value=httpx.Response(500, text="Internal Server Error"))

        with (
            patch("asyncio.sleep", AsyncMock()),
            pytest.raises(PolishError) as exc_info,
        ):
            await client.polish(
                raw_text="keep me",
                prompt_template="template: {text}",
            )

        assert exc_info.value.error_category == "server_error"


@pytest.mark.asyncio
async def test_polish_raises_on_auth_failure(client: PolishClient) -> None:
    """Polish raises PolishError with auth category on 401."""
    with respx.mock:
        respx.post(f"{BASE_URL}/chat/completions").mock(return_value=httpx.Response(401, text="Unauthorized"))

        with pytest.raises(PolishError) as exc_info:
            await client.polish(
                raw_text="test",
                prompt_template="template: {text}",
            )

        assert exc_info.value.error_category == "auth"


@pytest.mark.asyncio
async def test_polish_raises_on_timeout(client: PolishClient) -> None:
    """Polish raises PolishError with timeout category on httpx.TimeoutException."""
    with respx.mock:
        respx.post(f"{BASE_URL}/chat/completions").mock(side_effect=httpx.TimeoutException("Connection timed out"))

        with (
            patch("asyncio.sleep", AsyncMock()),
            pytest.raises(PolishError) as exc_info,
        ):
            await client.polish(
                raw_text="test",
                prompt_template="template: {text}",
            )

        assert exc_info.value.error_category == "timeout"


@pytest.mark.asyncio
async def test_polish_fallback_on_empty_content(client: PolishClient) -> None:
    """Polish returns raw_text when API returns empty content."""
    with respx.mock:
        respx.post(f"{BASE_URL}/chat/completions").mock(
            return_value=httpx.Response(
                200,
                json={
                    "choices": [{"message": {"content": ""}}],
                },
            )
        )

        result = await client.polish(
            raw_text="fallback please",
            prompt_template="template: {text}",
        )

        assert result == "fallback please"


@pytest.mark.asyncio
async def test_polish_fallback_on_malformed_response(client: PolishClient) -> None:
    """Polish returns raw_text when API response is missing expected fields."""
    with respx.mock:
        respx.post(f"{BASE_URL}/chat/completions").mock(
            return_value=httpx.Response(
                200,
                json={"unexpected": "structure"},
            )
        )

        result = await client.polish(
            raw_text="malformed fallback",
            prompt_template="template: {text}",
        )

        assert result == "malformed fallback"


# ---------------------------------------------------------------------------
# warmup() -- connection pre-warming
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_warmup_sends_get_to_base_url(client: PolishClient) -> None:
    """Warmup sends a GET request to establish connections."""
    with respx.mock:
        route = respx.get(BASE_URL).respond(200, json={"status": "ok"})
        await client.warmup()
        assert route.called


@pytest.mark.asyncio
async def test_warmup_network_error_does_not_raise(client: PolishClient) -> None:
    """Warmup failures are silently logged, never raised."""
    with respx.mock:
        respx.get(BASE_URL).mock(
            side_effect=httpx.ConnectError("Connection refused"),
        )
        await client.warmup()  # Must not raise


@pytest.mark.asyncio
async def test_warmup_timeout_does_not_raise(client: PolishClient) -> None:
    """Warmup timeout is silently handled."""
    with respx.mock:
        respx.get(BASE_URL).mock(
            side_effect=httpx.TimeoutException("timed out"),
        )
        await client.warmup()  # Must not raise


@pytest.mark.asyncio
async def test_polish_raises_on_rate_limit(client: PolishClient) -> None:
    """Polish raises PolishError with rate_limit category on 429."""
    with respx.mock:
        respx.post(f"{BASE_URL}/chat/completions").mock(return_value=httpx.Response(429, text="Too Many Requests"))

        with (
            patch("asyncio.sleep", AsyncMock()),
            pytest.raises(PolishError) as exc_info,
        ):
            await client.polish(
                raw_text="test",
                prompt_template="template: {text}",
            )

        assert exc_info.value.error_category == "rate_limit"
