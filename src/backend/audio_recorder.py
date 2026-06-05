"""Audio recording module using arecord (ALSA).

Provides the AudioRecorder class for capturing microphone audio
via the arecord command-line tool on Linux.
"""

import asyncio
import contextlib
import logging
import uuid
from pathlib import Path

from backend.config import Settings

logger = logging.getLogger(__name__)

MAX_RECORDING_SECONDS: int = 300  # 5 minutes


class AudioRecorder:
    """Record microphone audio using arecord (ALSA).

    Attributes:
        settings: Application settings controlling audio parameters.

    Usage:
        recorder = AudioRecorder()
        session_id = await recorder.start()
        # ... record audio ...
        output_path = await recorder.stop()
    """

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize the audio recorder.

        Args:
            settings: Optional settings override. Uses default Settings
                if not provided.
        """
        self.settings: Settings = settings or Settings()
        self._process: asyncio.subprocess.Process | None = None
        self._session_id: str | None = None
        self._output_path: Path | None = None
        self._level_task: asyncio.Task | None = None
        self._silence_task: asyncio.Task | None = None
        self._max_duration_task: asyncio.Task | None = None
        self._current_level: float = 0.0
        self._lock = asyncio.Lock()

    async def start(self) -> str:
        """Start recording audio.

        Launches an arecord subprocess to capture microphone audio
        to a WAV file. The output is written to a recordings subdirectory
        under the configured data directory.

        Returns:
            A unique session ID string for this recording session.
            If already recording, returns the existing session ID (idempotent).

        Raises:
            OSError: If arecord is not found or fails to start.
        """
        async with self._lock:
            if self.is_recording:
                return self._session_id  # type: ignore[return-value]

            self._session_id = uuid.uuid4().hex
            recordings_dir = self.settings.data_dir / "recordings"
            recordings_dir.mkdir(parents=True, exist_ok=True)
            self._output_path = recordings_dir / f"{self._session_id}.wav"

            cmd = self._build_command()

            try:
                self._process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.PIPE,
                )
            except (FileNotFoundError, OSError):
                self._session_id = None
                self._output_path = None
                raise

            self._level_task = asyncio.create_task(self._monitor_levels())
            if self.settings.silence_duration_ms > 0:
                self._silence_task = asyncio.create_task(self._detect_silence())
            self._max_duration_task = asyncio.create_task(
                self._enforce_max_duration()
            )

            return self._session_id

    async def stop(self) -> Path | None:
        """Stop recording audio.

        Terminates the arecord process and returns the path to
        the recorded WAV file.

        Returns:
            Path to the recorded audio file, or ``None`` if not currently
            recording (idempotent).
        """
        async with self._lock:
            if not self.is_recording:
                return None

            # Type narrowing: is_recording guarantees _process is not None.
            process: asyncio.subprocess.Process = self._process  # type: ignore[assignment]
            output_path: Path = self._output_path  # type: ignore[arg-type]

            # Cancel background monitoring tasks.
            if self._level_task is not None:
                self._level_task.cancel()
                self._level_task = None
            if self._silence_task is not None:
                self._silence_task.cancel()
                self._silence_task = None
            if self._max_duration_task is not None:
                self._max_duration_task.cancel()
                self._max_duration_task = None

            # Terminate the arecord process.
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5.0)
            except TimeoutError:
                process.kill()
                await process.wait()

            self._process = None
            self._output_path = None

            return output_path

    @property
    def is_recording(self) -> bool:
        """Whether recording is currently active.

        Returns True while the arecord process is running and
        has not exited.
        """
        return self._process is not None and self._process.returncode is None

    async def get_level(self) -> float:
        """Get current audio level.

        Returns the most recently parsed VU meter level from arecord,
        converted to a linear scale between 0.0 (silence) and 1.0
        (maximum).

        Returns:
            Current audio level in the range [0.0, 1.0].
        """
        return self._current_level

    def _build_command(self) -> list[str]:
        """Build the arecord command line.

        Returns:
            List of command arguments for arecord.
        """
        cmd = [
            "arecord",
            "-f",
            self.settings.audio_format,
            "-r",
            str(self.settings.audio_sample_rate),
            "-c",
            str(self.settings.audio_channels),
            "--vumeter=stereo",
        ]
        if self.settings.audio_device:
            cmd.extend(["-D", self.settings.audio_device])
        cmd.append(str(self._output_path))
        return cmd

    def _parse_level_line(self, decoded: str) -> None:
        """Parse a single line of arecord VU meter output."""
        # arecord --vumeter=stereo output: "#+ | 01%"
        if "|" in decoded and "%" in decoded:
            try:
                percent_part = decoded.split("|")[1].strip()
                percent_str = percent_part.replace("%", "").strip()
                percent = float(percent_str)
                self._current_level = min(1.0, percent / 100.0)
            except (ValueError, IndexError):
                pass
        # Fallback: some arecord versions output "MAXVU: -12.34"
        elif "MAXVU:" in decoded:
            try:
                parts = decoded.split("MAXVU:")[1].strip()
                db_str = parts.split()[0]
                db_value = float(db_str)
                self._current_level = min(1.0, 10 ** (db_value / 20.0))
            except (ValueError, IndexError):
                pass

    async def _monitor_levels(self) -> None:
        """Background task that parses arecord VU meter output.

        Reads stderr from arecord.  arecord uses ``\r`` to overwrite the
        same line, so we read byte-by-byte and split on ``\r`` or ``\n``.

        arecord --vumeter=stereo outputs lines like::

            #+                                                 | 01%
        """
        process = self._process
        if process is None or process.stderr is None:
            return

        try:
            buf = b""
            while True:
                chunk = await process.stderr.read(1)
                if not chunk:
                    break
                if chunk in (b"\r", b"\n"):
                    if buf:
                        decoded = buf.decode("utf-8", errors="replace").strip()
                        self._parse_level_line(decoded)
                        buf = b""
                else:
                    buf += chunk
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Error monitoring audio levels")

    async def _detect_silence(self) -> None:
        """Background task that auto-stops after sustained silence.

        Monitors the current audio level and triggers an automatic
        stop if the level stays below ``silence_threshold`` for longer
        than ``silence_duration_ms``.
        """
        silence_start: float | None = None
        try:
            while self.is_recording:
                await asyncio.sleep(0.1)
                if not self.is_recording:
                    break
                if self._current_level < self.settings.silence_threshold:
                    if silence_start is None:
                        silence_start = asyncio.get_event_loop().time()
                    else:
                        elapsed = (
                            asyncio.get_event_loop().time() - silence_start
                        ) * 1000
                        if elapsed >= self.settings.silence_duration_ms:
                            with contextlib.suppress(RuntimeError):
                                await self.stop()
                            return
                else:
                    silence_start = None
        except asyncio.CancelledError:
            pass

    async def _enforce_max_duration(self) -> None:
        """Background task that auto-stops after max recording duration.

        Waits for MAX_RECORDING_SECONDS and then triggers stop().
        """
        try:
            await asyncio.sleep(MAX_RECORDING_SECONDS)
            if self.is_recording:
                logger.info(
                    "Recording stopped: reached max duration (%s seconds)",
                    MAX_RECORDING_SECONDS,
                )
                with contextlib.suppress(RuntimeError):
                    await self.stop()
        except asyncio.CancelledError:
            pass
