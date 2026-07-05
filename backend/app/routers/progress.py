from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.session import WorkoutSession, ExerciseLog
from app.services.ai import get_progressive_overload_suggestions
from app.dependencies import get_current_user

router = APIRouter()

@router.get("/exercise/{exercise_name}")
def get_exercise(exercise_name: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    results = db.query(ExerciseLog, WorkoutSession.session_date).join(WorkoutSession, ExerciseLog.session_id == WorkoutSession.id).filter(WorkoutSession.user_id == user.id, ExerciseLog.exercise_name == exercise_name).all()
    return [{"date": str(d), "sets": log.sets_data} for log, d in results]

@router.get("/suggestions")
def get_suggestions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        suggestions = get_progressive_overload_suggestions(user, db)
    except Exception:
        suggestions = []
    return {"suggestions": suggestions}