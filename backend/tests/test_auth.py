from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_register_success():
    r = client.post("/auth/register", json={"email": "reg@example.com", "password": "pass1234"})
    assert r.status_code == 200
    assert "access_token" in r.json()
    
def test_register_duplicate_email():
    client.post("/auth/register", json={"email": "dup@example.com", "password": "pass1234"})
    r = client.post("/auth/register", json={"email": "dup@example.com", "password": "pass1234"})
    assert r.status_code == 400
    
def test_login_success():
    client.post("/auth/register", json={"email": "log@example.com", "password": "pass1234"})
    r = client.post("/auth/login", json={"email": "log@example.com", "password": "pass1234"})
    assert r.status_code == 200
    assert "access_token" in r.json()
    
def test_login_wrong_password():
    client.post("/auth/register", json={"email": "wpass@example.com", "password": "pass1234"})
    r = client.post("/auth/login", json={"email": "wpass@example.com", "password": "pass4564"})
    assert r.status_code == 401
    