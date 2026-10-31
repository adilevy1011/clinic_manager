"""Meeting and calendar endpoints."""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..dependencies import current_user
from ..schemas import MeetingCreate, MeetingUpdate

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


@router.get("")
def list_meetings(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    context=Depends(current_user),
) -> list[dict[str, Any]]:
    db, _ = context
    year, month_number = map(int, month.split("-"))
    next_month = date(
        year + (month_number == 12),
        1 if month_number == 12 else month_number + 1,
        1,
    )
    data = (
        db.table("meetings")
        .select("*, clients(name, email)")
        .gte("meeting_date", f"{month}-01")
        .lt("meeting_date", next_month.isoformat())
        .order("meeting_date")
        .order("start_time")
        .execute()
        .data
    )
    return data or []


@router.post("", status_code=201)
def create_meeting(payload: MeetingCreate, context=Depends(current_user)) -> dict[str, Any]:
    db, user = context
    if payload.repeat_weekly and payload.repeat_until is None:
        raise HTTPException(400, "Choose an end date for the recurring sessions.")
    if payload.repeat_until and payload.repeat_until < payload.meeting_date:
        raise HTTPException(400, "The recurring end date must be on or after the first session.")

    row = payload.model_dump(mode="json")
    row.pop("repeat_weekly", None)
    row.pop("repeat_until", None)
    rows = []
    occurrence = payload.meeting_date
    end_date = payload.repeat_until or payload.meeting_date
    while occurrence <= end_date:
        rows.append({**row, "meeting_date": occurrence.isoformat(), "therapist_id": user["id"]})
        if not payload.repeat_weekly:
            break
        occurrence = date.fromordinal(occurrence.toordinal() + 7)

    if len(rows) > 53:
        raise HTTPException(400, "Recurring sessions can span at most one year.")
    created = db.table("meetings").insert(rows).execute().data or []
    return created[0]


@router.patch("/{meeting_id}")
def update_meeting(meeting_id: str, payload: MeetingUpdate, context=Depends(current_user)) -> dict[str, Any]:
    db, _ = context
    updates = {key: value for key, value in payload.model_dump(mode="json").items() if value is not None}
    if not updates:
        raise HTTPException(400, "No changes supplied.")

    result = db.table("meetings").update(updates).eq("id", meeting_id).execute()
    if not result.data:
        raise HTTPException(404, "Meeting not found.")
    return result.data[0]


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: str, context=Depends(current_user)) -> None:
    db, _ = context
    db.table("meetings").delete().eq("id", meeting_id).execute()
