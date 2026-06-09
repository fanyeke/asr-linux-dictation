"""Audio recording module using arecord (ALSA) with pipe mode for streaming.

Provides the AudioRecorder class for capturing microphone audio
via arecord. Supports both file-based and pipe-based recording,
where pipe mode captures PCM data to an in-memory RingBuffer for
streaming ASR during recording.
"""

import asyncio
import contextlib
import logging
import uuid
from pathlib import Path

from backend.config import Settings
from backend.platform_interfaces import BaseAudioRecorder
from backend.ring_buffer import RingBuffer

logger = logging.getLogger(__name__)

MAX_RECORDING_SECONDS: int = 300  # 5 minutes

# WAV format constants
_WAV_BITS_PER_SAMPLE = 16


class AudioRecorder(BaseAudioRecorder):
    """Record microphone audio using arecord (ALSA) with pipe mode.

    Pipe mode launches arecord with stdout as the output target and
    captures PCM data into an in-memory :class:`RingBuffer` for
    streaming ASR. On stop, the accumulated PCM data is written to a
    standard WAV file at the configured output path.

    Attributes:
        settings: Application settings controlling audio parameters.
    """

    def __init__(self, settings: Settings | None = None, vad_enabled: bool = True) -> None:
        """Initialize the audio recorder.

        Args:
            settings: Optional settings override. Uses default Settings
                if not provided.
            vad_enabled: Whether VAD auto-stop is enabled.
        """
        self.settings: Settings = settings or Settings()
        self._vad_enabled = vad_enabled
        self._process: asyncio.subprocess.Process | None = None
        self._session_id: str | None = None
        self._output_path: Path | None = None
        self._level_task: asyncio.Task | None = None
        self._silence_task: asyncio.Task | None = None
        self._max_duration_task: asyncio.Task | None = None
        self._pipe_reader_task: asyncio.Task | None = None
        self._current_level: float = 0.0
        self._lock = asyncio.Lock()
        self._ring_buffer: RingBuffer | None = None

    async def start(self) -> str:
        """Start recording audio using pipe mode.

        Launches arecord with stdout as the target, captures PCM data
        to a :class:`RingBuffer` in memory for streaming ASR. On stop
        the accumulated PCM is written to a WAV file at the configured
        output path.

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

            cmd = self._build_pipe_command()
            self._ring_buffer = RingBuffer(sample_rate=self.settings.audio_sample_rate)

            try:
                self._process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
            except (FileNotFoundError, OSError):
                self._session_id = None
                self._output_path = None
                self._ring_buffer = None
                raise

            self._pipe_reader_task = asyncio.create_task(self._read_stdout())
            self._level_task = asyncio.create_task(self._monitor_levels())
            if self._vad_enabled and self.settings.silence_duration_ms > 0:
                self._silence_task = asyncio.create_task(self._detect_silence())
            self._max_duration_task = asyncio.create_task(self._enforce_max_duration())

            return self._session_id

    async def stop(self) -> Path | None:
        """Stop recording audio.

        Terminates the arecord process, cancels background tasks,
        and writes the accumulated PCM data to a WAV file at the
        configured output path.

        Returns:
            Path to the recorded WAV file, or ``None`` if not currently
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
            if self._pipe_reader_task is not None:
                self._pipe_reader_task.cancel()
                self._pipe_reader_task = None
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

            # Write accumulated PCM data to WAV file
            ring = self._ring_buffer
            if ring is not None and ring.total_bytes > 0:
                pcm_data = ring._read_bytes(0, ring.total_bytes)
                self._write_wav(output_path, pcm_data)
            elif output_path.exists():
                # Fallback: file may have been written by arecord directly
                pass
            else:
                # No data — create an empty recording
                self._write_wav(output_path, b"")

            self._process = None
            self._output_path = None
            self._ring_buffer = None

            return output_path

    @property
    def is_recording(self) -> bool:
        """Whether recording is currently active.

        Returns True while the arecord process is running and
        has not exited.
        """
        return self._process is not None and self._process.returncode is None

    @property
    def ring_buffer(self) -> RingBuffer | None:
        """Get the current ring buffer for streaming ASR access."""
        return self._ring_buffer

    async def get_level(self) -> float:
        """Get current audio level.

        Returns the most recently parsed VU meter level from arecord,
        converted to a linear scale between 0.0 (silence) and 1.0
        (maximum).

        Returns:
            Current audio level in the range [0.0, 1.0].
        """
        return self._current_level

    def _build_pipe_command(self) -> list[str]:
        """Build the arecord command line for pipe mode (stdout).

        Returns:
            List of command arguments for arecord.
        """
        cmd = [
            "arecord",
            "-t",
            "raw",  # raw PCM output (no WAV header in stream)
            "-f",
            self.settings.audio_format,
            "-r",
            str(self.settings.audio_sample_rate),
            "-c",
            str(self.settings.audio_channels),
            "--vumeter=stereo",
            "-",  # output to stdout
        ]
        if self.settings.audio_device:
            cmd.extend(["-D", self.settings.audio_device])
        return cmd

    # ------------------------------------------------------------------
    # Pipe reader — captures PCM from arecord stdout
    # ------------------------------------------------------------------

    async def _read_stdout(self) -> None:
        """Background task reading PCM data from arecord stdout.

        Continuously reads 8 KB chunks from arecord's stdout and
        writes them into the ring buffer.
        """
        process = self._process
        if process is None or process.stdout is None:
            return
        try:
            while True:
                chunk = await process.stdout.read(8192)
                if not chunk:
                    break
                if self._ring_buffer is not None:
                    self._ring_buffer.write(chunk)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Error reading audio pipe")

    # ------------------------------------------------------------------
    # WAV writer — saves PCM data as a proper WAV file
    # ------------------------------------------------------------------

    @staticmethod
    def _write_wav(path: Path, pcm_data: bytes) -> None:
        """Write PCM data as a RIFF/WAV file with a proper header.

        Args:
            path: Output file path.
            pcm_data: Raw PCM data bytes.
        """
        import struct

        sample_rate = 16000
        channels = 1
        bits_per_sample = 16
        byte_rate = sample_rate * channels * bits_per_sample // 8
        block_align = channels * bits_per_sample // 8
        data_size = len(pcm_data)

        with open(path, "wb") as f:
            f.write(b"RIFF")
            f.write(struct.pack("<I", 36 + data_size))
            f.write(b"WAVE")
            f.write(b"fmt ")
            f.write(struct.pack("<I", 16))  # chunk size
            f.write(struct.pack("<H", 1))  # PCM format
            f.write(struct.pack("<H", channels))
            f.write(struct.pack("<I", sample_rate))
            f.write(struct.pack("<I", byte_rate))
            f.write(struct.pack("<H", block_align))
            f.write(struct.pack("<H", bits_per_sample))
            f.write(b"data")
            f.write(struct.pack("<I", data_size))
            f.write(pcm_data)

    # ------------------------------------------------------------------
    # Level parsing (unchanged from file mode)
    # ------------------------------------------------------------------

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
                        elapsed = (asyncio.get_event_loop().time() - silence_start) * 1000
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
