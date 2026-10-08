"""Integration tests always use an isolated, in-memory database and fake secrets.

Set these before importing any application module: running pytest must never
connect to, create tables in, or delete data from a configured application DB.
"""

import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-only-signing-key-never-use-in-production-123456789"
os.environ["ANTHROPIC_API_KEY"] = "test-only-api-key"
os.environ["ALLOWED_ORIGINS"] = "https://fitness-app-two-tawny.vercel.app"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "10080"

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app


@compiles(JSONB, "sqlite")
def compile_jsonb_for_tests(_type, _compiler, **_kwargs):
    """SQLite stores test JSON; production PostgreSQL keeps its native JSONB."""
    return "JSON"


engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestSessionLocal = sessionmaker(bind=engine, autoflush=False)


@event.listens_for(engine, "connect")
def enable_foreign_keys(connection, _record):
    connection.execute("PRAGMA foreign_keys=ON")


@pytest.fixture(autouse=True)
def isolated_database(monkeypatch):
    Base.metadata.create_all(bind=engine)

    def test_database():
        with TestSessionLocal() as db:
            yield db

    def disallow_ai_calls(*_args, **_kwargs):
        raise AssertionError("Tests must mock AI responses; external API calls are disabled")

    from app.services import ai
    from app.routers import progress as progress_router
    from app import ratelimit
    monkeypatch.setattr(ai.client.messages, "create", disallow_ai_calls)
    monkeypatch.setattr(ai.client.messages, "stream", disallow_ai_calls)
    # Rate-limit counters and cached AI answers must never leak between tests.
    ratelimit.reset()
    progress_router.reset_cache()
    app.dependency_overrides[get_db] = test_database
    yield
    app.dependency_overrides.clear()
    ratelimit.reset()
    progress_router.reset_cache()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    with TestSessionLocal() as session:
        yield session
