"""Model download and management for local Whisper ASR."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import NamedTuple

import httpx

from backend.logging_config import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MODELS_DIR_NAME = "models"
"""Subdirectory under data_dir where models are stored."""

# Model metadata: (huggingface_repo, filename, ggml_filename, description)
# Using ggerganov/whisper.cpp which hosts GGML-format Whisper models.
_MODEL_REGISTRY: dict[str, dict] = {
    "tiny": {
        "repo": "ggerganov/whisper.cpp",
        "file": "ggml-tiny.bin",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        "size_mb": 75,
        "description": "Tiny (~75 MB) -- fastest, lowest accuracy",
    },
    "base": {
        "repo": "ggerganov/whisper.cpp",
        "file": "ggml-base.bin",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        "size_mb": 150,
        "description": "Base (~150 MB) -- good balance of speed/accuracy",
    },
    "small": {
        "repo": "ggerganov/whisper.cpp",
        "file": "ggml-small.bin",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        "size_mb": 500,
        "description": "Small (~500 MB) -- recommended default",
    },
    "medium": {
        "repo": "ggerganov/whisper.cpp",
        "file": "ggml-medium.bin",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        "size_mb": 1500,
        "description": "Medium (~1.5 GB) -- high accuracy, slower",
    },
}


class ModelInfo(NamedTuple):
    """Information about a model."""

    name: str
    path: str | None
    size_mb: int
    downloaded: bool
    description: str


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def models_dir(data_dir: str | Path) -> Path:
    """Return the models directory, creating it if necessary."""
    path = Path(data_dir) / MODELS_DIR_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_available_models() -> list[str]:
    """Return the list of supported model sizes."""
    return list(_MODEL_REGISTRY.keys())


def get_model_info(name: str, data_dir: str | Path) -> ModelInfo | None:
    """Get info about a specific model.

    Args:
        name: Model size name (tiny/base/small/medium).
        data_dir: The app's data directory path.

    Returns:
        ModelInfo if the model is known, None otherwise.
    """
    entry = _MODEL_REGISTRY.get(name)
    if entry is None:
        return None

    model_path = models_dir(data_dir) / entry["file"]
    return ModelInfo(
        name=name,
        path=str(model_path) if model_path.exists() else None,
        size_mb=entry["size_mb"],
        downloaded=model_path.exists(),
        description=entry["description"],
    )


def list_downloaded_models(data_dir: str | Path) -> list[ModelInfo]:
    """List all models that have been downloaded."""
    result: list[ModelInfo] = []
    models_path = models_dir(data_dir)
    for name, entry in _MODEL_REGISTRY.items():
        model_path = models_path / entry["file"]
        result.append(
            ModelInfo(
                name=name,
                path=str(model_path) if model_path.exists() else None,
                size_mb=entry["size_mb"],
                downloaded=model_path.exists(),
                description=entry["description"],
            )
        )
    return result


async def download_model(
    name: str,
    data_dir: str | Path,
    progress_callback: Callable[[int, int], None] | None = None,
) -> Path:
    """Download a Whisper.cpp GGML model from HuggingFace.

    Args:
        name: Model size name (tiny/base/small/medium).
        data_dir: The app's data directory path.
        progress_callback: Optional ``callable(downloaded_bytes, total_bytes)``.

    Returns:
        Path to the downloaded model file.

    Raises:
        ValueError: If the model name is unknown.
        RuntimeError: If the download fails.
    """
    entry = _MODEL_REGISTRY.get(name)
    if entry is None:
        raise ValueError(f"Unknown model: {name}. Available: {list(_MODEL_REGISTRY.keys())}")

    dest_dir = models_dir(data_dir)
    dest_path = dest_dir / entry["file"]
    temp_path = dest_path.with_suffix(".tmp")

    url = entry["url"]

    try:
        async with (
            httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client,
            client.stream("GET", url) as response,
        ):
            if response.status_code != 200:
                raise RuntimeError(f"Failed to download {name}: HTTP {response.status_code}")

            total = int(response.headers.get("content-length", 0))

            # Write to temp file first
            downloaded = 0
            with open(temp_path, "wb") as f:
                async for chunk in response.aiter_bytes():
                    f.write(chunk)
                    downloaded += len(chunk)
                    if progress_callback and total > 0:
                        progress_callback(downloaded, total)

        # Rename temp to final
        temp_path.rename(dest_path)
        logger.info("model_downloaded", name=name, path=str(dest_path), size_mb=entry["size_mb"])
        return dest_path

    except Exception as exc:
        # Clean up temp file on failure
        if temp_path.exists():
            temp_path.unlink()
        logger.error("model_download_failed", name=name, error=str(exc))
        raise RuntimeError(f"Failed to download model '{name}': {exc}") from exc


def delete_model(name: str, data_dir: str | Path) -> bool:
    """Delete a downloaded model file.

    Args:
        name: Model size name.
        data_dir: The app's data directory path.

    Returns:
        True if the model was deleted, False if it didn't exist.
    """
    entry = _MODEL_REGISTRY.get(name)
    if entry is None:
        return False

    model_path = models_dir(data_dir) / entry["file"]
    if not model_path.exists():
        return False

    model_path.unlink()
    logger.info("model_deleted", name=name)
    return True


def recommended_model() -> str:
    """Return the recommended model size for most users."""
    return "small"


def get_model_path(name: str, data_dir: str | Path) -> str | None:
    """Get the filesystem path to a downloaded model.

    Returns:
        The path string, or None if the model is not downloaded.
    """
    entry = _MODEL_REGISTRY.get(name)
    if entry is None:
        return None
    model_path = models_dir(data_dir) / entry["file"]
    return str(model_path) if model_path.exists() else None
