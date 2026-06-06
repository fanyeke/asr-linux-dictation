"""SQLite database connection and migration baseline."""

from backend import sqlite_async
from backend.config import Settings

OPENAI_LLM_BASE_URL = "https://api.openai.com/v1"
OPENAI_LLM_MODEL = "gpt-4o-mini"
LEGACY_MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1"
LEGACY_MIMO_LLM_MODEL = "mimo-v2.5"


def get_db_path():
    """Return the path to the SQLite database file."""
    settings = Settings()
    return settings.data_dir / "asr-linux.db"


async def init_database() -> None:
    """Initialize the database with migration baseline."""
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    async with sqlite_async.connect(db_path) as db:
        # Create migrations tracking table
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS migrations (
                version INTEGER PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        # Insert baseline migration record
        await db.execute(
            "INSERT OR IGNORE INTO migrations (version) VALUES (?)",
            (0,),
        )

        # Phase 2: prompts table
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                template TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        # Phase 2: dictionary table
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS dictionary (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                canonical_term TEXT NOT NULL,
                pronunciation TEXT,
                aliases TEXT,
                notes TEXT,
                category TEXT,
                enforcement_level TEXT DEFAULT 'suggested',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        # Phase 2: history table
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL UNIQUE,
                raw_text TEXT,
                polished_text TEXT,
                status TEXT NOT NULL,
                timing_ms INTEGER,
                prompt_id INTEGER,
                error_type TEXT,
                failed_audio_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        # Phase 3: user_config table (persistent settings)
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS user_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                api_key TEXT,
                asr_api_key TEXT,
                asr_base_url TEXT DEFAULT 'https://token-plan-cn.xiaomimimo.com/v1',
                asr_model TEXT DEFAULT 'mimo-v2.5-asr',
                llm_api_key TEXT,
                llm_enabled INTEGER DEFAULT 1,
                llm_base_url TEXT DEFAULT 'https://api.openai.com/v1',
                llm_model TEXT DEFAULT 'gpt-4o-mini',
                hotkey TEXT DEFAULT 'Alt+=',
                ui_language TEXT DEFAULT 'zh',
                asr_language TEXT DEFAULT 'auto',
                vad_enabled INTEGER DEFAULT 1,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        # Ensure the single row exists
        await db.execute(
            "INSERT OR IGNORE INTO user_config (id) VALUES (1)"
        )

        # Migration 1: add hotkey column to existing user_config tables
        # (CREATE TABLE IF NOT EXISTS does not alter existing schemas)
        cursor = await db.execute("PRAGMA table_info(user_config)")
        columns = [row[1] for row in await cursor.fetchall()]
        if "hotkey" not in columns:
            await db.execute(
                "ALTER TABLE user_config ADD COLUMN hotkey TEXT DEFAULT 'Alt+='"
            )
        if "asr_api_key" not in columns:
            await db.execute("ALTER TABLE user_config ADD COLUMN asr_api_key TEXT")
            if "api_key" in columns:
                await db.execute(
                    "UPDATE user_config SET asr_api_key = api_key "
                    "WHERE asr_api_key IS NULL AND api_key IS NOT NULL"
                )
        if "llm_api_key" not in columns:
            await db.execute("ALTER TABLE user_config ADD COLUMN llm_api_key TEXT")
        if "llm_enabled" not in columns:
            await db.execute(
                "ALTER TABLE user_config ADD COLUMN llm_enabled INTEGER DEFAULT 1"
            )
        if "llm_base_url" not in columns:
            await db.execute(
                "ALTER TABLE user_config ADD COLUMN "
                "llm_base_url TEXT DEFAULT 'https://api.openai.com/v1'"
            )
        if "llm_model" not in columns:
            await db.execute(
                "ALTER TABLE user_config ADD COLUMN "
                "llm_model TEXT DEFAULT 'gpt-4o-mini'"
            )
        await db.execute(
            "UPDATE user_config SET llm_base_url = ? "
            "WHERE llm_base_url IS NULL",
            (OPENAI_LLM_BASE_URL,),
        )
        await db.execute(
            "UPDATE user_config SET llm_model = ? "
            "WHERE llm_model IS NULL",
            (OPENAI_LLM_MODEL,),
        )

        # Migration: add pronunciation column to existing dictionary tables
        cursor = await db.execute("PRAGMA table_info(dictionary)")
        dict_columns = [row[1] for row in await cursor.fetchall()]
        if "pronunciation" not in dict_columns:
            await db.execute(
                "ALTER TABLE dictionary ADD COLUMN pronunciation TEXT"
            )

        # Migration: add ui_language column to existing user_config tables
        cursor = await db.execute("PRAGMA table_info(user_config)")
        config_columns = [row[1] for row in await cursor.fetchall()]
        if "ui_language" not in config_columns:
            await db.execute(
                "ALTER TABLE user_config ADD COLUMN ui_language TEXT DEFAULT 'zh'"
            )

        # Migration: add asr_language column to existing user_config tables
        cursor = await db.execute("PRAGMA table_info(user_config)")
        config_columns = [row[1] for row in await cursor.fetchall()]
        if "asr_language" not in config_columns:
            await db.execute(
                "ALTER TABLE user_config ADD COLUMN asr_language TEXT DEFAULT 'auto'"
            )

        # Migration: add vad_enabled column to existing user_config tables
        cursor = await db.execute("PRAGMA table_info(user_config)")
        config_columns = [row[1] for row in await cursor.fetchall()]
        if "vad_enabled" not in config_columns:
            await db.execute(
                "ALTER TABLE user_config ADD COLUMN vad_enabled INTEGER DEFAULT 1"
            )

        await db.commit()
