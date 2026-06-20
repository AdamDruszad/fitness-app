import pytest
from app.database import SessionLocal
from app.models.user import User

@pytest.fixture(autouse=True)
def clean_users_table():
    yield
    db = SessionLocal()
    db.query(User).delete()
    db.commit()
    db.close()
    