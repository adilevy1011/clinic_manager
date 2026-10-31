"""Request and response validation models."""

from datetime import date
from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str | None = None
    default_fee: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    currency: Literal["ILS", "USD"] = "ILS"


class ClientUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = None
    default_fee: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    currency: Literal["ILS", "USD"] | None = None
    notes: str | None = Field(default=None, max_length=3000)


class MeetingCreate(BaseModel):
    client_id: str
    meeting_date: date
    start_time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    cost: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    currency: Literal["ILS", "USD"] = "ILS"
    status: str = Field(default="scheduled", pattern="^(scheduled|completed|cancelled)$")
    payment_status: Literal["unpaid", "partial", "paid"] = "unpaid"
    amount_paid: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=2)
    notes: str | None = Field(default=None, max_length=1000)


class MeetingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_id: str | None = None
    meeting_date: date | None = None
    start_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    cost: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    currency: Literal["ILS", "USD"] | None = None
    status: str | None = Field(default=None, pattern="^(scheduled|completed|cancelled)$")
    payment_status: Literal["unpaid", "partial", "paid"] | None = None
    amount_paid: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    notes: str | None = Field(default=None, max_length=1000)


class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body: str | None = Field(default=None, max_length=3000)
    remind_at: str | None = None
    recurrence: Literal["once", "daily", "weekly", "after_session"] = "once"
    client_id: str | None = None
    email: str | None = None
    trigger_after_minutes: int = Field(default=0, ge=0, le=10080)


class ReminderUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=160)
    body: str | None = Field(default=None, max_length=3000)
    remind_at: str | None = None
    recurrence: Literal["once", "daily", "weekly", "after_session"] | None = None
    client_id: str | None = None
    email: str | None = None
    trigger_after_minutes: int | None = Field(default=None, ge=0, le=10080)
    completed: bool | None = None
