"""Tests for the model download and management module.

All HTTP download tests mock the requests using respx -- no real network calls.
"""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest
import respx

from backend.model_manager import (
    ModelInfo,
    delete_model,
    download_model,
    get_model_info,
    get_model_path,
    list_available_models,
    list_downloaded_models,
    models_dir,
    recommended_model,
)

# =====================================================================
# models_dir
# =====================================================================


class TestModelsDir:
    """Tests for models_dir()."""

    def test_creates_models_subdirectory(self, tmp_path: Path) -> None:
        """Creates the models/ subdirectory under data_dir."""
        models_path = models_dir(tmp_path)
        assert models_path.exists()
        assert models_path.is_dir()
        assert models_path.name == "models"

    def test_parent_is_data_dir(self, tmp_path: Path) -> None:
        """The models directory is a child of data_dir."""
        models_path = models_dir(tmp_path)
        assert models_path.parent == tmp_path

    def test_idempotent(self, tmp_path: Path) -> None:
        """Multiple calls do not raise."""
        models_dir(tmp_path)
        models_dir(tmp_path)  # should not raise

    def test_accepts_string_path(self, tmp_path: Path) -> None:
        """Accepts a str instead of Path."""
        models_path = models_dir(str(tmp_path))
        assert models_path.exists()


# =====================================================================
# list_available_models
# =====================================================================


class TestListAvailableModels:
    """Tests for list_available_models()."""

    def test_returns_all_supported_sizes(self) -> None:
        """Returns the expected list of model sizes."""
        models = list_available_models()
        assert sorted(models) == sorted(["tiny", "base", "small", "medium"])

    def test_returns_new_list_each_call(self) -> None:
        """Each call returns a fresh list."""
        m1 = list_available_models()
        m2 = list_available_models()
        assert m1 is not m2


# =====================================================================
# get_model_info
# =====================================================================


class TestGetModelInfo:
    """Tests for get_model_info()."""

    def test_returns_info_for_known_model(self, tmp_path: Path) -> None:
        """Returns ModelInfo for a known model size."""
        info = get_model_info("small", tmp_path)
        assert info is not None
        assert info.name == "small"
        assert info.downloaded is False
        assert info.path is None
        assert info.size_mb == 500
        assert isinstance(info.description, str)

    def test_returns_none_for_unknown_model(self, tmp_path: Path) -> None:
        """Returns None when the model name is not in the registry."""
        info = get_model_info("nonexistent", tmp_path)
        assert info is None

    def test_detects_downloaded_file(self, tmp_path: Path) -> None:
        """Sets downloaded=True and path when the file exists on disk."""
        models_path = models_dir(tmp_path)
        model_file = models_path / "ggml-small.bin"
        model_file.write_text("fake model data")

        info = get_model_info("small", tmp_path)
        assert info is not None
        assert info.downloaded is True
        assert info.path is not None
        assert Path(info.path).exists()

    def test_all_known_models_return_info(self, tmp_path: Path) -> None:
        """Every entry in the registry returns a ModelInfo."""
        for name in list_available_models():
            info = get_model_info(name, tmp_path)
            assert info is not None
            assert info.name == name


# =====================================================================
# list_downloaded_models
# =====================================================================


class TestListDownloadedModels:
    """Tests for list_downloaded_models()."""

    def test_returns_entry_for_every_model(self, tmp_path: Path) -> None:
        """Returns ModelInfo for all registered models."""
        models = list_downloaded_models(tmp_path)
        assert len(models) == 4

    def test_all_returned_are_model_info(self, tmp_path: Path) -> None:
        """Each element is a ModelInfo instance."""
        for m in list_downloaded_models(tmp_path):
            assert isinstance(m, ModelInfo)

    def test_detects_downloaded_files(self, tmp_path: Path) -> None:
        """Marks the correct model as downloaded."""
        models_dir(tmp_path)
        (models_dir(tmp_path) / "ggml-small.bin").write_text("data")
        (models_dir(tmp_path) / "ggml-tiny.bin").write_text("data")

        models = {m.name: m for m in list_downloaded_models(tmp_path)}
        assert models["small"].downloaded is True
        assert models["tiny"].downloaded is True
        assert models["base"].downloaded is False
        assert models["medium"].downloaded is False

    def test_missing_models_have_none_path(self, tmp_path: Path) -> None:
        """Undownloaded models report path=None."""
        for m in list_downloaded_models(tmp_path):
            if not m.downloaded:
                assert m.path is None


# =====================================================================
# download_model
# =====================================================================


class TestDownloadModel:
    """Tests for download_model()."""

    @pytest.mark.asyncio
    async def test_downloads_and_saves_to_disk(self, tmp_path: Path) -> None:
        """Downloads a model file and stores it at the expected path."""
        model_data = b"fake ggml model binary data"

        async with respx.mock:
            respx.get(
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
            ).respond(200, content=model_data, headers={"content-length": str(len(model_data))})

            result = await download_model("small", tmp_path)

        assert result.exists()
        assert result.name == "ggml-small.bin"
        assert result.read_bytes() == model_data

    @pytest.mark.asyncio
    async def test_reports_progress(self, tmp_path: Path) -> None:
        """Calls progress_callback with (downloaded, total) bytes."""
        model_data = b"x" * 1000
        progress_calls: list[tuple[int, int]] = []

        def progress(downloaded: int, total: int) -> None:
            progress_calls.append((downloaded, total))

        async with respx.mock:
            respx.get(
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
            ).respond(200, content=model_data, headers={"content-length": str(len(model_data))})

            await download_model("tiny", tmp_path, progress_callback=progress)

        assert len(progress_calls) > 0
        final_downloaded, final_total = progress_calls[-1]
        assert final_downloaded == 1000
        assert final_total == 1000

    @pytest.mark.asyncio
    async def test_raises_value_error_for_unknown_model(self, tmp_path: Path) -> None:
        """Raises ValueError when the model name is not in the registry."""
        with pytest.raises(ValueError, match="Unknown model"):
            await download_model("nonexistent", tmp_path)

    @pytest.mark.asyncio
    async def test_raises_runtime_error_on_http_404(self, tmp_path: Path) -> None:
        """Raises RuntimeError when the server returns a non-200 status."""
        async with respx.mock:
            respx.get(
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
            ).respond(404)

            with pytest.raises(RuntimeError, match="Failed to download"):
                await download_model("small", tmp_path)

    @pytest.mark.asyncio
    async def test_raises_runtime_error_on_http_500(self, tmp_path: Path) -> None:
        """Raises RuntimeError on server error."""
        async with respx.mock:
            respx.get(
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
            ).respond(500)

            with pytest.raises(RuntimeError, match="Failed to download"):
                await download_model("small", tmp_path)

    @pytest.mark.asyncio
    async def test_raises_runtime_error_on_network_failure(self, tmp_path: Path) -> None:
        """Raises RuntimeError when a network error occurs."""
        async with respx.mock:
            respx.get(
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
            ).mock(side_effect=httpx.ConnectError("Connection refused"))

            with pytest.raises(RuntimeError, match="Failed to download"):
                await download_model("small", tmp_path)

    @pytest.mark.asyncio
    async def test_cleans_up_temp_file_on_failure(self, tmp_path: Path) -> None:
        """Removes the .tmp file after a failed download."""
        models_path = models_dir(tmp_path)
        temp_file = models_path / "ggml-small.bin.tmp"

        async with respx.mock:
            respx.get(
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
            ).mock(side_effect=httpx.ConnectError("Connection refused"))

            with pytest.raises(RuntimeError):
                await download_model("small", tmp_path)

        assert not temp_file.exists()

    @pytest.mark.asyncio
    async def test_temp_file_renamed_on_success(self, tmp_path: Path) -> None:
        """Temp file is renamed to the final filename after a successful download."""
        models_path = models_dir(tmp_path)
        temp_file = models_path / "ggml-small.bin.tmp"

        async with respx.mock:
            respx.get(
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
            ).respond(200, content=b"some model data", headers={"content-length": "15"})

            await download_model("small", tmp_path)

        assert not temp_file.exists()
        assert (models_path / "ggml-small.bin").exists()


# =====================================================================
# delete_model
# =====================================================================


class TestDeleteModel:
    """Tests for delete_model()."""

    def test_deletes_existing_file(self, tmp_path: Path) -> None:
        """Deletes the model file and returns True."""
        models_dir(tmp_path)
        model_file = models_dir(tmp_path) / "ggml-small.bin"
        model_file.write_text("some model data")

        result = delete_model("small", tmp_path)
        assert result is True
        assert not model_file.exists()

    def test_returns_false_if_not_downloaded(self, tmp_path: Path) -> None:
        """Returns False when the model file does not exist."""
        result = delete_model("small", tmp_path)
        assert result is False

    def test_returns_false_for_unknown_model(self, tmp_path: Path) -> None:
        """Returns False when the model name is not in the registry."""
        result = delete_model("nonexistent", tmp_path)
        assert result is False


# =====================================================================
# recommended_model
# =====================================================================


class TestRecommendedModel:
    """Tests for recommended_model()."""

    def test_recommends_small(self) -> None:
        """Returns 'small' as the default recommendation."""
        assert recommended_model() == "small"


# =====================================================================
# get_model_path
# =====================================================================


class TestGetModelPath:
    """Tests for get_model_path()."""

    def test_returns_none_if_not_downloaded(self, tmp_path: Path) -> None:
        """Returns None when the model has not been downloaded."""
        assert get_model_path("small", tmp_path) is None

    def test_returns_path_string_if_downloaded(self, tmp_path: Path) -> None:
        """Returns the filesystem path as a string when the model exists."""
        models_dir(tmp_path)
        model_file = models_dir(tmp_path) / "ggml-small.bin"
        model_file.write_text("data")

        path = get_model_path("small", tmp_path)
        assert path is not None
        assert isinstance(path, str)
        assert Path(path).exists()

    def test_returns_none_for_unknown_model(self, tmp_path: Path) -> None:
        """Returns None when the model name is not in the registry."""
        assert get_model_path("nonexistent", tmp_path) is None
