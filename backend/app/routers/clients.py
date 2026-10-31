"""Client management endpoints."""

from typing import Any

from fastapi import APIRouter, Depends

from ..dependencies import current_user
from ..schemas import ClientCreate

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("")
def list_clients(context=Depends(current_user)) -> list[dict[str, Any]]:
    db, _ = context
    return db.table("clients").select("*").eq("active", True).order("name").execute().data or []


@router.post("", status_code=201)
def create_client(payload: ClientCreate, context=Depends(current_user)) -> dict[str, Any]:
    db, user = context
    return db.table("clients").insert({**payload.model_dump(mode="json"), "therapist_id": user["id"]}).execute().data[0]
