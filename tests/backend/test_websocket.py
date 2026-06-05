"""Tests for WebSocket event stream."""

import asyncio
from typing import Any

import pytest

import backend.main as main


class FakeWebSocket:
    """Minimal WebSocket fake for endpoint contract tests."""

    def __init__(self, token: str | None = None) -> None:
        self.query_params = {"token": token} if token is not None else {}
        self.accepted = False
        self.closed_code: int | None = None
        self.sent_json: list[dict] = []
        self._messages: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    async def accept(self) -> None:
        self.accepted = True

    async def close(self, code: int = 1000) -> None:
        self.closed_code = code

    async def send_json(self, data: dict) -> None:
        self.sent_json.append(data)

    async def receive(self) -> dict[str, Any]:
        return await self._messages.get()

    async def push_text(self, text: str) -> None:
        await self._messages.put({"type": "websocket.receive", "text": text})

    async def push_disconnect(self) -> None:
        await self._messages.put({"type": "websocket.disconnect"})


async def wait_for_sent(websocket: FakeWebSocket, count: int) -> None:
    """Wait until the fake has at least ``count`` sent JSON messages."""
    for _ in range(100):
        if len(websocket.sent_json) >= count:
            return
        await asyncio.sleep(0.01)
    raise AssertionError(f"Timed out waiting for {count} WebSocket messages")


@pytest.fixture(autouse=True)
def clear_ws_connections() -> None:
    """Ensure tests do not share connection state."""
    main._ws_connections.clear()


class TestWebSocketConnection:
    """Test WebSocket endpoint."""

    @pytest.mark.asyncio
    async def test_websocket_connects(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """WebSocket connection can be established with valid token."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "ws-test-token")
        websocket = FakeWebSocket(token="ws-test-token")

        task = asyncio.create_task(main.websocket_endpoint(websocket))  # type: ignore[arg-type]
        await wait_for_sent(websocket, 1)
        await websocket.push_disconnect()
        await task

        assert websocket.accepted is True
        assert websocket.sent_json[0]["type"] == "connected"
        assert websocket not in main._ws_connections

    @pytest.mark.asyncio
    async def test_websocket_rejects_no_token(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """WebSocket connection is rejected without token."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "ws-test-token")
        websocket = FakeWebSocket()

        await main.websocket_endpoint(websocket)  # type: ignore[arg-type]

        assert websocket.accepted is False
        assert websocket.closed_code == 1008

    @pytest.mark.asyncio
    async def test_websocket_rejects_invalid_token(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """WebSocket connection is rejected with invalid token."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "ws-test-token")
        websocket = FakeWebSocket(token="invalid")

        await main.websocket_endpoint(websocket)  # type: ignore[arg-type]

        assert websocket.accepted is False
        assert websocket.closed_code == 1008

    @pytest.mark.asyncio
    async def test_websocket_receives_events(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """WebSocket receives pushed events."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "ws-test-token")
        websocket = FakeWebSocket(token="ws-test-token")

        task = asyncio.create_task(main.websocket_endpoint(websocket))  # type: ignore[arg-type]
        await wait_for_sent(websocket, 1)

        response = await main.broadcast_event(
            {"type": "test_event", "payload": "hello"},
            None,  # type: ignore[arg-type]
        )
        await wait_for_sent(websocket, 2)
        await websocket.push_disconnect()
        await task

        assert response == {"status": "broadcasted", "clients": 1}
        assert websocket.sent_json[0]["type"] == "connected"
        assert websocket.sent_json[1] == {"type": "test_event", "payload": "hello"}

    @pytest.mark.asyncio
    async def test_websocket_ping_pong(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """WebSocket responds to ping messages."""
        monkeypatch.setenv("ASR_LINUX_SECRET_TOKEN", "ws-test-token")
        websocket = FakeWebSocket(token="ws-test-token")

        task = asyncio.create_task(main.websocket_endpoint(websocket))  # type: ignore[arg-type]
        await wait_for_sent(websocket, 1)
        await websocket.push_text("ping")
        await wait_for_sent(websocket, 2)
        await websocket.push_disconnect()
        await task

        assert websocket.sent_json[1] == {"type": "pong"}

