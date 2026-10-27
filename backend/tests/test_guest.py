"""
Demo Guest Session Integration Tests.

Validates that POST /auth/guest creates an isolated, ready-to-explore account
with a sample profile, plan and workout history.
"""

from datetime import date
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import GUEST_EMAIL_DOMAIN
from app.services.demo import sample_schedule, sample_sets

client = TestClient(app)


def start_guest() -> dict:
    """Open a demo session and return its Authorization header."""
    response = client.post("/auth/guest")
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_guest_gets_profile_plan_and_history():
    """A guest lands on a complete profile, an active sample plan and five logged workouts."""
    headers = start_guest()
    me = client.get("/users/me", headers=headers).json()
    assert me["is_guest"] is True
    assert me["email"].endswith("@" + GUEST_EMAIL_DOMAIN)
    assert me["goal"] == "muscle_gain"  # A set goal skips onboarding

    plan = client.get("/plans/current", headers=headers).json()
    assert plan["source"] == "sample"
    assert [day["day"] for day in plan["plan_data"]["days"]] == ["Monday", "Wednesday", "Friday"]

    history = client.get("/sessions/history", headers=headers).json()["items"]
    assert len(history) == 5
    dates = [item["session_date"] for item in history]
    assert dates == sorted(dates, reverse=True)
    assert all(item["status"] == "completed" and item["plan_id"] == plan["id"] for item in history)
    assert client.get("/sessions/summary", headers=headers).json()["completed"] == 5


def test_guest_history_feeds_next_targets():
    """Seeded logs share exercise IDs with the plan, so the logger can suggest targets."""
    headers = start_guest()
    plan = client.get("/plans/current", headers=headers).json()
    monday = plan["plan_data"]["days"][0]
    targets = client.post("/sessions/previous", headers=headers,
                          json={"plan_id": plan["id"], "day_id": monday["id"]}).json()
    squat = next(e for e in monday["exercises"] if e["name"] == "Back squat")
    history = client.get("/sessions/history", headers=headers).json()["items"]
    latest_monday = next(s for s in history if s["day_id"] == monday["id"])
    logged = next(log for log in latest_monday["exercise_logs"] if log["slot_id"] == squat["id"])
    assert targets[squat["id"]]["previous"]["sets"] == logged["sets_data"]


def test_sample_workouts_fall_on_their_plan_weekdays():
    """From a Tuesday, the five sessions run Fri, Mon, Wed, Fri, Mon; repeats add load."""
    schedule = sample_schedule(date(2026, 10, 27))
    assert [(d.isoformat(), index) for d, index in schedule] == [
        ("2026-10-16", 2), ("2026-10-19", 0), ("2026-10-21", 1), ("2026-10-23", 2), ("2026-10-26", 0)]
    squat = {"measurement": "reps", "reps": "6–8", "sets": 3, "load_basis": "total", "target_weight": 60}
    assert sample_sets(squat, 0) == [{"weight": 60, "reps": 7}, {"weight": 60, "reps": 6}, {"weight": 60, "reps": 6}]
    assert sample_sets(squat, 1)[0] == {"weight": 62.5, "reps": 6}


def test_guest_accounts_are_isolated():
    """Changes in one demo account never reach another."""
    first, second = start_guest(), start_guest()
    assert client.get("/users/me", headers=first).json()["id"] != client.get("/users/me", headers=second).json()["id"]
    client.put("/users/me", headers=first, json={"weight_kg": 90})
    assert client.get("/users/me", headers=second).json()["weight_kg"] == 72.0


def test_guest_sessions_are_rate_limited():
    """Each client address may open five demo accounts per window."""
    for _ in range(5):
        assert client.post("/auth/guest").status_code == 200
    assert client.post("/auth/guest").status_code == 429


def test_registration_rejects_demo_domain():
    """Real accounts cannot claim the address space reserved for guests."""
    response = client.post("/auth/register", json={"email": f"me@{GUEST_EMAIL_DOMAIN}", "password": "pass1234"})
    assert response.status_code == 400


def test_registered_user_is_not_guest():
    """Ordinary accounts report is_guest as false."""
    token = client.post("/auth/register", json={"email": "real@example.com", "password": "pass1234"}).json()["access_token"]
    assert client.get("/users/me", headers={"Authorization": f"Bearer {token}"}).json()["is_guest"] is False
