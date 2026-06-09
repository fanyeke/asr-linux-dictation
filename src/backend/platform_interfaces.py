"""Abstract base classes for platform-specific components.

Defines the contracts that each platform (Linux, macOS, Windows) must
implement for audio recording, text injection, and secret storage.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseAudioRecorder(ABC):
    """Abstract microphone audio recorder.

    Each platform implementation uses the OS-native audio API
    (ALSA/PulseAudio on Linux, CoreAudio on macOS, WASAPI on Windows).
    """

    @abstractmethod
    async def start(self) -> str:
        """Start recording audio.

        Returns:
            A unique session id for this recording.
        """

    @abstractmethod
    async def stop(self) -> str | None:
        """Stop recording and return the path to the audio file.

        Returns:
            The path to the WAV file, or ``None`` if no recording
            was in progress.
        """

    @abstractmethod
    async def get_level(self) -> float:
        """Get the current microphone audio level (0.0 – 1.0)."""

    @property
    @abstractmethod
    def is_recording(self) -> bool:
        """Whether recording is currently active."""


class BaseTextInjector(ABC):
    """Abstract text injector for desktop text insertion."""

    @abstractmethod
    async def inject(self, text: str) -> Any:
        """Insert *text* into the currently focused window.

        Args:
            text: The text to insert.

        Returns:
            A platform-specific result object indicating success/failure.
        """


class BaseSecretStore(ABC):
    """Abstract secret/key storage backend.

    Each platform uses its native credential store
    (Secret Service on Linux, Keychain on macOS, Credential Manager on Windows).
    """

    @abstractmethod
    async def load_secret(self, name: str) -> str | None:
        """Load a stored secret.

        Args:
            name: The secret identifier.

        Returns:
            The secret value, or ``None`` if not found.
        """

    @abstractmethod
    async def save_secret(self, name: str, value: str | None) -> bool:
        """Save (or clear) a secret.

        Returns:
            ``True`` if the operation succeeded.
        """

    @abstractmethod
    def is_available(self) -> bool:
        """Whether this secret store backend is usable on the current system."""
