import os
import hashlib
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
import httpx
import db

logger = logging.getLogger("resume_tailor.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_NAME = "hr_session"
SESSION_DAYS = 30
STATE_MINUTES = 10

PROVIDERS = {
    "google": {
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "profile_url": "https://www.googleapis.com/oauth2/v2/userinfo",
        "scope": "openid email profile",
    },
    "yandex": {
        "auth_url": "https://oauth.yandex.ru/authorize",
        "token_url": "https://oauth.yandex.ru/token",
        "profile_url": "https://login.yandex.ru/info",
        "scope": "login:email login:info login:avatar",
    },
}


def _session_secret() -> str:
    return os.getenv("SESSION_SECRET", "dev-insecure-change-me-in-production")

def _app_base_url() -> str:
    return os.getenv("APP_BASE_URL", "http://localhost:47821").rstrip("/")

def _client_id(provider: str) -> str:
    return os.getenv(f"{provider.upper()}_CLIENT_ID", "")

def _client_secret(provider: str) -> str:
    return os.getenv(f"{provider.upper()}_CLIENT_SECRET", "")

def _is_dev() -> bool:
    return os.getenv("DEV_MODE") == "1"

def _hash_token(token: str) -> str:
    return hashlib.sha256(f"{token}:{_session_secret()}".encode()).hexdigest()

def _hash_state(state: str) -> str:
    return hashlib.sha256(state.encode()).hexdigest()

def _hash_ip(ip: str) -> str:
    return hashlib.sha256(ip.encode()).hexdigest()[:16]

def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_DAYS * 86400,
        httponly=True,
        secure=not _is_dev(),
        samesite="lax",
        path="/",
    )

def _del_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


async def cleanup_expired() -> None:
    try:
        async with db.get_conn() as conn:
            await conn.execute("DELETE FROM oauth_states WHERE expires_at < NOW()")
            await conn.commit()
    except Exception:
        pass


# ── OAuth start ────────────────────────────────────────────────────

@router.get("/{provider}/start")
async def oauth_start(provider: str, request: Request):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")
    cid = _client_id(provider)
    if not cid:
        raise HTTPException(status_code=503, detail=f"{provider} OAuth not configured")

    raw_state = secrets.token_urlsafe(32)
    state_hash = _hash_state(raw_state)
    redirect_after = request.query_params.get("next", "/app")
    expires = datetime.now(timezone.utc) + timedelta(minutes=STATE_MINUTES)

    try:
        async with db.get_conn() as conn:
            await conn.execute(
                "INSERT INTO oauth_states (state_hash, provider, redirect_after, expires_at) VALUES (%s, %s, %s, %s)",
                (state_hash, provider, redirect_after, expires),
            )
            await conn.commit()
    except RuntimeError:
        raise HTTPException(status_code=503, detail="Database unavailable")

    cfg = PROVIDERS[provider]
    callback = f"{_app_base_url()}/api/auth/{provider}/callback"
    params = {
        "client_id": cid,
        "redirect_uri": callback,
        "response_type": "code",
        "scope": cfg["scope"],
        "state": raw_state,
    }
    if provider == "google":
        params["access_type"] = "online"

    return RedirectResponse(f"{cfg['auth_url']}?{urlencode(params)}", status_code=302)


# ── OAuth callback ─────────────────────────────────────────────────

@router.get("/{provider}/callback")
async def oauth_callback(provider: str, request: Request):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")

    code = request.query_params.get("code")
    raw_state = request.query_params.get("state")
    error = request.query_params.get("error")

    if error:
        return RedirectResponse("/app?auth_error=cancelled", status_code=302)
    if not code or not raw_state:
        return RedirectResponse("/app?auth_error=invalid", status_code=302)

    # Validate and consume state (single-use)
    state_hash = _hash_state(raw_state)
    try:
        async with db.get_conn() as conn:
            cur = await conn.execute(
                "DELETE FROM oauth_states WHERE state_hash = %s AND provider = %s AND expires_at > NOW() RETURNING redirect_after",
                (state_hash, provider),
            )
            state_row = await cur.fetchone()
            await conn.commit()
    except RuntimeError:
        return RedirectResponse("/app?auth_error=db", status_code=302)

    if not state_row:
        return RedirectResponse("/app?auth_error=state", status_code=302)

    redirect_after = state_row["redirect_after"] or "/app"

    # Exchange code for access token
    cfg = PROVIDERS[provider]
    callback = f"{_app_base_url()}/api/auth/{provider}/callback"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(
                cfg["token_url"],
                data={
                    "code": code,
                    "client_id": _client_id(provider),
                    "client_secret": _client_secret(provider),
                    "redirect_uri": callback,
                    "grant_type": "authorization_code",
                },
            )
            token_resp.raise_for_status()
            access_token = token_resp.json().get("access_token")
            if not access_token:
                return RedirectResponse("/app?auth_error=token", status_code=302)

            profile_resp = await client.get(
                cfg["profile_url"],
                headers={"Authorization": f"Bearer {access_token}"},
            )
            profile_resp.raise_for_status()
            profile = profile_resp.json()
    except Exception as exc:
        logger.error("OAuth fetch failed (%s): %s", provider, type(exc).__name__)
        return RedirectResponse("/app?auth_error=provider", status_code=302)

    # Parse provider-specific profile fields
    if provider == "google":
        puid = profile.get("id", "")
        email = profile.get("email", "")
        name = profile.get("name", "")
        avatar_url = profile.get("picture", "")
    else:  # yandex
        puid = str(profile.get("id", ""))
        email = profile.get("default_email", "")
        name = profile.get("display_name") or profile.get("real_name", "")
        aid = profile.get("default_avatar_id", "")
        avatar_url = (
            f"https://avatars.yandex.net/get-yapic/{aid}/islands-200" if aid else ""
        )

    # Upsert user and create session
    try:
        user_id = await _upsert_user(provider, puid, email, name, avatar_url)
        session_token = secrets.token_urlsafe(32)
        token_hash = _hash_token(session_token)
        expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
        ip = request.client.host if request.client else ""
        ua = request.headers.get("user-agent", "")[:256]

        async with db.get_conn() as conn:
            await conn.execute(
                "INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_hash) VALUES (%s, %s, %s, %s, %s)",
                (user_id, token_hash, expires, ua, _hash_ip(ip)),
            )
            await conn.commit()
    except Exception as exc:
        logger.error("Session create failed: %s", type(exc).__name__)
        return RedirectResponse("/app?auth_error=session", status_code=302)

    resp = RedirectResponse(redirect_after, status_code=302)
    _set_cookie(resp, session_token)
    return resp


# ── User upsert ────────────────────────────────────────────────────

async def _upsert_user(provider: str, puid: str, email: str, name: str, avatar_url: str) -> int:
    async with db.get_conn() as conn:
        # Check existing OAuth link
        cur = await conn.execute(
            "SELECT user_id FROM oauth_accounts WHERE provider = %s AND provider_user_id = %s",
            (provider, puid),
        )
        row = await cur.fetchone()
        if row:
            user_id = row["user_id"]
            await conn.execute(
                "UPDATE oauth_accounts SET email = %s, updated_at = NOW() WHERE provider = %s AND provider_user_id = %s",
                (email, provider, puid),
            )
            await conn.execute(
                "UPDATE users SET name = %s, avatar_url = %s, updated_at = NOW() WHERE id = %s",
                (name, avatar_url, user_id),
            )
            await conn.commit()
            return user_id

        # Try to find existing user by email
        user_id = None
        if email:
            cur = await conn.execute("SELECT id FROM users WHERE email = %s", (email,))
            user_row = await cur.fetchone()
            if user_row:
                user_id = user_row["id"]

        # Create user if not found
        if user_id is None:
            cur = await conn.execute(
                "INSERT INTO users (email, name, avatar_url) VALUES (%s, %s, %s) RETURNING id",
                (email or None, name, avatar_url),
            )
            new_row = await cur.fetchone()
            user_id = new_row["id"]

        await conn.execute(
            "INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email) VALUES (%s, %s, %s, %s) ON CONFLICT (provider, provider_user_id) DO NOTHING",
            (user_id, provider, puid, email),
        )
        await conn.commit()
        return user_id


# ── Session helpers ────────────────────────────────────────────────

async def get_current_user(request: Request) -> Optional[dict]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    token_hash = _hash_token(token)
    try:
        async with db.get_conn() as conn:
            cur = await conn.execute(
                """
                SELECT u.id, u.name, u.email, u.avatar_url
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token_hash = %s AND s.expires_at > NOW()
                """,
                (token_hash,),
            )
            row = await cur.fetchone()
            if not row:
                return None
            await conn.execute(
                "UPDATE sessions SET last_seen_at = NOW() WHERE token_hash = %s",
                (token_hash,),
            )
            await conn.commit()
        return dict(row)
    except RuntimeError:
        return None
    except Exception as exc:
        logger.error("Session lookup error: %s", type(exc).__name__)
        return None


# ── Auth endpoints ─────────────────────────────────────────────────

@router.get("/me")
async def me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        try:
            async with db.get_conn() as conn:
                await conn.execute(
                    "DELETE FROM sessions WHERE token_hash = %s", (_hash_token(token),)
                )
                await conn.commit()
        except Exception:
            pass
    _del_cookie(response)
    return {"status": "logged_out"}
