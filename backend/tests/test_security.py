"""Negative authorization, input, configuration, and failure-path regressions."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from jose import jwt
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.config import Settings, settings
from app.main import app
from app.models.chat import ChatMessage
from app.models.plan import WorkoutPlan
from app.models.session import ExerciseLog, WorkoutSession
from app.models.user import User
from app.routers.auth import register
from app.ratelimit import client_key
from app.schemas.user import UserRegister
from app.services.auth import create_access_token
from app.services.ai import build_coach_system_prompt
from tests.test_plans import MOCK_PLAN

client = TestClient(app)


@pytest.fixture
def accounts(db):
    first = User(email="first@example.com", password_hash="unused", goal="strength")
    second = User(email="second@example.com", password_hash="unused", goal="general")
    db.add_all([first, second])
    db.commit()
    return first, second


def headers(user):
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def make_token(claims, key=None, algorithm="HS256"):
    return jwt.encode(claims, key or settings.secret_key.get_secret_value(), algorithm=algorithm)


@pytest.mark.parametrize("case", ["expired", "no-exp", "no-sub", "bad-sub", "wrong-signature", "wrong-algorithm", "malformed"])
def test_invalid_tokens_are_unauthorized(accounts, case):
    claims = {"sub": str(accounts[0].id), "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    if case == "expired": claims["exp"] = datetime.now(timezone.utc) - timedelta(minutes=1)
    if case == "no-exp": claims.pop("exp")
    if case == "no-sub": claims.pop("sub")
    if case == "bad-sub": claims["sub"] = "not-a-uuid"
    token = make_token(claims, key="another-test-only-signing-key-123456789" if case == "wrong-signature" else None,
                       algorithm="HS512" if case == "wrong-algorithm" else "HS256")
    if case == "malformed": token = "not-a-token"
    response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("method,path,body", [
    ("GET", "/users/me", None), ("PUT", "/users/me", {"age": 30}),
    ("GET", "/sessions/", None), ("POST", "/sessions/", {"session_date": "2026-01-01"}),
    ("GET", "/plans/current", None), ("POST", "/plans/generate", None),
    ("GET", "/plans/", None), ("GET", "/chat/", None),
    ("POST", "/chat/", {"content": "Hello"}),
    ("GET", "/progress/exercise/Squat", None), ("GET", "/progress/suggestions", None),
])
def test_private_routes_require_authentication(method, path, body):
    assert client.request(method, path, json=body).status_code == 401


def test_deleted_user_token_is_rejected():
    response = client.get("/users/me", headers={"Authorization": f"Bearer {create_access_token(str(uuid.uuid4()))}"})
    assert response.status_code == 401


def test_accounts_cannot_read_or_write_each_others_data(accounts, db):
    first, second = accounts
    session = WorkoutSession(user_id=first.id, session_date=datetime(2026, 1, 1).date())
    db.add(session)
    db.flush()
    db.add(ExerciseLog(session_id=session.id, exercise_name="ALICE_ONLY", sets_data=[{"weight": 20, "reps": 8}]))
    db.add(ChatMessage(user_id=first.id, role="user", content="ALICE_ONLY"))
    db.add(WorkoutPlan(user_id=first.id, plan_data=MOCK_PLAN, is_active=True))
    db.commit()
    auth = headers(second)
    assert client.get(f"/sessions/{session.id}", headers=auth).status_code == 404
    assert client.post(f"/sessions/{session.id}/logs", headers=auth, json={"exercise_name": "Squat", "sets_data": [{"weight": 10, "reps": 8}]}).status_code == 404
    for path in ["/sessions/", "/chat/", "/plans/", "/progress/exercise/ALICE_ONLY"]:
        assert client.get(path, headers=auth).json() == []
    assert client.get("/plans/current", headers=auth).status_code == 404
    assert "ALICE_ONLY" not in build_coach_system_prompt(second, db)
    response = client.put("/users/me", headers=auth, json={"id": str(first.id), "email": first.email, "age": 31})
    assert response.status_code == 200
    assert response.json()["id"] == str(second.id)
    assert response.json()["email"] == second.email
    db.refresh(first)
    assert first.age is None


@pytest.mark.parametrize("body", [
    {"goal": "arbitrary-goal"}, {"level": "invented"}, {"equipment": "invented"}, {"gender": "invented"},
    {"age": 9}, {"days_per_week": 8}, {"weight_kg": "Infinity"}, {"weight_kg": "NaN"},
    {"injuries": "x" * 2001},
])
def test_invalid_profile_fields_are_rejected(accounts, body):
    assert client.put("/users/me", headers=headers(accounts[0]), json=body).status_code == 422


@pytest.mark.parametrize("body", [
    {"exercise_name": "  ", "sets_data": [{"weight": 0, "reps": 1}]},
    {"exercise_name": "Squat", "sets_data": []},
    {"exercise_name": "Squat", "sets_data": [{"weight": -1, "reps": 1}]},
    {"exercise_name": "Squat", "sets_data": [{"weight": "NaN", "reps": 1}]},
    {"exercise_name": "Squat", "sets_data": [{"weight": 0, "reps": 0}]},
    {"exercise_name": "Squat", "sets_data": [{"weight": 0, "reps": 1.5}]},
    {"exercise_name": "Squat", "sets_data": [{"weight": 0, "reps": True}]},
    {"exercise_name": "Squat", "sets_data": [{"weight": 0, "reps": 1}] * 101},
])
def test_invalid_workout_logs_are_rejected(accounts, body):
    auth = headers(accounts[0])
    session = client.post("/sessions/", headers=auth, json={"session_date": "2026-01-01"}).json()
    assert client.post(f"/sessions/{session['id']}/logs", headers=auth, json=body).status_code == 422
    assert client.get(f"/sessions/{session['id']}", headers=auth).json()["exercise_logs"] == []


@pytest.mark.parametrize("content", ["   ", "x" * 4001])
def test_invalid_chat_never_reaches_ai(accounts, content):
    with patch("app.routers.chat.stream_chat") as stream:
        assert client.post("/chat/", headers=headers(accounts[0]), json={"content": content}).status_code == 422
        stream.assert_not_called()


def test_login_password_is_bounded():
    assert client.post("/auth/login", json={"email": "someone@example.com", "password": "x" * 129}).status_code == 422


def old_plan(user, db):
    plan = WorkoutPlan(user_id=user.id, plan_data=deepcopy(MOCK_PLAN), is_active=True, created_at=datetime(2020, 1, 1, tzinfo=timezone.utc))
    db.add(plan)
    db.commit()
    return plan


@pytest.mark.parametrize("bad_plan", [{}, {"weeks": 8, "days": []}, {"weeks": 8, "days": [MOCK_PLAN["days"][0]] * 2}])
def test_malformed_generated_plan_keeps_previous_plan(accounts, db, bad_plan):
    previous = old_plan(accounts[0], db)
    with patch("app.routers.plans.generate_plan", return_value=bad_plan):
        response = client.post("/plans/generate", headers=headers(accounts[0]))
    assert response.status_code == 503
    assert client.get("/plans/current", headers=headers(accounts[0])).json()["id"] == str(previous.id)
    assert db.query(WorkoutPlan).count() == 1


def test_failed_generation_does_not_log_provider_details(accounts, db, caplog):
    previous = old_plan(accounts[0], db)
    with patch("app.routers.plans.generate_plan", side_effect=RuntimeError("PRIVATE_PROVIDER_DETAIL")):
        response = client.post("/plans/generate", headers=headers(accounts[0]))
    assert response.status_code == 503
    assert "PRIVATE_PROVIDER_DETAIL" not in response.text + caplog.text
    assert client.get("/plans/current", headers=headers(accounts[0])).json()["id"] == str(previous.id)


def test_plan_replacement_is_atomic_and_cooldown_skips_provider(accounts, db):
    old_plan(accounts[0], db)
    with patch("app.routers.plans.generate_plan", return_value=MOCK_PLAN) as generate:
        auth = headers(accounts[0])
        assert client.post("/plans/generate", headers=auth).status_code == 200
        assert client.post("/plans/generate", headers=auth).status_code == 429
        assert generate.call_count == 1
    assert db.query(WorkoutPlan).filter(WorkoutPlan.is_active.is_(True)).count() == 1
    assert db.query(WorkoutPlan).count() == 2


def test_successful_chat_stream_persists_response(accounts):
    with patch("app.routers.chat.stream_chat", return_value=iter(["Hello", " there"])):
        response = client.post("/chat/", headers=headers(accounts[0]), json={"content": "Hi"})
    assert response.status_code == 200
    assert "event: done" in response.text
    assert response.headers["cache-control"] == "no-store"
    history = client.get("/chat/", headers=headers(accounts[0])).json()
    assert [(row["role"], row["content"]) for row in history] == [("user", "Hi"), ("assistant", "Hello there")]


def test_interrupted_chat_has_safe_error_and_no_false_complete_reply(accounts, caplog):
    def broken_stream(*_args):
        yield "Partial reply"
        raise RuntimeError("PRIVATE_PROVIDER_DETAIL")
    with patch("app.routers.chat.stream_chat", side_effect=broken_stream):
        response = client.post("/chat/", headers=headers(accounts[0]), json={"content": "Hi"})
    assert "event: error\ndata: {\"message\":" in response.text
    assert "event: done" not in response.text
    assert "PRIVATE_PROVIDER_DETAIL" not in response.text + caplog.text
    history = client.get("/chat/", headers=headers(accounts[0])).json()
    assert [row["role"] for row in history] == ["user"]


def test_registration_race_returns_duplicate_response_after_rollback():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [None, User(email="same@example.com")]
    db.commit.side_effect = IntegrityError("duplicate", {}, Exception("constraint"))
    with pytest.raises(HTTPException) as raised:
        register(UserRegister(email="same@example.com", password="password123"), db)
    assert raised.value.status_code == 400
    db.rollback.assert_called_once()


def test_cors_trusts_only_explicit_origins():
    def preflight(origin):
        return client.options("/users/me", headers={"Origin": origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"})
    approved = preflight("https://fitness-app-two-tawny.vercel.app")
    assert approved.status_code == 200
    assert approved.headers["access-control-allow-origin"] == "https://fitness-app-two-tawny.vercel.app"
    for origin in ["https://untrusted-project.vercel.app", "https://fitness-app-two-tawny.vercel.app.evil.example"]:
        assert "access-control-allow-origin" not in preflight(origin).headers


def test_config_rejects_weak_keys_and_hides_values():
    assert "test-only-signing-key" not in repr(settings)
    assert "test-only-api-key" not in settings.model_dump_json()
    with pytest.raises(ValidationError) as raised:
        Settings(_env_file=None, secret_key="weak-secret")
    assert "weak-secret" not in str(raised.value)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, algorithm="none")
    with pytest.raises(ValidationError):
        Settings(_env_file=None, access_token_expire_minutes=0)


def test_login_attempts_are_rate_limited_per_client():
    attempt = {"email": "victim@example.com", "password": "wrong-pass"}
    for _ in range(10):
        assert client.post("/auth/login", json=attempt).status_code == 401
    # The eleventh attempt inside the window is refused before credentials are checked.
    assert client.post("/auth/login", json=attempt).status_code == 429
    # A genuinely different client address keeps its own budget...
    assert client.post("/auth/login", json=attempt, headers={"X-Forwarded-For": "203.0.113.9"}).status_code == 401


def test_rate_limit_key_uses_the_proxy_appended_address():
    class Peer:
        host = "10.0.0.5"

    class FakeRequest:
        client = Peer()
        headers = {"x-forwarded-for": " 1.2.3.4 , 203.0.113.9 "}

    # Only the rightmost entry (appended by the trusted proxy) is used, so a
    # client-supplied forwarded address cannot reset its own counter.
    assert client_key(FakeRequest()) == "203.0.113.9"
    FakeRequest.headers = {}
    assert client_key(FakeRequest()) == "10.0.0.5"
    FakeRequest.headers = {"x-forwarded-for": "  ,  "}
    assert client_key(FakeRequest()) == "unknown"


def test_registration_is_rate_limited_per_client():
    for index in range(5):
        payload = {"email": f"farm{index}@example.com", "password": "pass1234"}
        assert client.post("/auth/register", json=payload).status_code == 200
    payload = {"email": "farm5@example.com", "password": "pass1234"}
    assert client.post("/auth/register", json=payload).status_code == 429
    assert client.post("/auth/register", json=payload, headers={"X-Forwarded-For": "203.0.113.10"}).status_code == 200


def test_suggestions_are_generated_once_per_user_window(accounts):
    with patch("app.routers.progress.get_progressive_overload_suggestions",
               return_value=[{"exercise": "Squat", "suggestion": "Add 2.5 kg"}]) as generate:
        first = client.get("/progress/suggestions", headers=headers(accounts[0]))
        second = client.get("/progress/suggestions", headers=headers(accounts[0]))
        other_user = client.get("/progress/suggestions", headers=headers(accounts[1]))
    assert first.status_code == second.status_code == other_user.status_code == 200
    # One generation for the first account, one separate one for the second.
    assert generate.call_count == 2
    assert first.json() == second.json() == {"suggestions": [{"exercise": "Squat", "suggestion": "Add 2.5 kg"}]}
    assert generate.call_args_list[0].args[0].id == accounts[0].id
    assert generate.call_args_list[1].args[0].id == accounts[1].id


def test_failed_suggestions_are_retried_instead_of_cached(accounts):
    with patch("app.routers.progress.get_progressive_overload_suggestions",
               side_effect=RuntimeError("PRIVATE_PROVIDER_DETAIL")) as generate:
        assert client.get("/progress/suggestions", headers=headers(accounts[0])).json() == {"suggestions": []}
        assert client.get("/progress/suggestions", headers=headers(accounts[0])).json() == {"suggestions": []}
    assert generate.call_count == 2
