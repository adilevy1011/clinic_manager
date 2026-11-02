"""Monthly money-management summaries across all clients."""

from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query

from ..dependencies import current_user
from .meetings import apply_automatic_statuses, date_range, therapist_timezone
from .payments import month_meetings, numeric

router = APIRouter(prefix="/api/finance", tags=["finance"])


@router.get("/clients")
def client_money_management(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    context=Depends(current_user),
) -> dict[str, Any]:
    db, _ = context
    clients = db.table("clients").select("*").order("name").execute().data or []
    meetings = db.table("meetings").select("*").order("meeting_date").execute().data or []
    payments = db.table("payments").select("*").order("payment_date").execute().data or []
    month_start, month_end = date_range(month)
    result = []

    for client in clients:
        client_meetings = apply_automatic_statuses(
            db,
            month_meetings([meeting for meeting in meetings if meeting.get("client_id") == client["id"]], month),
            therapist_timezone(db),
        )
        client_payments = [payment for payment in payments if payment.get("client_id") == client["id"]]
        charged = sum((numeric(meeting.get("cost")) for meeting in client_meetings if meeting.get("status") == "completed"), Decimal("0"))
        anticipated = sum((numeric(meeting.get("cost")) for meeting in client_meetings if meeting.get("status") == "scheduled"), Decimal("0"))
        paid = sum((numeric(payment.get("amount")) for payment in client_payments if month_start <= date.fromisoformat(payment["payment_date"]) <= month_end), Decimal("0"))
        linked_paid = {}
        for payment in client_payments:
            if payment.get("meeting_id"):
                linked_paid[payment["meeting_id"]] = linked_paid.get(payment["meeting_id"], Decimal("0")) + numeric(payment.get("amount"))
        paid += sum(
            max(numeric(meeting.get("amount_paid")) - linked_paid.get(meeting.get("id"), Decimal("0")), Decimal("0"))
            for meeting in client_meetings
            if meeting.get("status") == "completed" and not meeting.get("is_virtual")
        )
        result.append({
            "id": client["id"],
            "name": client["name"],
            "email": client.get("email"),
            "currency": client.get("currency", "USD"),
            "charged": charged,
            "paid": paid,
            "owed": max(charged - paid, Decimal("0")),
            "anticipated": anticipated,
        })

    return {"month": month, "clients": result}
