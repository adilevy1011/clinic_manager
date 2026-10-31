"""Therapist profile endpoints."""

from typing import Any

from fastapi import APIRouter, Depends

from ..dependencies import current_user

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/me")
def me(context=Depends(current_user)) -> dict[str, Any]:
    db, user = context
    db.table("profiles").upsert({"id": user["id"], "email": user.get("email", "")}).execute()
    profile = db.table("profiles").select("*").eq("id", user["id"]).single().execute().data
    return {"user": user, "profile": profile}
