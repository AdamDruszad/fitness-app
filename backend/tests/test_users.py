"""
User Profile Endpoint Integration Tests.

Validates unauthenticated profile rejection, authenticated profile retrieval,
and updating fitness profile biometrics.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def get_token() -> str:
    """Helper function to register and authenticate a test user, returning access token."""
    client.post("/auth/register", json={"email": "profile@example.com", "password": "pass1234"})
    response = client.post("/auth/login", json={"email": "profile@example.com", "password": "pass1234"})
    return response.json()["access_token"]


def test_get_profile_unauthenticated():
    """Test accessing /users/me without Bearer token returns 401 Unauthorized."""
    assert client.get("/users/me").status_code == 401


def test_get_profile_authenticated():
    """Test accessing /users/me with valid Bearer token returns 200 and user email."""
    response = client.get("/users/me", headers={"Authorization": f"Bearer {get_token()}"})
    assert response.status_code == 200
    assert "email" in response.json()


def test_update_profile():
    """Test updating user profile metrics returns updated values."""
    response = client.put(
        "/users/me",
        json={
            "age": 25,
            "goal": "muscle_gain",
            "level": "intermediate",
            "days_per_week": 3,
            "equipment": "gym",
            "weight_kg": 79.0
        },
        headers={"Authorization": f"Bearer {get_token()}"}
    )
    assert response.status_code == 200
    assert response.json()["age"] == 25
