from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

MOCK_PLAN = {"weeks": 8, "days": [{"day": "Monday", "focus": "Push",
    "exercises": [{"name": "Bench Press", "sets": 4, "reps": "6-8", "rest_seconds": 120}]}]}

def get_token():
    client.post("/auth/register", json={"email": "plan@example.com", "password": "pass123"})
    r = client.post("/auth/login", json={"email": "plan@example.com", "password": "pass123"}).json()["access_token"]
    client.put("/users/me", json={"age": 25, "goal": "gain muscles", "level": "intermediate", "days_per_week": 3, "equipment": "gym", "weight_kg": 79.0}, headers={"Authorization": f"Bearer {r}"})
    return r

def test_generate_plan():
    with patch("app.routers.plans.generate_plan", return_value=MOCK_PLAN):
        r = client.post("/plans/generate", headers={"Authorization": f"Bearer {get_token()}"})
        assert r.status_code == 200
        
def test_get_current_plan():
    token = get_token()
    with patch("app.routers.plans.generate_plan", return_value=MOCK_PLAN):
        client.post("/plans/generate", headers={"Authorization": f"Bearer {token}"})
    r = client.get("/plans/current", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200