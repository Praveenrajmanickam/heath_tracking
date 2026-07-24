from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


def normalize_database_url(url: str) -> str:
    """Ensure the URL uses the psycopg (v3) driver.

    Managed hosts such as Render hand out URLs like ``postgres://...`` or
    ``postgresql://...`` with no driver. SQLAlchemy would then reach for the
    default psycopg2 driver, which is not installed, so we point every plain
    Postgres URL at the ``psycopg`` (v3) driver this project ships.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


class Base(DeclarativeBase):
    pass


engine = create_engine(
    normalize_database_url(get_settings().database_url), pool_pre_ping=True
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

