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


class MeetingCreate(BaseModel):
    client_id: str
    meeting_date: date
    start_time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    cost: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    currency: Literal["ILS", "USD"] = "ILS"
    status: str = Field(default="scheduled", pattern="^(scheduled|completed|cancelled)$")
    notes: str | None = Field(default=None, max_length=1000)


class MeetingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    meeting_date: date | None = None
    start_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    cost: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    currency: Literal["ILS", "USD"] | None = None
    status: str | None = Field(default=None, pattern="^(scheduled|completed|cancelled)$")
    notes: str | None = Field(default=None, max_length=1000)
