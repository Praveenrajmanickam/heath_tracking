import os
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .config import get_settings
from .database import Base, engine, get_db
from .models import DailyEvent, EventType
from .schemas import (
    DaySummary,
    DayTrend,
    EventCreate,
    EventRead,
    HourBurp,
    Insights,
    WaterBurpInsight,
)

INDIA_TZ = ZoneInfo("Asia/Kolkata")
WATER_BURP_WINDOW = timedelta(minutes=15)


def ensure_event_types() -> None:
    """Keep the Postgres enum in sync with the Python EventType.

    Native enums do not gain new values automatically when the Python enum
    grows, so a new type such as ``water`` cannot be stored until it is added.
    This runs each ``ALTER TYPE ... ADD VALUE IF NOT EXISTS`` outside a
    transaction. It is best-effort: on a non-Postgres backend it is skipped.
    """
    # SQLAlchemy may persist an enum under its name (WATER) or its value (water)
    # depending on version/config, so register both labels. Extra enum labels
    # are inert. Labels come from our own EventType, never user input.
    labels = sorted({m.name for m in EventType} | {m.value for m in EventType})
    try:
        with engine.connect() as conn:
            autocommit = conn.execution_options(isolation_level="AUTOCOMMIT")
            for label in labels:
                autocommit.execute(
                    text(f"ALTER TYPE event_type ADD VALUE IF NOT EXISTS '{label}'")
                )
    except Exception:
        # Enum type not present yet (fresh create_all already included every
        # value) or a non-Postgres backend — nothing to migrate.
        pass


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_event_types()
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data endpoints that require the passcode when APP_PASSCODE is set.
PROTECTED_PREFIXES = ("/events", "/days", "/insights")


@app.middleware("http")
async def passcode_guard(request: Request, call_next):
    """Require the shared passcode on data endpoints when one is configured.

    The website itself and /health stay open so the unlock screen can load;
    only the health-data routes are gated. Preflight (OPTIONS) is allowed
    through so browsers can complete CORS checks.
    """
    passcode = settings.app_passcode
    if (
        passcode
        and request.method != "OPTIONS"
        and request.url.path.startswith(PROTECTED_PREFIXES)
        and request.headers.get("X-Passcode") != passcode
    ):
        return JSONResponse(
            {"detail": "Invalid or missing passcode"}, status_code=401
        )
    return await call_next(request)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/events", response_model=EventRead, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, db: Session = Depends(get_db)) -> DailyEvent:
    event = DailyEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@app.get("/days/{day}", response_model=DaySummary)
def read_day(
    day: date,
    tz: str = Query(default="Asia/Kolkata"),
    db: Session = Depends(get_db),
) -> DaySummary:
    try:
        local_tz = ZoneInfo(tz)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unknown timezone") from exc

    local_start = datetime.combine(day, time.min, tzinfo=local_tz)
    utc_start = local_start.astimezone(timezone.utc)
    utc_end = (local_start + timedelta(days=1)).astimezone(timezone.utc)

    events = list(
        db.scalars(
            select(DailyEvent)
            .where(
                DailyEvent.occurred_at >= utc_start,
                DailyEvent.occurred_at < utc_end,
            )
            .order_by(DailyEvent.occurred_at.desc())
        )
    )
    total_burps = sum(
        event.count for event in events if event.event_type == EventType.BURP
    )
    return DaySummary(
        date=day.isoformat(),
        total_burps=total_burps,
        total_events=len(events),
        events=events,
    )


@app.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: str, db: Session = Depends(get_db)) -> None:
    event = db.get(DailyEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()


def _resolve_tz(tz: str) -> ZoneInfo:
    try:
        return ZoneInfo(tz)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unknown timezone") from exc


def _events_between(
    db: Session, start_utc: datetime, end_utc: datetime
) -> list[DailyEvent]:
    return list(
        db.scalars(
            select(DailyEvent)
            .where(
                DailyEvent.occurred_at >= start_utc,
                DailyEvent.occurred_at < end_utc,
            )
            .order_by(DailyEvent.occurred_at.asc())
        )
    )


@app.get("/insights/{day}", response_model=Insights)
def read_insights(
    day: date,
    tz: str = Query(default="Asia/Kolkata"),
    db: Session = Depends(get_db),
) -> Insights:
    """Observed patterns for a day. Language is 'associated with', not 'caused by'."""
    local_tz = _resolve_tz(tz)
    day_start = datetime.combine(day, time.min, tzinfo=local_tz)
    day_start_utc = day_start.astimezone(timezone.utc)
    day_end_utc = (day_start + timedelta(days=1)).astimezone(timezone.utc)

    day_events = _events_between(db, day_start_utc, day_end_utc)

    # Burps bucketed by local hour of day.
    per_hour: dict[int, int] = defaultdict(int)
    burps = [e for e in day_events if e.event_type == EventType.BURP]
    for event in burps:
        local_hour = event.occurred_at.astimezone(local_tz).hour
        per_hour[local_hour] += event.count
    burps_by_hour = [HourBurp(hour=h, count=per_hour.get(h, 0)) for h in range(24)]

    # Burps observed within the window after each glass of water.
    waters = [e for e in day_events if e.event_type == EventType.WATER]
    burps_sorted = sorted(burps, key=lambda e: e.occurred_at)
    total_after = 0
    for water in waters:
        window_end = water.occurred_at + WATER_BURP_WINDOW
        total_after += sum(
            b.count
            for b in burps_sorted
            if water.occurred_at <= b.occurred_at < window_end
        )
    water_events = len(waters)
    water_burp = WaterBurpInsight(
        window_minutes=int(WATER_BURP_WINDOW.total_seconds() // 60),
        water_events=water_events,
        total_burps_after=total_after,
        avg_burps_after=round(total_after / water_events, 1) if water_events else 0.0,
    )

    # Seven-day trend of burps and symptom counts, ending on the requested day.
    trend_start = day_start - timedelta(days=6)
    trend_start_utc = trend_start.astimezone(timezone.utc)
    trend_events = _events_between(db, trend_start_utc, day_end_utc)
    burps_by_day: dict[str, int] = defaultdict(int)
    symptoms_by_day: dict[str, int] = defaultdict(int)
    for event in trend_events:
        key = event.occurred_at.astimezone(local_tz).date().isoformat()
        if event.event_type == EventType.BURP:
            burps_by_day[key] += event.count
        elif event.event_type == EventType.SYMPTOM:
            symptoms_by_day[key] += 1
    trend_7d = []
    for offset in range(6, -1, -1):
        key = (day - timedelta(days=offset)).isoformat()
        trend_7d.append(
            DayTrend(
                date=key,
                burps=burps_by_day.get(key, 0),
                symptoms=symptoms_by_day.get(key, 0),
            )
        )

    return Insights(
        date=day.isoformat(),
        burps_by_hour=burps_by_hour,
        water_burp=water_burp,
        trend_7d=trend_7d,
    )


# Serve the built web app (production single-service deploy). The API routes
# above are registered first, so they always win; this only handles the
# website's own files. Absent in local dev, where the web app runs via Vite.
_STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(_STATIC_DIR):
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="web")
