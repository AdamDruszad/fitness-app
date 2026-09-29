"""
Pytest Test Suite Configuration and Fixtures.

Configures test database tables and provides automatic teardown
fixtures to ensure clean database state between test runs.
"""

import pytest
from app.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.plan import WorkoutPlan
from app.models.session import ExerciseLog, WorkoutSession
from app.models.chat import ChatMessage


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """
    Session-scoped fixture to create all database tables in the test database
    before any tests run, and drop them upon test session completion.
    """
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_database_tables():
    """
    Function-scoped autouse fixture that purges all database tables
    after each individual test to guarantee test isolation.
    """
    yield
    db = SessionLocal()
    db.query(ChatMessage).delete()
    db.query(ExerciseLog).delete()
    db.query(WorkoutSession).delete()
    db.query(WorkoutPlan).delete()
    db.query(User).delete()
    db.commit()
    db.close()