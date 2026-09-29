"""
Workout Sessions and Exercise Logs Integration Tests.

Validates creating workout sessions and adding exercise set logs.
"""

import datetime
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_token() -> str:
    """Helper fixture function registering and setting up a user profile to get a valid JWT."""
    client.post("/auth/register", json={"email": "sess@example.com", "password": "pass1234"})
    token = client.post("/auth/login", json={"email": "sess@example.com", "password": "pass1234"}).json()["access_token"]
    client.put(
        "/users/me",
        json={
            "age": 25,
            "goal": "gain muscles",
            "level": "intermediate",
            "days_per_week": 3,
            "equipment": "gym",
            "weight_kg": 79.0
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    return token


def test_create_session():
    """Test creating a new workout session record returns status 200 with session ID."""
    token = get_token()
    response = client.post(
        "/sessions/",
        headers={"Authorization": f"Bearer {token}"},
        json={"session_date": str(datetime.date.today())}
    )
    assert response.status_code == 200
    assert "id" in response.json()


def test_add_exercise_log():
    """Test adding sets to a session returns status 200 with saved exercise data."""
    token = get_token()
    create_res = client.post(
        "/sessions/",
        headers={"Authorization": f"Bearer {token}"},
        json={"session_date": str(datetime.date.today())}
    )
    session_id = create_res.json()["id"]
    response = client.post(
        f"/sessions/{session_id}/logs",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "exercise_name": "leg_curl",
            "sets_data": [{"weight": 80, "reps": 5}]
        }
    )
    assert response.status_code == 200
    assert "exercise_name" in response.json()