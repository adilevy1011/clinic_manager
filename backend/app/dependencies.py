"""Authentication dependencies shared by protected routers."""

from typing import Any

import httpx
from fastapi import Cookie, Depends, HTTPException, status

from .config import settings
from .db import SupabaseDatabase, require_database


def current_user(
    clinic_access_token: str | None = Cookie(default=None),
) -> tuple[SupabaseDatabase, dict[str, Any]]:
    if not clinic_access_token:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "A session is required.",
        )

    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(503, "Supabase is not configured.")

    response = httpx.get(
        f"{settings.supabase_url}/auth/v1/user",
        headers={
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {clinic_access_token}",
        },
        timeout=8,
    )
    if response.status_code != 200:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Your session has expired. Please sign in again.",
        )

    return require_database(clinic_access_token), response.json()
