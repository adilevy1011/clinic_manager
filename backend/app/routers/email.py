"""Transactional email endpoints backed by Resend."""

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..config import settings
from ..dependencies import current_user

router = APIRouter(prefix="/api/email", tags=["email"])


@router.post("/reminder")
def send_reminder(meeting_id: str, context=Depends(current_user)) -> dict[str, str]:
    if not settings.resend_api_key or not settings.resend_from:
        raise HTTPException(503, "Resend is not configured yet.")

    db, _ = context
    meeting = db.table("meetings").select("*, clients(name, email)").eq("id", meeting_id).single().execute().data
    client = (meeting or {}).get("clients") or {}
    if not client.get("email"):
        raise HTTPException(400, "This client does not have an email address.")

    html = (
        f"<p>Hi {client['name']},</p>"
        f"<p>A friendly reminder for your session on <strong>{meeting['meeting_date']}"
        f"</strong> at <strong>{meeting['start_time']}</strong>.</p>"
        "<p>See you soon.</p>"
    )
    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
        json={"from": settings.resend_from, "to": [client["email"]], "subject": "Session reminder", "html": html},
        timeout=10,
    )
    if response.status_code >= 400:
        raise HTTPException(502, "Resend could not send the reminder.")
    return {"status": "sent"}
