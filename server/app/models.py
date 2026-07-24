import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class EventType(str, enum.Enum):
    BURP = "burp"
    WATER = "water"
    MEAL = "meal"
    ACTIVITY = "activity"
    SYMPTOM = "symptom"
    MEDICINE = "medicine"
    SLEEP = "sleep"
    NOTE = "note"


class DailyEvent(Base):
    __tablename__ = "daily_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="event_type"), index=True
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    entered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    count: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str | None] = mapped_column(String(120))
    note: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict] = mapped_column(JSONB, default=dict)

