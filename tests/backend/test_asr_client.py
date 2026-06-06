"""Tests for the ASR client module.

All tests mock the cloud API using respx — no real network calls.
"""

import base64
import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
import respx

from backend.asr_client import ASRClient, ASRError

TEST_API_KEY = "test-key-abc123"
TEST_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1"
AUDIO_BYTES = b"fake-wav-binary-data"
TRANSCRIPT = "你好世界"


def _chat_url() -> str:
    return f"{TEST_BASE_URL}/chat/completions"


def _expected_payload(
    audio_bytes: bytes = AUDIO_BYTES,
    audio_format: str = "wav",
) -> dict:
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    data_url = f"data:audio/{audio_format};base64,{audio_b64}"
    return {
        "model": "mimo-v2.5-asr",
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


# ---------------------------------------------------------------------------
# transcribe sends correct request body and headers
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_transcribe_sends_correct_request_and_headers():
    async with respx.mock:
        route = respx.post(_chat_url()).respond(
            200,
            json={"choices": [{"message": {"content": TRANSCRIPT}}]},
        )

        client = ASRClient(api_key=TEST_API_KEY)
        result = await client.transcribe(AUDIO_BYTES)

        assert result == TRANSCRIPT
        request = route.calls[0].request
        assert request.headers["api-key"] == TEST_API_KEY
        assert request.headers["content-type"] == "application/json"
        assert str(request.url) == _chat_url()
        assert json.loads(request.content) == _expected_payload()


# ---------------------------------------------------------------------------
# transcribe returns parsed text from successful response
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_transcribe_returns_parsed_text():
    async with respx.mock:
        respx.post(_chat_url()).respond(
            200,
            json={"choices": [{"message": {"content": TRANSCRIPT}}]},
        )

        client = ASRClient(api_key=TEST_API_KEY)
        result = await client.transcribe(AUDIO_BYTES)

        assert result == TRANSCRIPT


# ---------------------------------------------------------------------------
# transcribe raises ASRError on auth failure (401)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_transcribe_raises_auth_error_on_401():
    async with respx.mock:
        respx.post(_chat_url()).respond(401)

        client = ASRClient(api_key=TEST_API_KEY)
        with pytest.raises(ASRError) as exc_info:
            await client.transcribe(AUDIO_BYTES)

        assert exc_info.value.error_category == "auth"


# ---------------------------------------------------------------------------
# transcribe raises ASRError on timeout
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_transcribe_raises_timeout_error():
    async with respx.mock:
        respx.post(_chat_url()).mock(side_effect=httpx.TimeoutException("timeout"))

        client = ASRClient(api_key=TEST_API_KEY)
        with patch("asyncio.sleep", AsyncMock()), pytest.raises(ASRError) as exc_info:
            await client.transcribe(AUDIO_BYTES)

        assert exc_info.value.error_category == "timeout"


# ---------------------------------------------------------------------------
# transcribe raises ASRError on rate limit (429)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_transcribe_raises_rate_limit_error_on_429():
    async with respx.mock:
        respx.post(_chat_url()).respond(429)

        client = ASRClient(api_key=TEST_API_KEY)
        with patch("asyncio.sleep", AsyncMock()), pytest.raises(ASRError) as exc_info:
            await client.transcribe(AUDIO_BYTES)

        assert exc_info.value.error_category == "rate_limit"


# ---------------------------------------------------------------------------
# transcribe raises ASRError on malformed response
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_transcribe_raises_malformed_error_on_bad_response():
    async with respx.mock:
        respx.post(_chat_url()).respond(200, json={})  # missing choices

        client = ASRClient(api_key=TEST_API_KEY)
        with pytest.raises(ASRError) as exc_info:
            await client.transcribe(AUDIO_BYTES)

        assert exc_info.value.error_category == "malformed"


# ---------------------------------------------------------------------------
# transcribe raises ASRError on non-dict JSON response
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_transcribe_raises_malformed_error_on_non_dict_json():
    async with respx.mock:
        respx.post(_chat_url()).respond(200, json=["not", "a", "dict"])

        client = ASRClient(api_key=TEST_API_KEY)
        with pytest.raises(ASRError) as exc_info:
            await client.transcribe(AUDIO_BYTES)

        assert exc_info.value.error_category == "malformed"


# ---------------------------------------------------------------------------
# transcribe raises ASRError on unknown HTTP error (500)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# warmup() -- connection pre-warming
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_warmup_sends_get_to_base_url():
    """Warmup sends a GET request to the base URL to establish connections."""
    async with respx.mock:
        route = respx.get(TEST_BASE_URL).respond(200, json={"status": "ok"})
        client = ASRClient(api_key=TEST_API_KEY)
        # Should not raise
        await client.warmup()
        assert route.called, "warmup should send a GET to the base URL"


@pytest.mark.asyncio
async def test_warmup_network_error_does_not_raise():
    """Warmup failures are silently logged, never raised."""
    async with respx.mock:
        respx.get(TEST_BASE_URL).mock(
            side_effect=httpx.ConnectError("Connection refused"),
        )
        client = ASRClient(api_key=TEST_API_KEY)
        # Must not raise
        await client.warmup()


@pytest.mark.asyncio
async def test_warmup_http_error_does_not_raise():
    """Even HTTP error responses from warmup are silently handled."""
    async with respx.mock:
        respx.get(TEST_BASE_URL).respond(500)
        client = ASRClient(api_key=TEST_API_KEY)
        await client.warmup()  # Must not raise


@pytest.mark.asyncio
async def test_warmup_timeout_does_not_raise():
    """Warmup timeout is silently handled."""
    async with respx.mock:
        respx.get(TEST_BASE_URL).mock(
            side_effect=httpx.TimeoutException("timed out"),
        )
        client = ASRClient(api_key=TEST_API_KEY)
        await client.warmup()  # Must not raise


@pytest.mark.asyncio
async def test_transcribe_raises_server_error_on_500():
    async with respx.mock:
        respx.post(_chat_url()).respond(500)

        client = ASRClient(api_key=TEST_API_KEY)
        with patch("asyncio.sleep", AsyncMock()), pytest.raises(ASRError) as exc_info:
            await client.transcribe(AUDIO_BYTES)

        assert exc_info.value.error_category == "server_error"
