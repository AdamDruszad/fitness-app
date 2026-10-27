"""
Demo Account Service.

Creates throwaway guest accounts so visitors can try FitAI without registering.
Each guest gets a private copy of a sample profile, plan and short training
history, so one visitor's changes never show up for the next.
"""

from datetime import date, datetime, time, timedelta, timezone
import re
import secrets
import uuid
from app.models.session import WorkoutSession, ExerciseLog
from app.models.user import User, GUEST_EMAIL_DOMAIN
from app.services.auth import hash_password
from app.services.plans import activate, fingerprint

SAMPLE_PROFILE = {
    "age": 27,
    "gender": "other",
    "weight_kg": 72.0,
    "goal": "muscle_gain",
    "level": "intermediate",
    "days_per_week": 3,
    "weekly_session_goal": 3,
    "equipment": "gym",
}

SAMPLE_PLAN = {
    "title": "Sample plan · Full body, 3 days",
    "weeks": 8,
    "days": [
        {"day": "Monday", "focus": "Full body A", "exercises": [
            {"name": "Back squat", "sets": 3, "reps": "6–8", "load_basis": "total", "target_weight": 60, "rest_seconds": 120},
            {"name": "Bench press", "sets": 3, "reps": "6–8", "load_basis": "total", "target_weight": 50, "rest_seconds": 120},
            {"name": "Bent-over row", "sets": 3, "reps": "8–10", "load_basis": "total", "target_weight": 45, "rest_seconds": 90},
            {"name": "Plank", "sets": 3, "measurement": "duration", "duration_seconds": 45, "load_basis": "bodyweight", "rest_seconds": 60},
        ]},
        {"day": "Wednesday", "focus": "Full body B", "exercises": [
            {"name": "Romanian deadlift", "sets": 3, "reps": "8–10", "load_basis": "total", "target_weight": 60, "rest_seconds": 120},
            {"name": "Standing overhead press", "sets": 3, "reps": "6–8", "load_basis": "total", "target_weight": 30, "rest_seconds": 90},
            {"name": "Pull-up", "sets": 3, "reps": "5–8", "load_basis": "bodyweight", "rest_seconds": 120},
            {"name": "Dumbbell curl", "sets": 2, "reps": "10–12", "load_basis": "per_hand", "target_weight": 10, "rest_seconds": 60},
        ]},
        {"day": "Friday", "focus": "Full body C", "exercises": [
            {"name": "Leg press", "sets": 3, "reps": "10–12", "load_basis": "total", "target_weight": 100, "rest_seconds": 120},
            {"name": "Incline dumbbell press", "sets": 3, "reps": "8–10", "load_basis": "per_hand", "target_weight": 18, "rest_seconds": 90},
            {"name": "Seated cable row", "sets": 3, "reps": "10–12", "load_basis": "total", "target_weight": 45, "rest_seconds": 90},
            {"name": "Dumbbell lateral raise", "sets": 2, "reps": "12–15", "load_basis": "per_hand", "target_weight": 6, "rest_seconds": 60},
        ]},
    ],
}

# Plan day index by weekday (Monday, Wednesday, Friday), so sample workouts fall on their own days.
PLAN_WEEKDAYS = {0: 0, 2: 1, 4: 2}
# Five sessions repeat at least one day, so Progress has a trend to chart.
SAMPLE_SESSIONS = 5

# Weight added on a repeat of the same day, by load basis (kg).
PROGRESSION_KG = {"total": 2.5, "per_hand": 2.0}


def sample_sets(exercise: dict, repeat: int) -> list[dict]:
    """Plausible logged sets for one prescribed exercise; repeats add a little load."""
    if exercise["measurement"] == "duration":
        return [{"duration_seconds": exercise["duration_seconds"]} for _ in range(exercise["sets"])]
    low = int(re.match(r"\d+", exercise["reps"])[0])
    reps = [low + 1] + [low] * (exercise["sets"] - 1) if repeat == 0 else [low] * exercise["sets"]
    if exercise["load_basis"] == "bodyweight":
        return [{"reps": count} for count in reps]
    weight = exercise["target_weight"] + repeat * PROGRESSION_KG.get(exercise["load_basis"], 0)
    return [{"weight": weight, "reps": count} for count in reps]


def sample_schedule(today: date) -> list[tuple[date, int]]:
    """The last few plan weekdays before today, oldest first, with their plan day index."""
    found = []
    day = today
    while len(found) < SAMPLE_SESSIONS:
        day -= timedelta(days=1)
        if day.weekday() in PLAN_WEEKDAYS:
            found.append((day, PLAN_WEEKDAYS[day.weekday()]))
    return found[::-1]


def seed_history(db, user: User, plan, today: date) -> None:
    """Completed sessions in the same shape the workout logger saves."""
    days = plan.plan_data["days"]
    seen = {}
    for session_date, index in sample_schedule(today):
        day = days[index]
        repeat = seen.get(index, 0)
        seen[index] = repeat + 1
        finished = datetime.combine(session_date, time(18, 0), tzinfo=timezone.utc)
        logs = [ExerciseLog(exercise_name=ex["name"], exercise_id=ex["exercise_id"], slot_id=ex["id"],
                            measurement=ex["measurement"], load_basis=ex["load_basis"],
                            sets_data=sample_sets(ex, repeat), notes="")
                for ex in day["exercises"]]
        occurrence_id = uuid.uuid4()
        db.add(WorkoutSession(
            user_id=user.id, plan_id=plan.id, day_id=day["id"], occurrence_id=occurrence_id,
            completion_hash=fingerprint({"occurrence_id": occurrence_id, "day_id": day["id"], "sample": True}),
            status="completed", session_date=session_date, completed_at=finished, created_at=finished,
            workout_snapshot={"plan_title": plan.plan_data["title"], "version": plan.version, "day": day},
            exercise_logs=logs))


def create_guest(db, today: date | None = None) -> User:
    """Create and commit a guest account with its own sample plan and history."""
    user = User(
        email=f"guest-{uuid.uuid4().hex}@{GUEST_EMAIL_DOMAIN}",
        # Nobody knows this password, so the account is reachable only through its token.
        password_hash=hash_password(secrets.token_urlsafe(32)),
        **SAMPLE_PROFILE,
    )
    db.add(user)
    db.flush()
    plan = activate(db, user.id, SAMPLE_PLAN, None, source="sample")
    seed_history(db, user, plan, today or date.today())
    db.commit()
    db.refresh(user)
    return user
