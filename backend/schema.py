import logging
from db import get_conn

logger = logging.getLogger("resume_tailor.schema")

_TABLES = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id          BIGSERIAL PRIMARY KEY,
        email       TEXT UNIQUE,
        name        TEXT,
        avatar_url  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS oauth_accounts (
        id                BIGSERIAL PRIMARY KEY,
        user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider          TEXT NOT NULL,
        provider_user_id  TEXT NOT NULL,
        email             TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (provider, provider_user_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS sessions (
        id           BIGSERIAL PRIMARY KEY,
        user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash   TEXT NOT NULL UNIQUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at   TIMESTAMPTZ NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_agent   TEXT,
        ip_hash      TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS oauth_states (
        id             BIGSERIAL PRIMARY KEY,
        state_hash     TEXT NOT NULL UNIQUE,
        provider       TEXT NOT NULL,
        redirect_after TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at     TIMESTAMPTZ NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS usage_events (
        id            BIGSERIAL PRIMARY KEY,
        user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type    TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata_json JSONB
    )
    """,
]


async def init_schema() -> None:
    try:
        async with get_conn() as conn:
            for sql in _TABLES:
                await conn.execute(sql)
            await conn.commit()
        logger.info("Schema ready")
    except RuntimeError:
        pass  # DB not available (no DATABASE_URL)
    except Exception as e:
        logger.error("Schema init failed: %s", e)
        raise
