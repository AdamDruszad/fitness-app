"""Migration/concurrency check against an explicitly disposable localhost cluster.

FITAI_TEST_POSTGRES_URL must point at postgres on 127.0.0.1:55439.
Creates and drops only its own randomly named database. Never reads the app .env DB.
Run from backend: python scripts/check_postgres.py
"""
import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
raw = os.environ.get("FITAI_TEST_POSTGRES_URL")
if not raw:
    raise SystemExit("Set FITAI_TEST_POSTGRES_URL for a disposable local cluster first")
url = make_url(raw)
if url.host != "127.0.0.1" or url.port != 55439 or url.database != "postgres":
    raise SystemExit("This check only accepts the isolated 127.0.0.1:55439/postgres test cluster")
name = "fitai_check_" + uuid.uuid4().hex
admin = create_engine(url, isolation_level="AUTOCOMMIT")
with admin.connect() as connection:
    connection.execute(text(f'CREATE DATABASE "{name}"'))
test_url = url.set(database=name).render_as_string(hide_password=False)
os.environ.update(DATABASE_URL=test_url, SECRET_KEY="isolated-postgres-check-never-production-123456789",
                  ANTHROPIC_API_KEY="fake-test-provider")

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.autogenerate import compare_metadata
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException
from app.database import Base, engine as app_engine
from app.models.user import User
from app.models.plan import WorkoutPlan, PlanProposal
from app.models.session import WorkoutSession, ExerciseLog
from app.schemas.plan import ProposalApply
from app.schemas.session import CompleteSession, CorrectSession
from app.services.plans import validated_plan, plan_response
from app.routers.plans import apply_proposal
from app.routers.training import complete, correct

config = Config(str(root / "alembic.ini"))
config.set_main_option("script_location", str(root / "alembic"))
engine = create_engine(test_url)
Sessions = sessionmaker(bind=engine, autoflush=False)
user_id, old_id, newer_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
raw_plan = {"weeks": 8, "days": [{"day": "Workout A", "focus": "Strength", "exercises": [
    {"name": "Bench press", "sets": 3, "reps": "8-10", "rest_seconds": 90, "load_basis": "total"}]}]}

def concurrent(call):
    def worker(_):
        with Sessions() as db:
            user = db.get(User, user_id)
            try:
                result = call(user, db)
                return str(result["id"] if isinstance(result, dict) else result.id)
            except HTTPException as e:
                db.rollback()
                return e.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(worker, range(2)))

try:
    command.upgrade(config, "ed2fe05e9dea")
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO users(id,email,password_hash) VALUES(:id,'postgres-check@example.com','unused')"), {"id": user_id})
        import json
        for pid, stamp in ((old_id, "2025-01-01"), (newer_id, "2025-02-01")):
            conn.execute(text("INSERT INTO workout_plans(id,user_id,plan_data,is_active,created_at) VALUES(:id,:user,CAST(:plan AS jsonb),true,:stamp)"), {"id": pid, "user": user_id, "plan": json.dumps(raw_plan), "stamp": stamp})
    command.upgrade(config, "head")
    with engine.connect() as conn:
        drift = compare_metadata(MigrationContext.configure(conn), Base.metadata)
        assert not drift, drift
    with Sessions() as db:
        assert db.query(WorkoutPlan).count() == 2
        assert db.query(WorkoutPlan).filter_by(is_active=True).one().id == newer_id
        assert db.get(WorkoutPlan, old_id).plan_data == raw_plan
        proposal = PlanProposal(user_id=user_id, request_id=uuid.uuid4(), request_hash="a" * 64,
            base_plan_id=newer_id, status="ready", revision=1, source_message_ids=[], instructions="", keep_exercises=[],
            plan_data=validated_plan(raw_plan, user_id, uuid.uuid4()))
        db.add(proposal); db.commit(); proposal_id = proposal.id
    applied = concurrent(lambda user, db: apply_proposal(proposal_id, ProposalApply(revision=1, expected_active_id=newer_id), user, db))
    assert applied[0] == applied[1] and isinstance(applied[0], str), applied
    with Sessions() as db:
        active = db.query(WorkoutPlan).filter_by(is_active=True).one()
        active_id = active.id
        day = plan_response(active)["plan_data"]["days"][0]
        assert active.version == 3
    payload = CompleteSession(occurrence_id=uuid.uuid4(), plan_id=active_id, day_id=day["id"], session_date="2026-10-09",
        exercises=[{"slot_id": day["exercises"][0]["id"], "measurement": "reps", "sets_data": [{"weight": 40, "reps": 10}]}])
    completed = concurrent(lambda user, db: complete(payload, user, db))
    assert completed[0] == completed[1] and isinstance(completed[0], str), completed
    with Sessions() as db:
        assert db.query(WorkoutSession).count() == 1
        assert db.query(ExerciseLog).count() == 1
        row = db.query(WorkoutSession).one()
        session_id, log_id = row.id, row.exercise_logs[0].id
    correction = CorrectSession(revision=1, logs={log_id: [{"weight": 40, "reps": 9}]})
    corrected = concurrent(lambda user, db: correct(session_id, correction, user, db))
    assert corrected.count(409) == 1, corrected
    # Two different activation requests based on one version: exactly one wins.
    with Sessions() as db:
        candidates = []
        for _ in range(2):
            p = PlanProposal(user_id=user_id, request_id=uuid.uuid4(), request_hash="b" * 64,
                base_plan_id=active_id, status="ready", revision=1, source_message_ids=[], instructions="", keep_exercises=[],
                plan_data=validated_plan(raw_plan, user_id, uuid.uuid4()))
            db.add(p); db.flush(); candidates.append(p.id)
        db.commit()
    def competing(pid):
        with Sessions() as db:
            try: return str(apply_proposal(pid, ProposalApply(revision=1, expected_active_id=active_id), db.get(User, user_id), db)["id"])
            except HTTPException as e: db.rollback(); return e.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(competing, candidates))
    assert outcomes.count(409) == 1, outcomes
    with Sessions() as db:
        assert db.query(WorkoutPlan).filter_by(is_active=True).count() == 1
        assert db.get(WorkoutSession, session_id).plan_id == active_id
    print("PASS: PostgreSQL legacy migration, no schema drift, concurrent proposal replay, competing activation, atomic completion replay, correction conflict, and immutable session-plan linkage.")
finally:
    engine.dispose(); app_engine.dispose()
    with admin.connect() as connection:
        connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
    admin.dispose()
