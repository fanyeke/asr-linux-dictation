"""Tests for AudioRecorder module."""

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from backend.audio_recorder import AudioRecorder
from backend.config import Settings


class MockProcess:
    """Mock for asyncio.subprocess.Process to simulate arecord."""

    def __init__(self, stderr_lines: list[str] | None = None) -> None:
        self.returncode: int | None = None
        self._terminated = False
        self._reader = asyncio.StreamReader()
        self.stderr = self._reader
        if stderr_lines:
            for line in stderr_lines:
                self._reader.feed_data((line.rstrip("\n") + "\n").encode())
        self._reader.feed_eof()
        self._wait_event = asyncio.Event()

    async def wait(self) -> int:
        """Wait for process to exit."""
        await self._wait_event.wait()
        self.returncode = 0
        return 0

    def terminate(self) -> None:
        """Terminate the process."""
        self._terminated = True
        self.returncode = 0
        self._wait_event.set()

    def kill(self) -> None:
        """Kill the process."""
        self.returncode = -9
        self._wait_event.set()

    def send_signal(self, signal: int) -> None:
        """Send a signal (no-op in mock)."""
        pass


@pytest.fixture
def mock_create_subprocess():
    """Mock asyncio.create_subprocess_exec to return a fake process."""
    with patch(
        "backend.audio_recorder.asyncio.create_subprocess_exec",
        new_callable=AsyncMock,
    ) as mock:
        yield mock


@pytest.fixture
def make_mock_process():
    """Factory fixture for MockProcess."""

    def _make(stderr_lines: list[str] | None = None) -> MockProcess:
        return MockProcess(stderr_lines=stderr_lines)

    return _make


@pytest.fixture
def recorder(tmp_path: Path) -> AudioRecorder:
    """Create an AudioRecorder with isolated data dir."""
    settings = Settings(data_dir=tmp_path)
    return AudioRecorder(settings=settings)


class TestAudioRecorderStart:
    """Tests for AudioRecorder.start()."""

    @pytest.mark.asyncio
    async def test_start_recording(
        self,
        recorder: AudioRecorder,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """start() returns a session_id and sets is_recording to True."""
        mock_proc = make_mock_process()
        mock_create_subprocess.return_value = mock_proc

        session_id = await recorder.start()

        assert isinstance(session_id, str)
        assert len(session_id) > 0
        assert recorder.is_recording is True
        mock_create_subprocess.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_start_uses_correct_command(
        self,
        recorder: AudioRecorder,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """start() invokes arecord with correct arguments."""
        mock_proc = make_mock_process()
        mock_create_subprocess.return_value = mock_proc

        await recorder.start()

        args, _ = mock_create_subprocess.await_args
        assert args[0] == "arecord"
        assert "-f" in args
        assert "-r" in args
        assert "-c" in args
        assert "--vumeter=stereo" in args

    @pytest.mark.asyncio
    async def test_start_with_custom_device(
        self,
        tmp_path: Path,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """start() includes -D device argument when audio_device is set."""
        mock_proc = make_mock_process()
        mock_create_subprocess.return_value = mock_proc
        settings = Settings(data_dir=tmp_path, audio_device="plughw:1,0")
        recorder = AudioRecorder(settings=settings)

        await recorder.start()

        args, _ = mock_create_subprocess.await_args
        assert "-D" in args
        dev_idx = args.index("-D")
        assert args[dev_idx + 1] == "plughw:1,0"

    @pytest.mark.asyncio
    async def test_start_creates_recordings_dir(
        self,
        recorder: AudioRecorder,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """start() creates the recordings directory."""
        mock_proc = make_mock_process()
        mock_create_subprocess.return_value = mock_proc

        await recorder.start()

        recordings_dir = recorder.settings.data_dir / "recordings"
        assert recordings_dir.is_dir()

    @pytest.mark.asyncio
    async def test_double_start_raises(
        self,
        recorder: AudioRecorder,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """Calling start() twice while recording is idempotent."""
        mock_proc = make_mock_process()
        mock_create_subprocess.return_value = mock_proc

        first_id = await recorder.start()
        second_id = await recorder.start()

        assert first_id == second_id
        assert recorder.is_recording

        # Cleanup
        mock_proc.terminate()

    @pytest.mark.asyncio
    async def test_start_failure_cleanup(
        self,
        recorder: AudioRecorder,
        mock_create_subprocess: AsyncMock,
    ) -> None:
        """If arecord fails to start, no resources are leaked."""
        mock_create_subprocess.side_effect = OSError("Device not found")

        with pytest.raises(OSError):
            await recorder.start()

        assert recorder.is_recording is False
        assert recorder._process is None
        assert recorder._session_id is None


class TestAudioRecorderStop:
    """Tests for AudioRecorder.stop()."""

    @pytest.mark.asyncio
    async def test_stop_recording(
        self,
        recorder: AudioRecorder,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """stop() returns a Path and terminates the process."""
        mock_proc = make_mock_process()
        mock_create_subprocess.return_value = mock_proc

        await recorder.start()
        output_path = await recorder.stop()

        assert isinstance(output_path, Path)
        assert recorder.is_recording is False
        assert mock_proc._terminated is True

    @pytest.mark.asyncio
    async def test_stop_when_not_recording(
        self,
        recorder: AudioRecorder,
    ) -> None:
        """stop() returns None when not recording (idempotent)."""
        result = await recorder.stop()
        assert result is None

    @pytest.mark.asyncio
    async def test_stop_returns_path_with_wav_suffix(
        self,
        recorder: AudioRecorder,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """stop() returns a path ending in .wav."""
        mock_proc = make_mock_process()
        mock_create_subprocess.return_value = mock_proc

        await recorder.start()
        output_path = await recorder.stop()

        assert output_path.suffix == ".wav"

    @pytest.mark.asyncio
    async def test_audio_file_exists_after_stop(
        self,
        recorder: AudioRecorder,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """After stop(), the recorded audio file exists on disk."""
        mock_proc = make_mock_process()
        mock_create_subprocess.return_value = mock_proc

        await recorder.start()
        # Simulate arecord creating the file
        assert recorder._output_path is not None
        recorder._output_path.write_bytes(b"\x00" * 1024)

        output_path = await recorder.stop()
        assert output_path.exists()
        assert output_path.stat().st_size == 1024


class TestAudioRecorderLevel:
    """Tests for audio level monitoring."""

    @pytest.mark.asyncio
    async def test_get_level_default(
        self,
        recorder: AudioRecorder,
    ) -> None:
        """get_level() returns 0.0 when not recording."""
        level = await recorder.get_level()
        assert level == 0.0

    @pytest.mark.asyncio
    async def test_get_level_after_monitoring(
        self,
        recorder: AudioRecorder,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """get_level() returns parsed VU meter levels."""
        mock_proc = make_mock_process(
            stderr_lines=[
                "#+                                                 | 25%",
                "##+                                                | 50%",
            ]
        )
        mock_create_subprocess.return_value = mock_proc

        await recorder.start()
        # Let the level monitor task process stderr
        await asyncio.sleep(0.01)

        level = await recorder.get_level()
        # 50% = 0.5
        assert 0.4 < level < 0.6

        # Cleanup
        await recorder.stop()

    @pytest.mark.asyncio
    async def test_level_in_range(
        self,
        recorder: AudioRecorder,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """get_level() returns values between 0.0 and 1.0."""
        mock_proc = make_mock_process(
            stderr_lines=[
                "                                                   | 00%",
                "#+                                                 | 25%",
                "####+                                              | 100%",
            ]
        )
        mock_create_subprocess.return_value = mock_proc

        await recorder.start()
        await asyncio.sleep(0.01)

        level = await recorder.get_level()
        assert 0.0 <= level <= 1.0

        # Cleanup
        await recorder.stop()

    @pytest.mark.asyncio
    async def test_level_stays_zero_with_no_vu_data(
        self,
        recorder: AudioRecorder,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """Without VU data, get_level() remains 0.0."""
        mock_proc = make_mock_process(stderr_lines=["Some other output"])
        mock_create_subprocess.return_value = mock_proc

        await recorder.start()
        await asyncio.sleep(0.01)

        level = await recorder.get_level()
        assert level == 0.0

        # Cleanup
        await recorder.stop()


class TestAudioRecorderSilence:
    """Tests for silence detection and auto-stop."""

    @pytest.mark.asyncio
    async def test_silence_detection_triggers_auto_stop(
        self,
        tmp_path: Path,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """Sustained silence below threshold triggers auto-stop."""
        mock_proc = make_mock_process()
        mock_create_subprocess.return_value = mock_proc

        settings = Settings(
            data_dir=tmp_path,
            silence_threshold=0.05,
            silence_duration_ms=50,
        )
        recorder = AudioRecorder(settings=settings)

        await recorder.start()
        # Level defaults to 0.0, which is below 0.05
        # Auto-stop should trigger after 50ms
        await asyncio.sleep(0.3)

        assert recorder.is_recording is False
        assert mock_proc._terminated is True

    @pytest.mark.asyncio
    async def test_no_auto_stop_when_above_threshold(
        self,
        tmp_path: Path,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """Level above threshold prevents auto-stop."""
        mock_proc = make_mock_process(
            stderr_lines=[
                "##+                                                | 71%",  # above threshold
            ]
        )
        mock_create_subprocess.return_value = mock_proc

        settings = Settings(
            data_dir=tmp_path,
            silence_threshold=0.5,
            silence_duration_ms=50,
        )
        recorder = AudioRecorder(settings=settings)

        await recorder.start()
        await asyncio.sleep(0.01)  # Let level task process VU data
        await asyncio.sleep(0.3)  # Wait, but auto-stop should NOT trigger

        assert recorder.is_recording is True

        # Cleanup
        await recorder.stop()

    @pytest.mark.asyncio
    async def test_silence_detection_disabled(
        self,
        tmp_path: Path,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """silence_duration_ms=0 disables silence detection."""
        mock_proc = make_mock_process()
        mock_create_subprocess.return_value = mock_proc

        settings = Settings(
            data_dir=tmp_path,
            silence_duration_ms=0,
        )
        recorder = AudioRecorder(settings=settings)

        await recorder.start()
        await asyncio.sleep(0.3)

        # Should still be recording since silence detection is disabled
        assert recorder.is_recording is True

        # Cleanup
        await recorder.stop()

    @pytest.mark.asyncio
    async def test_vad_disabled_stops_silence_detection(
        self,
        tmp_path: Path,
        mock_create_subprocess: AsyncMock,
        make_mock_process,
    ) -> None:
        """vad_enabled=False prevents silence detection from starting."""
        mock_proc = make_mock_process()
        mock_create_subprocess.return_value = mock_proc

        settings = Settings(
            data_dir=tmp_path,
            silence_duration_ms=2000,  # Would enable silence normally
        )
        recorder = AudioRecorder(settings=settings, vad_enabled=False)

        await recorder.start()
        await asyncio.sleep(0.3)

        # Should still be recording since VAD is disabled
        assert recorder.is_recording is True

        # Silence task should not have been started
        assert recorder._silence_task is None

        # Cleanup
        await recorder.stop()


class TestAudioRecorderConfig:
    """Tests for AudioRecorder configuration integration."""

    def test_default_settings(self) -> None:
        """Default audio settings match expected values."""
        settings = Settings()
        assert settings.audio_sample_rate == 16000
        assert settings.audio_channels == 1
        assert settings.audio_device is None
        assert settings.audio_format == "S16_LE"
        assert settings.silence_threshold == 0.005
        assert settings.silence_duration_ms == 2000

    def test_audio_settings_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Audio settings can be set via environment variables."""
        monkeypatch.setenv("ASR_LINUX_AUDIO_SAMPLE_RATE", "44100")
        monkeypatch.setenv("ASR_LINUX_AUDIO_CHANNELS", "2")
        monkeypatch.setenv("ASR_LINUX_AUDIO_DEVICE", "plughw:0,0")
        monkeypatch.setenv("ASR_LINUX_AUDIO_FORMAT", "S24_LE")
        monkeypatch.setenv("ASR_LINUX_SILENCE_THRESHOLD", "0.1")
        monkeypatch.setenv("ASR_LINUX_SILENCE_DURATION_MS", "500")

        settings = Settings()
        assert settings.audio_sample_rate == 44100
        assert settings.audio_channels == 2
        assert settings.audio_device == "plughw:0,0"
        assert settings.audio_format == "S24_LE"
        assert settings.silence_threshold == 0.1
        assert settings.silence_duration_ms == 500
