import os
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger("resume_tailor.db")

_pool = None


async def init_pool() -> None:
    global _pool
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        logger.warning("DATABASE_URL not set — database features disabled")
        return
    try:
        from psycopg_pool import AsyncConnectionPool
        from psycopg.rows import dict_row
        _pool = AsyncConnectionPool(
            conninfo=database_url,
            min_size=1,
            max_size=10,
            open=False,
            kwargs={"row_factory": dict_row},
        )
        await _pool.open()
        logger.info("Database pool ready")
    except Exception as e:
        logger.error("Failed to initialise DB pool: %s", e)
        _pool = None


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_conn():
    if _pool is None:
        raise RuntimeError("Database not available")
    async with _pool.connection() as conn:
        yield conn


async def check_db() -> bool:
    if _pool is None:
        return False
    try:
        async with _pool.connection() as conn:
            await conn.execute("SELECT 1")
        return True
    except Exception:
        return False
