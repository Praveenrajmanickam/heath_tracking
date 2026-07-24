import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import EventType


class EventCreate(BaseModel):
    event_type: EventType
    occurred_at: datetime
    count: int = Field(default=1, ge=1, le=100)
    title: str | None = Field(default=None, max_length=120)
    note: str | None = Field(default=None, max_length=2000)
    details: dict = Field(default_factory=dict)

    @field_validator("occurred_at")
    @classmethod
    def timestamp_must_have_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("occurred_at must include a timezone")
        return value


class EventRead(EventCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entered_at: datetime


class DaySummary(BaseModel):
    date: str
    total_burps: int
    total_events: int
    events: list[EventRead]


class HourBurp(BaseModel):
    hour: int
    count: int


class WaterBurpInsight(BaseModel):
    window_minutes: int
    water_events: int
    total_burps_after: int
    avg_burps_after: float


class DayTrend(BaseModel):
    date: str
    burps: int
    symptoms: int


class Insights(BaseModel):
    date: str
    burps_by_hour: list[HourBurp]
    water_burp: WaterBurpInsight
    trend_7d: list[DayTrend]

