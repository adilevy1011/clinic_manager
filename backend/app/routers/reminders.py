"""Reminder CRUD endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import current_user
from ..schemas import ReminderCreate, ReminderUpdate

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("")
def list_reminders(context=Depends(current_user)) -> list[dict[str, Any]]:
    db, _ = context
    return db.table("reminders").select("*, clients(name, email)").eq("completed", False).order("remind_at").execute().data or []


@router.post("", status_code=201)
def create_reminder(payload: ReminderCreate, context=Depends(current_user)) -> dict[str, Any]:
    db, user = context
    if payload.recurrence == "after_session" and not payload.client_id:
        raise HTTPException(400, "After-session reminders need a client.")
    row = {**payload.model_dump(mode="json"), "therapist_id": user["id"]}
    return db.table("reminders").insert(row).execute().data[0]


@router.patch("/{reminder_id}")
def update_reminder(reminder_id: str, payload: ReminderUpdate, context=Depends(current_user)) -> dict[str, Any]:
    db, _ = context
    updates = {key: value for key, value in payload.model_dump(mode="json").items() if value is not None}
    if updates.get("recurrence") == "after_session" and not updates.get("client_id"):
        existing = db.table("reminders").select("client_id").eq("id", reminder_id).single().execute().data
        if not existing or not existing.get("client_id"):
            raise HTTPException(400, "After-session reminders need a client.")
    if not updates:
        raise HTTPException(400, "No changes supplied.")
    result = db.table("reminders").update(updates).eq("id", reminder_id).execute()
    if not result.data:
        raise HTTPException(404, "Reminder not found.")
    return result.data[0]


@router.delete("/{reminder_id}", status_code=204)
def delete_reminder(reminder_id: str, context=Depends(current_user)) -> None:
    db, _ = context
    db.table("reminders").delete().eq("id", reminder_id).execute()
