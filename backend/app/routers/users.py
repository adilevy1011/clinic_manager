"""Therapist profile endpoints."""

from typing import Any

from fastapi import APIRouter, Depends

from ..dependencies import current_user
from ..schemas import ProfileUpdate

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/me")
def me(context=Depends(current_user)) -> dict[str, Any]:
    db, user = context
    profiles = db.table("profiles").select("*").eq("id", user["id"]).execute().data or []
    profile = profiles[0] if profiles else db.table("profiles").insert({"id": user["id"], "email": user.get("email", "")}).execute().data[0]
    return {"user": user, "profile": profile}


@router.patch("/me")
def update_me(payload: ProfileUpdate, context=Depends(current_user)) -> dict[str, Any]:
    db, user = context
    profile = db.table("profiles").upsert({"id": user["id"], "email": payload.email}).execute().data[0]
    return {"user": user, "profile": profile}
