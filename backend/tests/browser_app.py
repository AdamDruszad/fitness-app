"""Optional local browser-check server: disposable SQLite and fake provider only.

Run from backend: python -m uvicorn tests.browser_app:app --host 127.0.0.1 --port 8011
Never uses the application's configured database or Anthropic credentials.
"""
import os
from threading import Lock
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "browser-check-only-never-use-in-production-123456789"
os.environ["ANTHROPIC_API_KEY"] = "fake-browser-check"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:5187,http://127.0.0.1:5187"

from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app.models.user import User
from app.models.chat import ChatMessage
from app.services.auth import hash_password
from app.routers import plans
from app.services import ai

@compiles(JSONB, "sqlite")
def jsonb(_type, _compiler, **_kwargs):
    return "JSON"

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
@event.listens_for(engine, "connect")
def foreign_keys(connection, _record):
    connection.execute("PRAGMA foreign_keys=ON")

Base.metadata.create_all(engine)
Sessions = sessionmaker(bind=engine, autoflush=False)
database_lock = Lock()
def database():
    # StaticPool shares one SQLite connection. Serialize browser requests here;
    # real concurrency is tested separately against PostgreSQL, not this fixture.
    with database_lock, Sessions() as db:
        yield db
app.dependency_overrides[get_db] = database

def no_provider(*args, **kwargs):
    raise AssertionError("Browser checks must never contact a provider")
ai.client.messages.create = no_provider
ai.client.messages.stream = no_provider
def fake_proposal(*args):
    return {"title": "Browser test routine", "weeks": 8, "days": [{"day": "Workout A", "focus": "Strength", "exercises": [
        {"name": "Bench press", "sets": 3, "reps": "8-10", "rest_seconds": 90, "load_basis": "total"},
        {"name": "Plank", "sets": 1, "measurement": "duration", "duration_seconds": 30, "rest_seconds": 60, "load_basis": "bodyweight"}]}]}
plans.generate_proposal = fake_proposal

with Sessions() as db:
    for email in ("browser@example.com", "other@example.com"):
        user = User(email=email, password_hash=hash_password("browser-test-password"), goal="strength", level="intermediate")
        db.add(user); db.flush()
        if email.startswith("browser"):
            for i in range(55):
                db.add(ChatMessage(user_id=user.id, role="assistant", content=f"Routine discussion {i}: bench press and plank."))
    db.commit()
