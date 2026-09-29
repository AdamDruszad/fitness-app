"""
Workout Plans Endpoint Integration Tests.

Validates AI plan generation with mocked LLM service and active plan retrieval.
"""

from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

MOCK_PLAN = {
    "weeks": 8,
    "days": [
        {
            "day": "Monday",
            "focus": "Push",
            "exercises": [
                {"name": "Bench Press", "sets": 4, "reps": "6-8", "rest_seconds": 120}
            ]
        }
    ]
}


def get_token() -> str:
    """Helper fixture function registering and setting up a user profile to get a valid JWT."""
    client.post("/auth/register", json={"email": "plan@example.com", "password": "pass1234"})
    token = client.post("/auth/login", json={"email": "plan@example.com", "password": "pass1234"}).json()["access_token"]
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


def test_generate_plan():
    """Test generating a workout plan with mocked AI service returns status 200."""
    with patch("app.routers.plans.generate_plan", return_value=MOCK_PLAN):
        response = client.post("/plans/generate", headers={"Authorization": f"Bearer {get_token()}"})
        assert response.status_code == 200


def test_get_current_plan():
    """Test retrieving current active plan after generation returns status 200."""
    token = get_token()
    with patch("app.routers.plans.generate_plan", return_value=MOCK_PLAN):
        client.post("/plans/generate", headers={"Authorization": f"Bearer {token}"})
    response = client.get("/plans/current", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200