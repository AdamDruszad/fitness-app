import pytest
from app.database import SessionLocal
from app.models.user import User
from app.models.plan import WorkoutPlan
from app.models.session import ExerciseLog, WorkoutSession

@pytest.fixture(autouse=True)
def clean_users_table():
    yield
    db = SessionLocal()
    db.query(ExerciseLog).delete()
    db.query(WorkoutSession).delete()
    db.query(WorkoutPlan).delete()
    db.query(User).delete()
    db.commit()
    db.close()
    