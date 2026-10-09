"""Atomic completion, complete owned history, and batched comparable performance."""
from datetime import datetime, timezone, date, timedelta
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.plan import WorkoutPlan
from app.models.session import WorkoutSession, ExerciseLog
from app.schemas.session import CompleteSession, CorrectSession, HistoryRequest, SessionResponse
from app.services.plans import lock_user, fingerprint, plan_response
from app.services.progression import next_target

router = APIRouter()


def owned_day(db, user_id, plan_id, day_id):
    plan = db.query(WorkoutPlan).filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    data = plan_response(plan)["plan_data"]
    day = next((d for d in data["days"] if d["id"] == day_id), None)
    if not day:
        raise HTTPException(422, "Workout day is not in this plan version")
    return plan, day


@router.post("/complete", response_model=SessionResponse)
def complete(body: CompleteSession, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lock_user(db, user.id)
    digest = fingerprint(body.model_dump(mode="json"))
    existing = db.query(WorkoutSession).filter_by(user_id=user.id, occurrence_id=body.occurrence_id).first()
    if existing:
        if existing.completion_hash != digest:
            raise HTTPException(409, "This workout was already saved with different content. Open its saved record to correct it.")
        return existing
    plan, day = owned_day(db, user.id, body.plan_id, body.day_id)
    slots = {e["id"]: e for e in day["exercises"]}
    logs = []
    for entry in body.exercises:
        ex = slots.get(entry.slot_id)
        if not ex or ex["measurement"] != entry.measurement:
            raise HTTPException(422, "An exercise or measurement doesn't match the workout snapshot")
        if ex["load_basis"] == "bodyweight" and any(s.weight not in (None, 0) for s in entry.sets_data):
            raise HTTPException(422, "Bodyweight-only exercises cannot record an external load")
        if entry.target_data and entry.target_data.source_session_id:
            if not db.query(WorkoutSession).filter_by(id=entry.target_data.source_session_id, user_id=user.id).first():
                raise HTTPException(422, "Target history not found")
        logs.append(ExerciseLog(exercise_name=ex["name"], exercise_id=ex["exercise_id"], slot_id=ex["id"],
            measurement=entry.measurement, load_basis=ex["load_basis"],
            sets_data=[s.model_dump(exclude_none=True) for s in entry.sets_data], notes=entry.notes,
            target_data=entry.target_data.model_dump(mode="json", exclude_none=True) if entry.target_data else None))
    session = WorkoutSession(user_id=user.id, plan_id=plan.id, day_id=body.day_id,
        occurrence_id=body.occurrence_id, completion_hash=digest, status="completed",
        session_date=body.session_date, notes=body.notes, completed_at=datetime.now(timezone.utc),
        workout_snapshot={"plan_title": plan.plan_data.get("title", "My training plan"), "version": plan.version, "day": day},
        exercise_logs=logs)
    db.add(session)
    db.commit()
    db.refresh(session)
    from app.routers.progress import invalidate_cache
    invalidate_cache(user.id)
    return session


@router.get("/occurrences/{occurrence_id}", response_model=SessionResponse)
def occurrence(occurrence_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(WorkoutSession).filter_by(user_id=user.id, occurrence_id=occurrence_id).first()
    if not row:
        raise HTTPException(404, "Workout has not been saved")
    return row


@router.get("/history")
def history(before: uuid.UUID | None = None, limit: int = Query(20, ge=1, le=100),
            user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(WorkoutSession).filter(WorkoutSession.user_id == user.id)
    if before:
        cursor = query.filter(WorkoutSession.id == before).first()
        if not cursor:
            raise HTTPException(404, "History cursor not found")
        query = query.filter(or_(WorkoutSession.created_at < cursor.created_at,
            and_(WorkoutSession.created_at == cursor.created_at, WorkoutSession.id < cursor.id)))
    rows = query.order_by(WorkoutSession.created_at.desc(), WorkoutSession.id.desc()).limit(limit + 1).all()
    return {"items": [SessionResponse.model_validate(s).model_dump(mode="json") for s in rows[:limit]],
            "next": str(rows[limit - 1].id) if len(rows) > limit else None}


@router.get("/summary")
def summary(today: date = Query(default_factory=date.today), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(WorkoutSession).filter_by(user_id=user.id, status="completed")
    week_start = today - timedelta(days=today.weekday())
    return {"completed": query.count(), "week_completed": query.filter(WorkoutSession.session_date >= week_start, WorkoutSession.session_date <= today).count(),
            "week_start": str(week_start), "weekly_goal": user.weekly_session_goal}


@router.get("/export")
def export(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import json
    rows = db.query(WorkoutSession).filter_by(user_id=user.id).order_by(WorkoutSession.created_at, WorkoutSession.id).all()
    data = {"schema_version": 1, "units": {"load": "kg", "duration": "seconds"},
            "sessions": [SessionResponse.model_validate(s).model_dump(mode="json") for s in rows]}
    return Response(json.dumps(data, ensure_ascii=False), media_type="application/json",
                    headers={"Content-Disposition": 'attachment; filename="fitai-workouts.json"'})


@router.post("/previous")
def previous(body: HistoryRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _, day = owned_day(db, user.id, body.plan_id, body.day_id)
    ids = [e["exercise_id"] for e in day["exercises"]]
    ranked = db.query(ExerciseLog.id.label("id"), func.row_number().over(partition_by=ExerciseLog.exercise_id,
        order_by=(WorkoutSession.session_date.desc(), WorkoutSession.completed_at.desc(), WorkoutSession.id.desc())).label("rank")).join(WorkoutSession).filter(
        WorkoutSession.user_id == user.id, WorkoutSession.status == "completed", ExerciseLog.exercise_id.in_(ids)).subquery()
    rows = db.query(ExerciseLog, WorkoutSession).join(WorkoutSession).join(ranked, ranked.c.id == ExerciseLog.id).filter(ranked.c.rank == 1).all()
    found = {}
    for log, session in rows:
        prescription = next((e for e in (session.workout_snapshot or {}).get("day", {}).get("exercises", []) if e["id"] == log.slot_id), None)
        found[log.exercise_id] = {"session_id": str(session.id), "date": str(session.session_date),
            "sets": log.sets_data, "notes": log.notes, "prescription": prescription}
    return {e["id"]: {"previous": found.get(e["exercise_id"]),
            "target": next_target(e, found.get(e["exercise_id"]), body.increments.get(e["id"]))} for e in day["exercises"]}


@router.put("/{session_id}/correction", response_model=SessionResponse)
def correct(session_id: uuid.UUID, body: CorrectSession, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lock_user(db, user.id)
    row = db.query(WorkoutSession).filter_by(id=session_id, user_id=user.id).with_for_update().first()
    if not row:
        raise HTTPException(404, "Session not found")
    if row.revision != body.revision:
        raise HTTPException(409, "This session changed. Reload before correcting it.")
    logs = {log.id: log for log in row.exercise_logs}
    for key, sets in body.logs.items():
        if key not in logs or not 1 <= len(sets) <= 100:
            raise HTTPException(422, "Choose an existing log and 1–100 actual sets")
        log = logs[key]
        if any((s.reps is not None) != (log.measurement == "reps") for s in sets):
            raise HTTPException(422, "Keep the recorded measurement type")
        if log.load_basis == "bodyweight" and any(s.weight not in (None, 0) for s in sets):
            raise HTTPException(422, "Bodyweight-only exercises cannot record external loads")
    for key, sets in body.logs.items():
        logs[key].sets_data = [s.model_dump(exclude_none=True) for s in sets]
    row.notes = body.notes
    row.revision += 1
    db.commit()
    # AI advice is auxiliary; discard potentially stale cached summaries.
    from app.routers.progress import invalidate_cache
    invalidate_cache(user.id)
    return row
