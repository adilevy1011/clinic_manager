"""Login and logout endpoints."""

from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Response, status

from ..config import settings
from ..schemas import LoginRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest, response: Response) -> dict[str, Any]:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(503, "Supabase is not configured.")

    result = httpx.post(
        f"{settings.supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": settings.supabase_anon_key, "Content-Type": "application/json"},
        json=payload.model_dump(),
        timeout=8,
    )
    if result.status_code >= 400:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")

    session = result.json()
    response.set_cookie(
        "clinic_access_token",
        session["access_token"],
        httponly=True,
        secure=settings.frontend_url.startswith("https://"),
        samesite="lax",
        max_age=int(session.get("expires_in", 3600)),
        path="/",
    )
    return {"user": session.get("user")}


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie("clinic_access_token", path="/")
