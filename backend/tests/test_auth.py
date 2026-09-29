"""
Authentication Endpoint Integration Tests.

Validates user registration, duplicate email handling, login authentication,
and invalid password rejection.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_register_success():
    """Test successful user registration returns status 200 and access_token."""
    response = client.post("/auth/register", json={"email": "reg@example.com", "password": "pass1234"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_register_duplicate_email():
    """Test registering an existing email returns status 400 Bad Request."""
    client.post("/auth/register", json={"email": "dup@example.com", "password": "pass1234"})
    response = client.post("/auth/register", json={"email": "dup@example.com", "password": "pass1234"})
    assert response.status_code == 400


def test_login_success():
    """Test logging in with valid credentials returns status 200 and access_token."""
    client.post("/auth/register", json={"email": "log@example.com", "password": "pass1234"})
    response = client.post("/auth/login", json={"email": "log@example.com", "password": "pass1234"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password():
    """Test logging in with incorrect password returns status 401 Unauthorized."""
    client.post("/auth/register", json={"email": "wpass@example.com", "password": "pass1234"})
    response = client.post("/auth/login", json={"email": "wpass@example.com", "password": "pass4564"})
    assert response.status_code == 401