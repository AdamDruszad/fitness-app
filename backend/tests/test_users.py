from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def get_token():
    client.post("/auth/register", json={"email": "profile@example.com", "password": "pass1234"})
    return client.post("/auth/login", json={"email": "profile@example.com", "password": "pass1234"}).json()["access_token"]

def test_get_profile_unauthenticated():
    assert client.get("/users/me").status_code == 401
    
def test_get_profile_authenticated():
    r = client.get("/users/me", headers={"Authorization": f"Bearer {get_token()}"})
    assert r.status_code == 200 and "email" in r.json()
    
def test_update_profile():
    r = client.put("/users/me", json={"age": 25, "goal": "gain muscles", "level": "intermediate", "days_per_week": 3, "equipment": "gym", "weight_kg": 79.0}, headers={"Authorization": f"Bearer {get_token()}"})
    assert r.json()["age"] == 25