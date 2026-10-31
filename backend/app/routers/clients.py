"""Client management endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import current_user
from ..schemas import ClientCreate, ClientUpdate

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("")
def list_clients(context=Depends(current_user)) -> list[dict[str, Any]]:
    db, _ = context
    return db.table("clients").select("*").eq("active", True).order("name").execute().data or []


@router.post("", status_code=201)
def create_client(payload: ClientCreate, context=Depends(current_user)) -> dict[str, Any]:
    db, user = context
    return db.table("clients").insert({**payload.model_dump(mode="json"), "therapist_id": user["id"]}).execute().data[0]


@router.get("/{client_id}")
def get_client(client_id: str, context=Depends(current_user)) -> dict[str, Any]:
    db, _ = context
    result = db.table("clients").select("*").eq("id", client_id).single().execute()
    if not result.data:
        raise HTTPException(404, "Client not found.")
    return result.data


@router.patch("/{client_id}")
def update_client(client_id: str, payload: ClientUpdate, context=Depends(current_user)) -> dict[str, Any]:
    db, _ = context
    updates = {key: value for key, value in payload.model_dump(mode="json").items() if value is not None}
    if not updates:
        raise HTTPException(400, "No changes supplied.")

    result = db.table("clients").update(updates).eq("id", client_id).execute()
    if not result.data:
        raise HTTPException(404, "Client not found.")
    return result.data[0]
