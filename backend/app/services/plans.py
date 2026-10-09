"""One compatibility adapter and activation boundary for every plan writer."""
from copy import deepcopy
import hashlib
import json
import re
import uuid
from fastapi import HTTPException
from sqlalchemy import func
from app.models.user import User
from app.models.plan import WorkoutPlan
from app.schemas.plan import GeneratedPlan


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()


def lock_user(db, user_id):
    db.query(User).filter(User.id == user_id).with_for_update().populate_existing().one()


def active_plan(db, user_id):
    return db.query(WorkoutPlan).filter(WorkoutPlan.user_id == user_id, WorkoutPlan.is_active.is_(True)).first()


def exercise_identity(user_id, name, measurement="reps", load_basis="unspecified"):
    # Intentionally conservative: no fuzzy aliases or cross-equipment merging.
    key = "|".join([" ".join(name.strip().casefold().split()), measurement, load_basis])
    return str(uuid.uuid5(uuid.UUID(str(user_id)), key))


def normalize_plan(raw, user_id, seed):
    """Stable IDs for old JSON without rewriting its historical representation."""
    data = deepcopy(raw)
    namespace = uuid.UUID(str(seed))
    for i, day in enumerate(data.get("days", [])):
        day["id"] = day.get("id") or str(uuid.uuid5(namespace, f"day:{i}"))
        for j, exercise in enumerate(day.get("exercises", [])):
            exercise["name"] = exercise.get("name") or exercise.get("exercise", "Unnamed exercise")
            exercise["id"] = exercise.get("id") or str(uuid.uuid5(namespace, f"slot:{i}:{j}"))
            if "measurement" not in exercise:
                prescription = str(exercise.get("reps", ""))
                timed = re.fullmatch(r"(\d+)\s*(?:s|sec|seconds)", prescription, re.I)
                if timed:
                    exercise.update(measurement="duration", duration_seconds=int(timed[1]), reps=None)
                else:
                    exercise["measurement"] = "reps" if re.fullmatch(r"\d+(?:\s*[-–]\s*\d+)?", prescription) else "legacy"
            exercise.setdefault("load_basis", "unspecified")
            exercise["exercise_id"] = exercise_identity(user_id, exercise["name"], exercise["measurement"], exercise["load_basis"])
            exercise.setdefault("notes", "")
    data.setdefault("title", "My training plan")
    data["schema_version"] = 2
    return data


def validated_plan(raw, user_id, seed):
    data = normalize_plan(GeneratedPlan.model_validate(raw).model_dump(), user_id, seed)
    day_ids = [day["id"] for day in data["days"]]
    slots = [e["id"] for d in data["days"] for e in d["exercises"]]
    if len(day_ids) != len(set(day_ids)) or len(slots) != len(set(slots)):
        raise ValueError("Workout and exercise slots must have unique IDs")
    return data


def plan_response(plan):
    return dict(id=plan.id, plan_data=normalize_plan(plan.plan_data, plan.user_id, plan.id),
                is_active=plan.is_active, created_at=plan.created_at, version=plan.version,
                source=plan.source, base_plan_id=plan.base_plan_id, lineage_id=plan.lineage_id)


def activate(db, user_id, raw, expected_id, source="coach"):
    """Caller commits; serializes against onboarding, restore, and other proposals."""
    lock_user(db, user_id)
    current = active_plan(db, user_id)
    if (current.id if current else None) != expected_id:
        raise HTTPException(409, "Your active plan changed. Review a new draft against the current plan.")
    plan_id = uuid.uuid4()
    data = validated_plan(raw, user_id, plan_id)
    version = (db.query(func.max(WorkoutPlan.version)).filter(WorkoutPlan.user_id == user_id).scalar() or 0) + 1
    if current:
        current.is_active = False
        db.flush()  # Release the unique active slot before inserting its successor.
    plan = WorkoutPlan(id=plan_id, user_id=user_id, plan_data=data, is_active=True,
                       version=version, base_plan_id=expected_id,
                       lineage_id=(current.lineage_id or current.id) if current else plan_id, source=source)
    db.add(plan)
    db.flush()
    return plan
