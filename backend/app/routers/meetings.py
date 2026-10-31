"""Meeting and calendar endpoints."""

from datetime import date, timedelta
from calendar import monthrange
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from ..dependencies import current_user
from ..schemas import MeetingCreate, MeetingUpdate

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def date_range(month: str) -> tuple[date, date]:
    year, month_number = map(int, month.split("-"))
    start = date(year, month_number, 1)
    next_month = date(year + (month_number == 12), 1 if month_number == 12 else month_number + 1, 1)
    return start, next_month - timedelta(days=1)


def occurrence_dates(series: dict[str, Any], window_start: date, window_end: date) -> list[date]:
    rule = series.get("recurrence_rule") or {}
    start = date.fromisoformat(series["meeting_date"])
    end = date.fromisoformat(series["recurrence_end_date"]) if series.get("recurrence_end_date") else window_end
    end = min(end, window_end)
    if end < window_start or start > end:
        return []

    frequency = rule.get("frequency")
    interval = max(int(rule.get("interval", 1)), 1)
    occurrences: list[date] = []
    if frequency == "weekly":
        weekdays = {int(day) for day in rule.get("weekdays", [start.weekday()])}
        anchor = start - timedelta(days=start.weekday())
        cursor = max(start, window_start)
        while cursor <= end:
            week_number = (cursor - anchor).days // 7
            if week_number % interval == 0 and cursor.weekday() in weekdays:
                occurrences.append(cursor)
            cursor += timedelta(days=1)
    elif frequency == "monthly":
        day = int(rule.get("day", start.day))
        cursor = date(start.year, start.month, 1)
        while cursor <= end:
            if monthrange(cursor.year, cursor.month)[1] >= day:
                occurrence = cursor.replace(day=day)
                if start <= occurrence <= end and occurrence >= window_start:
                    occurrences.append(occurrence)
            month_index = cursor.year * 12 + cursor.month - 1 + interval
            cursor = date(month_index // 12, month_index % 12 + 1, 1)
    return occurrences


def virtual_occurrence(series: dict[str, Any], occurrence: date) -> dict[str, Any]:
    return {
        **series,
        "id": f"{series['series_id']}:{occurrence.isoformat()}",
        "meeting_date": occurrence.isoformat(),
        "recurrence_occurrence_date": occurrence.isoformat(),
        "source_meeting_id": series["id"],
        "is_virtual": True,
    }


def is_virtual_id(meeting_id: str) -> bool:
    return ":" in meeting_id


def validate_rule(rule: dict[str, Any], start: date) -> None:
    frequency = rule.get("frequency")
    interval = rule.get("interval", 1)
    if frequency not in {"weekly", "monthly"}:
        raise HTTPException(400, "Recurrence must be weekly or monthly.")
    if not isinstance(interval, int) or interval < 1 or interval > 12:
        raise HTTPException(400, "Recurrence interval must be between 1 and 12.")
    if frequency == "weekly":
        weekdays = rule.get("weekdays", [start.weekday()])
        if not weekdays or any(not isinstance(day, int) or day < 0 or day > 6 for day in weekdays):
            raise HTTPException(400, "Choose at least one valid weekday.")
    if frequency == "monthly":
        day = rule.get("day", start.day)
        if not isinstance(day, int) or day < 1 or day > 31:
            raise HTTPException(400, "Monthly recurrence day must be between 1 and 31.")


@router.get("")
def list_meetings(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    context=Depends(current_user),
) -> list[dict[str, Any]]:
    db, _ = context
    window_start, window_end = date_range(month)
    rows = db.table("meetings").select("*, clients(name, email)").order("meeting_date").order("start_time").execute().data or []
    series = [row for row in rows if row.get("recurrence_rule") and not row.get("recurrence_exception_type")]
    exceptions = [row for row in rows if row.get("recurrence_exception_type")]
    standalone = [row for row in rows if not row.get("recurrence_rule") and not row.get("recurrence_exception_type")]
    result = [row for row in standalone if window_start <= date.fromisoformat(row["meeting_date"]) <= window_end]

    exception_map = {
        (row.get("series_id"), row.get("recurrence_occurrence_date")): row
        for row in exceptions
    }
    included_exception_ids: set[str] = set()
    for source in series:
        for occurrence in occurrence_dates(source, window_start, window_end):
            exception = exception_map.get((source.get("series_id"), occurrence.isoformat()))
            if exception:
                if exception.get("recurrence_exception_type") != "cancelled":
                    result.append({**exception, "is_exception": True, "source_meeting_id": source["id"]})
                    included_exception_ids.add(exception["id"])
                continue
            result.append(virtual_occurrence(source, occurrence))

    result.extend(
        row for row in exceptions
        if row["id"] not in included_exception_ids
        if row.get("recurrence_exception_type") != "cancelled"
        and window_start <= date.fromisoformat(row["meeting_date"]) <= window_end
    )
    return sorted(result, key=lambda row: (row["meeting_date"], row["start_time"]))


@router.post("", status_code=201)
def create_meeting(payload: MeetingCreate, context=Depends(current_user)) -> dict[str, Any]:
    db, user = context
    row = payload.model_dump(mode="json")
    row.pop("repeat_weekly", None)
    row.pop("repeat_until", None)
    recurrence_rule = row.get("recurrence_rule")
    if recurrence_rule:
        validate_rule(recurrence_rule, payload.meeting_date)
        if payload.recurrence_end_date and payload.recurrence_end_date < payload.meeting_date:
            raise HTTPException(400, "The recurring end date must be on or after the first session.")
    else:
        row.pop("recurrence_end_date", None)
    row["therapist_id"] = user["id"]
    return db.table("meetings").insert(row).execute().data[0]


@router.patch("/{meeting_id}")
def update_meeting(meeting_id: str, payload: MeetingUpdate, context=Depends(current_user)) -> dict[str, Any]:
    db, user = context
    if is_virtual_id(meeting_id):
        series_id, occurrence_value = meeting_id.split(":", 1)
        occurrence = date.fromisoformat(occurrence_value)
        source_rows = db.table("meetings").select("*").eq("series_id", series_id).eq("therapist_id", user["id"]).execute().data or []
        source = next((row for row in source_rows if row.get("recurrence_rule") and not row.get("recurrence_exception_type")), None)
        if not source:
            raise HTTPException(404, "Recurring session not found.")
        updates = {key: value for key, value in payload.model_dump(mode="json").items() if value is not None and key != "edit_scope"}
        edit_scope = payload.edit_scope
        if edit_scope == "all":
            updates.pop("meeting_date", None)
            result = db.table("meetings").update(updates).eq("id", source["id"]).execute()
            return result.data[0]
        if edit_scope == "future":
            old_end = source.get("recurrence_end_date")
            previous_end = occurrence - timedelta(days=1)
            db.table("meetings").update({"recurrence_end_date": previous_end.isoformat()}).eq("id", source["id"]).execute()
            new_row = {key: source[key] for key in ("therapist_id", "client_id", "start_time", "cost", "currency", "status", "payment_status", "amount_paid", "notes")}
            new_row.update(updates)
            new_row.update({"meeting_date": updates.get("meeting_date", occurrence.isoformat()), "recurrence_rule": updates.get("recurrence_rule", source["recurrence_rule"]), "recurrence_end_date": updates.get("recurrence_end_date", old_end)})
            validate_rule(new_row["recurrence_rule"], date.fromisoformat(new_row["meeting_date"]))
            return db.table("meetings").insert(new_row).execute().data[0]

        exception = {key: source[key] for key in ("therapist_id", "client_id", "start_time", "cost", "currency", "status", "payment_status", "amount_paid", "notes")}
        exception.update(updates)
        exception.update({"series_id": source["series_id"], "meeting_date": updates.get("meeting_date", occurrence.isoformat()), "recurrence_occurrence_date": occurrence.isoformat(), "recurrence_exception_type": "override"})
        return db.table("meetings").insert(exception).execute().data[0]

    updates = {key: value for key, value in payload.model_dump(mode="json").items() if value is not None and key != "edit_scope"}
    if not updates:
        raise HTTPException(400, "No changes supplied.")
    if updates.get("recurrence_rule"):
        start_value = updates.get("meeting_date")
        if not start_value:
            existing = db.table("meetings").select("meeting_date").eq("id", meeting_id).single().execute().data
            start_value = existing["meeting_date"] if existing else None
        validate_rule(updates["recurrence_rule"], date.fromisoformat(start_value))
    result = db.table("meetings").update(updates).eq("id", meeting_id).execute()
    if not result.data:
        raise HTTPException(404, "Meeting not found.")
    return result.data[0]


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(
    meeting_id: str,
    scope: Literal["single", "future", "all"] = Query(default="single"),
    context=Depends(current_user),
) -> None:
    db, user = context
    if is_virtual_id(meeting_id):
        series_id, occurrence_value = meeting_id.split(":", 1)
        occurrence = date.fromisoformat(occurrence_value)
        source = db.table("meetings").select("*").eq("series_id", series_id).eq("therapist_id", user["id"]).execute().data or []
        source = next((row for row in source if row.get("recurrence_rule")), None)
        if not source:
            raise HTTPException(404, "Recurring session not found.")
        if scope == "all":
            db.table("meetings").delete().eq("series_id", source["series_id"]).execute()
            db.table("meetings").delete().eq("id", source["id"]).execute()
            return
        if scope == "future":
            if occurrence <= date.fromisoformat(source["meeting_date"]):
                db.table("meetings").delete().eq("series_id", source["series_id"]).execute()
                db.table("meetings").delete().eq("id", source["id"]).execute()
            else:
                db.table("meetings").update({"recurrence_end_date": (occurrence - timedelta(days=1)).isoformat()}).eq("id", source["id"]).execute()
            return
        exception = {key: source[key] for key in ("therapist_id", "client_id", "start_time", "cost", "currency", "status", "payment_status", "amount_paid", "notes")}
        exception.update({"series_id": source["series_id"], "meeting_date": occurrence.isoformat(), "recurrence_occurrence_date": occurrence.isoformat(), "recurrence_exception_type": "cancelled", "status": "cancelled"})
        db.table("meetings").insert(exception).execute()
        return
    existing_rows = db.table("meetings").select("*").eq("id", meeting_id).eq("therapist_id", user["id"]).execute().data or []
    existing = existing_rows[0] if existing_rows else None
    if existing and existing.get("recurrence_rule") and scope in {"all", "future"}:
        if scope == "all":
            db.table("meetings").delete().eq("series_id", existing["series_id"]).execute()
            db.table("meetings").delete().eq("id", meeting_id).execute()
        return
    if existing and existing.get("recurrence_exception_type"):
        db.table("meetings").update({
            "status": "cancelled",
            "meeting_date": existing.get("recurrence_occurrence_date", existing["meeting_date"]),
            "recurrence_exception_type": "cancelled",
        }).eq("id", meeting_id).execute()
        return
    db.table("meetings").delete().eq("id", meeting_id).execute()
