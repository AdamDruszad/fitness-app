"""Persistence boundaries: owned proposals, immutable plans, replay and typed results."""
from copy import deepcopy
import uuid
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User
from app.models.plan import WorkoutPlan, PlanProposal
from app.models.chat import ChatMessage
from app.models.session import WorkoutSession, ExerciseLog
from app.services.auth import create_access_token
from tests.test_plans import MOCK_PLAN

client = TestClient(app)


@pytest.fixture
def owner(db):
    user = User(email="continuity@example.com", password_hash="unused", goal="strength")
    db.add(user); db.commit(); db.refresh(user)
    return user, {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def draft(headers, **kwargs):
    response = client.post("/plans/proposals", headers=headers, json={
        "request_id": str(uuid.uuid4()), "plan_data": deepcopy(MOCK_PLAN), **kwargs})
    assert response.status_code == 200, response.text
    return response.json()


def apply(headers, proposal):
    return client.post(f"/plans/proposals/{proposal['id']}/apply", headers=headers, json={
        "revision": proposal["revision"], "expected_active_id": proposal["base_plan_id"]})


def test_proposal_apply_replay_and_stale_base(owner, db):
    _, headers = owner
    first = draft(headers)
    stale = draft(headers)
    result = apply(headers, first)
    assert result.status_code == 200, result.text
    assert apply(headers, first).json()["id"] == result.json()["id"]
    assert apply(headers, stale).status_code == 409
    assert db.query(WorkoutPlan).count() == 1
    assert db.query(WorkoutPlan).filter_by(is_active=True).count() == 1
    updated = draft(headers, base_plan_id=result.json()["id"])
    second = apply(headers, updated).json()
    assert second["version"] == 2
    assert second["base_plan_id"] == result.json()["id"]
    assert db.query(WorkoutPlan).count() == 2


def test_proposal_request_collision_edit_and_favorite_constraint(owner):
    _, headers = owner
    key = str(uuid.uuid4())
    proposal = draft(headers, request_id=key, keep_exercises=["Cable Row"])
    assert draft(headers, request_id=key, keep_exercises=["Cable Row"])["id"] == proposal["id"]
    conflict = client.post("/plans/proposals", headers=headers, json={"request_id": key, "plan_data": MOCK_PLAN})
    assert conflict.status_code == 409
    assert apply(headers, proposal).status_code == 422
    edited = deepcopy(proposal["plan_data"])
    edited["days"][0]["exercises"][0]["name"] = "Cable Row"
    updated = client.put(f"/plans/proposals/{proposal['id']}", headers=headers, json={"revision": 1, "plan_data": edited}).json()
    assert apply(headers, proposal).status_code == 409
    assert apply(headers, updated).status_code == 200
    assert client.put(f"/plans/proposals/{proposal['id']}", headers=headers, json={"revision": 2, "plan_data": edited}).status_code == 409


def test_owned_sources_invalid_provider_and_chat_pagination(owner, db):
    user, headers = owner
    other = User(email="other-continuity@example.com", password_hash="unused")
    db.add(other); db.flush()
    foreign = ChatMessage(user_id=other.id, role="assistant", content="Private routine")
    db.add(foreign)
    for i in range(65):
        db.add(ChatMessage(user_id=user.id, role="assistant", content=f"Routine {i}"))
    db.commit()
    response = client.post("/plans/proposals", headers=headers, json={"request_id": str(uuid.uuid4()), "source_message_ids": [str(foreign.id)]})
    assert response.status_code == 404
    latest = client.get("/chat/", headers=headers).json()
    earlier = client.get("/chat/", params={"before": latest[0]["id"]}, headers=headers).json()
    assert len(latest) == 50 and len(earlier) == 15
    with patch("app.routers.plans.generate_proposal", return_value={"bad": "payload"}):
        response = client.post("/plans/proposals", headers=headers, json={"request_id": str(uuid.uuid4()), "source_message_ids": [earlier[0]["id"]]})
    assert response.json()["status"] == "failed"
    assert db.query(WorkoutPlan).count() == 0
    assert db.query(PlanProposal).count() == 1


def workout(headers, timed=False):
    raw = deepcopy(MOCK_PLAN)
    ex = raw["days"][0]["exercises"][0]
    ex.update(sets=3, reps="8-10", load_basis="total")
    if timed:
        ex.update(name="Plank", measurement="duration", reps=None, duration_seconds=30, load_basis="bodyweight")
    plan = apply(headers, draft(headers, plan_data=raw)).json()
    day = plan["plan_data"]["days"][0]
    return {"occurrence_id": str(uuid.uuid4()), "plan_id": plan["id"], "day_id": day["id"],
        "session_date": str(__import__("datetime").date.today()), "exercises": [{"slot_id": day["exercises"][0]["id"],
            "measurement": "duration" if timed else "reps", "sets_data": [{"duration_seconds": 30}] if timed else [{"weight": 40, "reps": 10}] * 3}]}


def test_atomic_completion_replay_conflict_and_correction(owner, db):
    _, headers = owner
    body = workout(headers)
    original = client.post("/sessions/complete", json=body, headers=headers)
    assert original.status_code == 200, original.text
    assert original.json()["status"] == "completed"
    assert client.post("/sessions/complete", json=body, headers=headers).json()["id"] == original.json()["id"]
    different = deepcopy(body); different["exercises"][0]["sets_data"][0]["reps"] = 8
    assert client.post("/sessions/complete", json=different, headers=headers).status_code == 409
    assert db.query(WorkoutSession).count() == 1
    assert db.query(ExerciseLog).count() == 1
    assert client.post(f"/sessions/{original.json()['id']}/logs", headers=headers, json={"exercise_name": "Sneaky extra", "sets_data": [{"weight": 1, "reps": 1}]}).status_code == 409
    history = client.post("/sessions/previous", headers=headers, json={"plan_id": body["plan_id"], "day_id": body["day_id"], "increments": {body["exercises"][0]["slot_id"]: 2.5}}).json()
    target = history[body["exercises"][0]["slot_id"]]["target"]
    assert target["weight"] == 42.5 and target["reps"] == 8
    correction = {"revision": 1, "logs": {original.json()["exercise_logs"][0]["id"]: [{"weight": 40, "reps": 8}] * 3}}
    fixed = client.put(f"/sessions/{original.json()['id']}/correction", headers=headers, json=correction)
    assert fixed.status_code == 200, fixed.text
    assert client.put(f"/sessions/{original.json()['id']}/correction", headers=headers, json=correction).status_code == 409
    assert client.post("/sessions/complete", json=body, headers=headers).json()["revision"] == 2
    second = deepcopy(body); second["occurrence_id"] = str(uuid.uuid4())
    assert client.post("/sessions/complete", json=second, headers=headers).status_code == 200
    assert db.query(WorkoutSession).count() == 2


def test_typed_measurements_invalid_completion_and_ownership(owner, db):
    user, headers = owner
    body = workout(headers, timed=True)
    bad = deepcopy(body); bad["exercises"][0]["sets_data"] = [{"reps": 30}]
    assert client.post("/sessions/complete", headers=headers, json=bad).status_code == 422
    assert db.query(WorkoutSession).count() == 0
    result = client.post("/sessions/complete", headers=headers, json=body)
    assert result.status_code == 200, result.text
    assert result.json()["exercise_logs"][0]["sets_data"] == [{"duration_seconds": 30}]
    other = User(email="isolated@example.com", password_hash="unused"); db.add(other); db.commit()
    other_headers = {"Authorization": f"Bearer {create_access_token(str(other.id))}"}
    assert client.post("/sessions/complete", headers=other_headers, json=body).status_code == 404
    assert client.get(f"/sessions/occurrences/{body['occurrence_id']}", headers=other_headers).status_code == 404
    assert client.get("/sessions/history", headers=other_headers).json()["items"] == []
    assert client.get("/sessions/summary", headers=headers).json()["completed"] == 1
    db.add(WorkoutSession(user_id=user.id, session_date=__import__("datetime").date.today())); db.commit()
    assert client.get("/sessions/summary", headers=headers).json()["completed"] == 1
    page = client.get("/sessions/history", params={"limit": 1}, headers=headers).json()
    assert page["next"]
    assert len(client.get("/sessions/history", params={"limit": 1, "before": page["next"]}, headers=headers).json()["items"]) == 1
    exported = client.get("/sessions/export", headers=headers).json()
    assert len(exported["sessions"]) == 2 and "chat" not in exported


def test_progression_requires_comparable_basis_and_bounded_increment():
    from datetime import date
    from app.services.progression import next_target
    ex = {"measurement": "reps", "load_basis": "total", "sets": 3, "reps": "8-10"}
    previous = {"session_id": "source", "date": str(date.today()), "sets": [{"weight": 40, "reps": 10}] * 3, "prescription": ex}
    assert next_target(ex, previous, 2.5)["weight"] == 42.5
    assert next_target(ex, previous, 20)["weight"] == 40
    assert next_target({**ex, "load_basis": "assistance"}, previous, 2.5)["weight"] == 40
    assert next_target(ex, {**previous, "notes": "Too difficult"}, 2.5)["weight"] == 40
    assert next_target(ex, {**previous, "date": "2020-01-01"}, 2.5)["weight"] == 40
    assert "weight" not in next_target(ex, None, 2.5)


def test_started_workout_keeps_old_plan_after_new_activation(owner):
    _, headers = owner
    body = workout(headers)
    modified = deepcopy(MOCK_PLAN)
    modified["days"][0]["exercises"][0]["name"] = "Cable row"
    newer = apply(headers, draft(headers, base_plan_id=body["plan_id"], plan_data=modified))
    assert newer.status_code == 200
    saved = client.post("/sessions/complete", headers=headers, json=body).json()
    assert saved["plan_id"] == body["plan_id"]
    assert saved["workout_snapshot"]["day"]["exercises"][0]["name"] == "Bench Press"
    assert saved["exercise_logs"][0]["exercise_name"] == "Bench Press"


def test_nullable_legacy_logs_remain_readable_without_invented_results(owner, db):
    from datetime import date
    user, headers = owner
    row = WorkoutSession(user_id=user.id, session_date=date.today(), exercise_logs=[ExerciseLog(exercise_name=None, sets_data=None)])
    db.add(row); db.commit()
    response = client.get(f"/sessions/{row.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "legacy"
    assert response.json()["exercise_logs"][0]["sets_data"] is None
    assert client.get("/sessions/export", headers=headers).json()["sessions"][0]["exercise_logs"][0]["exercise_name"] is None
    assert client.get("/sessions/summary", headers=headers).json()["completed"] == 0
