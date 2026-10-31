"""Client payment ledger and financial summary endpoints."""

from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..dependencies import current_user
from ..schemas import PaymentCreate
from .meetings import date_range, occurrence_dates, virtual_occurrence

router = APIRouter(prefix="/api/clients", tags=["payments"])


def numeric(value: Any) -> Decimal:
    return Decimal(str(value or 0))


def month_meetings(rows: list[dict[str, Any]], month: str) -> list[dict[str, Any]]:
    window_start, window_end = date_range(month)
    series = [row for row in rows if row.get("recurrence_rule") and not row.get("recurrence_exception_type")]
    exceptions = [row for row in rows if row.get("recurrence_exception_type")]
    standalone = [row for row in rows if not row.get("recurrence_rule") and not row.get("recurrence_exception_type")]
    result = [row for row in standalone if window_start <= date.fromisoformat(row["meeting_date"]) <= window_end]
    exception_map = {(row.get("series_id"), row.get("recurrence_occurrence_date")): row for row in exceptions}
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
        and row.get("recurrence_exception_type") != "cancelled"
        and window_start <= date.fromisoformat(row["meeting_date"]) <= window_end
    )
    return sorted(result, key=lambda row: (row["meeting_date"], row["start_time"]))


@router.get("/{client_id}/finance")
def client_finance(
    client_id: str,
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    context=Depends(current_user),
) -> dict[str, Any]:
    db, _ = context
    client = db.table("clients").select("*").eq("id", client_id).single().execute().data
    if not client:
        raise HTTPException(404, "Client not found.")

    all_meetings = db.table("meetings").select("*").eq("client_id", client_id).order("meeting_date").order("start_time").execute().data or []
    meetings = month_meetings(all_meetings, month)
    payments = db.table("payments").select("*").eq("client_id", client_id).order("payment_date").execute().data or []
    month_start, month_end = date_range(month)
    charged = sum((numeric(meeting.get("cost")) for meeting in meetings if meeting.get("status") == "completed"), Decimal("0"))
    anticipated = sum((numeric(meeting.get("cost")) for meeting in meetings if meeting.get("status") == "scheduled"), Decimal("0"))
    paid = sum((numeric(payment.get("amount")) for payment in payments if month_start <= date.fromisoformat(payment["payment_date"]) <= month_end), Decimal("0"))
    owed = max(charged - paid, Decimal("0"))
    paid_by_meeting: dict[str, Decimal] = {}
    for payment in payments:
        meeting_id = payment.get("meeting_id")
        if meeting_id:
            paid_by_meeting[meeting_id] = paid_by_meeting.get(meeting_id, Decimal("0")) + numeric(payment.get("amount"))
    meeting_balances = [
        {
            "id": meeting["id"],
            "meeting_date": meeting["meeting_date"],
            "start_time": meeting["start_time"],
            "status": meeting["status"],
            "currency": meeting.get("currency", "USD"),
            "charged": numeric(meeting.get("cost")) if meeting.get("status") == "completed" else Decimal("0"),
            "anticipated": numeric(meeting.get("cost")) if meeting.get("status") == "scheduled" else Decimal("0"),
            "paid": paid_by_meeting.get(meeting["id"], Decimal("0")),
            "owed": max(numeric(meeting.get("cost")) - paid_by_meeting.get(meeting["id"], Decimal("0")), Decimal("0")) if meeting.get("status") == "completed" else Decimal("0"),
        }
        for meeting in meetings
    ]
    return {
        "client": client,
        "meetings": meetings,
        "meeting_balances": meeting_balances,
        "payments": payments,
        "totals": {"charged": charged, "paid": paid, "owed": owed, "anticipated": anticipated},
    }


@router.post("/{client_id}/payments", status_code=201)
def create_payment(client_id: str, payload: PaymentCreate, context=Depends(current_user)) -> dict[str, Any]:
    db, user = context
    client = db.table("clients").select("id").eq("id", client_id).single().execute().data
    if not client:
        raise HTTPException(404, "Client not found.")
    if payload.meeting_id:
        meeting = db.table("meetings").select("id").eq("id", payload.meeting_id).eq("client_id", client_id).single().execute().data
        if not meeting:
            raise HTTPException(400, "The selected session does not belong to this client.")
    row = {**payload.model_dump(mode="json"), "client_id": client_id, "therapist_id": user["id"]}
    return db.table("payments").insert(row).execute().data[0]


@router.delete("/{client_id}/payments/{payment_id}", status_code=204)
def delete_payment(client_id: str, payment_id: str, context=Depends(current_user)) -> None:
    db, _ = context
    db.table("payments").delete().eq("id", payment_id).eq("client_id", client_id).execute()
