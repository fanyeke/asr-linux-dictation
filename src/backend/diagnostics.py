"""Diagnostic bundle export — gather system info as a zip file."""

import json
import zipfile
from io import BytesIO
from pathlib import Path

from backend.config import Settings
from backend.config_store import load_user_config
from backend.history_store import list_sessions


async def build_diagnostics_bundle() -> BytesIO:
    """Build an in-memory zip with diagnostic data.

    Contents:
        - asr-linux.log (latest log file)
        - user_config.json (with API keys redacted)
        - history.json (last 20 history records)

    Returns:
        A ``BytesIO`` buffer containing the zip archive.
    """
    buf = BytesIO()
    settings = Settings()

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # --- Log file -------------------------------------------------------
        log_path = _find_latest_log(settings.data_dir)
        if log_path is not None:
            zf.write(log_path, arcname="asr-linux.log")

        # --- User config (redacted) -----------------------------------------
        config = await load_user_config()
        config_dict = config.to_dict()
        for key in ("api_key", "asr_api_key", "llm_api_key"):
            if config_dict.get(key):
                config_dict[key] = "***"
        zf.writestr(
            "user_config.json",
            json.dumps(config_dict, indent=2, ensure_ascii=False),
        )

        # --- History (last 20) ----------------------------------------------
        history = await list_sessions(limit=20, offset=0)
        zf.writestr(
            "history.json",
            json.dumps(history, indent=2, ensure_ascii=False, default=str),
        )

    buf.seek(0)
    return buf


def _find_latest_log(data_dir: Path) -> Path | None:
    """Return the path to the most recent log file, or ``None``.

    Looks for ``asr-linux.log`` in ``data_dir / logs``.
    """
    log_dir = data_dir / "logs"
    main_log = log_dir / "asr-linux.log"
    if main_log.exists():
        return main_log
    return None
