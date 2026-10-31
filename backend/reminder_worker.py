"""Poll due reminders and deliver them through Resend.

Run this as a separate systemd service so it has exactly one scheduler process,
even when Uvicorn runs multiple web workers.
"""

from datetime import datetime, timedelta, timezone
import os
import time
from typing import Any

import httpx


SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
RESEND_API_KEY = os.environ["RESEND_API_KEY"]
RESEND_FROM = os.environ["RESEND_FROM"]
POLL_SECONDS = int(os.environ.get("REMINDER_POLL_SECONDS", "60"))
HEADERS = {"apikey": SERVICE_ROLE_KEY, "Authorization": f"Bearer {SERVICE_ROLE_KEY}"}


def table_request(method: str, table: str, **kwargs: Any) -> Any:
    request_headers = {**HEADERS, "Content-Type": "application/json"}
    request_headers.update(kwargs.pop("headers", {}))
    response = httpx.request(
        method,
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=request_headers,
        timeout=15,
        **kwargs,
    )
    response.raise_for_status()
    return response.json() if response.content else None


def send_email(reminder: dict[str, Any]) -> None:
    if not reminder.get("email"):
        return
    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
        json={
            "from": RESEND_FROM,
            "to": [reminder["email"]],
            "subject": reminder["title"],
            "html": f"<p>{reminder.get('body') or reminder['title']}</p>",
        },
        timeout=15,
    )
    response.raise_for_status()


def iso_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def process_reminder(reminder: dict[str, Any], now: datetime) -> None:
    recurrence = reminder["recurrence"]
    due = False
    next_run: datetime | None = None

    if recurrence == "after_session":
        meetings = table_request(
            "GET",
            "meetings",
            params={
                "select": "id,meeting_date,start_time",
                "therapist_id": f"eq.{reminder['therapist_id']}",
                "client_id": f"eq.{reminder['client_id']}",
                "status": "eq.completed",
                "order": "meeting_date.desc,start_time.desc",
                "limit": "1",
            },
        ) or []
        if not meetings:
            return
        session = meetings[0]
        session_at = datetime.fromisoformat(f"{session['meeting_date']}T{session['start_time']}").replace(tzinfo=timezone.utc)
        last_sent = iso_datetime(reminder["last_sent_at"]) if reminder.get("last_sent_at") else None
        due_at = session_at + timedelta(minutes=reminder.get("trigger_after_minutes", 0))
        due = due_at <= now and (last_sent is None or session_at > last_sent)
    else:
        if not reminder.get("remind_at"):
            return
        due_at = iso_datetime(reminder["remind_at"])
        due = due_at <= now
        if recurrence == "daily":
            next_run = due_at + timedelta(days=1)
        elif recurrence == "weekly":
            next_run = due_at + timedelta(weeks=1)

    if not due:
        return

    send_email(reminder)
    updates: dict[str, Any] = {"last_sent_at": now.isoformat()}
    if recurrence == "once":
        updates["completed"] = True
    elif next_run:
        updates["remind_at"] = next_run.isoformat()
    table_request("PATCH", "reminders", params={"id": f"eq.{reminder['id']}"}, json=updates, headers={"Prefer": "return=minimal"})


def run() -> None:
    while True:
        try:
            now = datetime.now(timezone.utc)
            reminders = table_request("GET", "reminders", params={"select": "*", "completed": "eq.false"}) or []
            for reminder in reminders:
                try:
                    process_reminder(reminder, now)
                except Exception as error:  # keep one bad reminder from stopping the worker
                    print(f"Reminder {reminder.get('id')} failed: {error}", flush=True)
        except Exception as error:
            print(f"Reminder worker failed: {error}", flush=True)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    run()
