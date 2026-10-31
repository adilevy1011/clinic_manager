"""Client payment ledger and financial summary endpoints."""

from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import current_user
from ..schemas import PaymentCreate

router = APIRouter(prefix="/api/clients", tags=["payments"])


def numeric(value: Any) -> Decimal:
    return Decimal(str(value or 0))


@router.get("/{client_id}/finance")
def client_finance(client_id: str, context=Depends(current_user)) -> dict[str, Any]:
    db, _ = context
    client = db.table("clients").select("*").eq("id", client_id).single().execute().data
    if not client:
        raise HTTPException(404, "Client not found.")

    meetings = db.table("meetings").select("*").eq("client_id", client_id).order("meeting_date").order("start_time").execute().data or []
    payments = db.table("payments").select("*").eq("client_id", client_id).order("payment_date").execute().data or []
    charged = sum((numeric(meeting.get("cost")) for meeting in meetings if meeting.get("status") != "cancelled"), Decimal("0"))
    paid = sum((numeric(payment.get("amount")) for payment in payments), Decimal("0"))
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
            "charged": numeric(meeting.get("cost")),
            "paid": paid_by_meeting.get(meeting["id"], Decimal("0")),
            "owed": max(numeric(meeting.get("cost")) - paid_by_meeting.get(meeting["id"], Decimal("0")), Decimal("0")),
        }
        for meeting in meetings
    ]
    return {
        "client": client,
        "meetings": meetings,
        "meeting_balances": meeting_balances,
        "payments": payments,
        "totals": {"charged": charged, "paid": paid, "owed": owed},
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
