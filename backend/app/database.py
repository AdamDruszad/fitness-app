"""
Database Engine and Session Configuration.

Initializes SQLAlchemy ORM engine, sessionmaker, base model class,
and the FastAPI dependency generator for database sessions.
"""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from app.config import settings

# Create database engine with pool_pre_ping enabled to detect disconnected pool connections
engine = create_engine(settings.database_url, pool_pre_ping=True)

# Factory for creating new database Session instances for incoming requests
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy database models."""
    pass


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a scoped SQLAlchemy database session.
    
    Ensures that the session is properly closed after request processing
    completes, even if an exception occurs during the request lifecycle.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()