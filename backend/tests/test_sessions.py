from app.main import app
from fastapi.testclient import TestClient
import datetime

client = TestClient(app)

def get_token():
    client.post("/auth/register", json={"email": "sess@example.com", "password": "pass1234"})
    r = client.post("/auth/login", json={"email": "sess@example.com", "password": "pass1234"}).json()["access_token"]
    client.put("/users/me", json={"age": 25, "goal": "gain muscles", "level": "intermediate", "days_per_week": 3, "equipment": "gym", "weight_kg": 79.0}, headers={"Authorization": f"Bearer {r}"})
    return r

def test_create_session():
    token = get_token()
    r = client.post("/sessions/", headers={"Authorization": f"Bearer {token}"}, json={"session_date": str(datetime.date.today())})
    assert r.status_code == 200 and "id" in r.json()
    
def test_add_exercise_log():
    token = get_token()
    c = client.post("/sessions/", headers={"Authorization": f"Bearer {token}"}, json={"session_date": str(datetime.date.today())})
    session_id = c.json()["id"]
    r = client.post(f"/sessions/{session_id}/logs", headers={"Authorization": f"Bearer {token}"}, json={"exercise_name": "leg_curl", "sets_data": [{"weight": 80, "reps": 5}]})
    assert r.status_code == 200 and "exercise_name" in r.json()