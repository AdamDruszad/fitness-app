"""
Progress and Analytics Router.

Endpoints for retrieving exercise-specific historical trends
and requesting progressive overload coaching recommendations.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.session import WorkoutSession, ExerciseLog
from app.services.ai import get_progressive_overload_suggestions

router = APIRouter()


@router.get("/exercise/{exercise_name}", status_code=status.HTTP_200_OK)
def get_exercise(
    exercise_name: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Retrieves chronological performance history for a specific exercise.
    
    Joins WorkoutSession and ExerciseLog to return dates and set performance
    (weights and repetitions) across all logged sessions.
    
    Args:
        exercise_name: Exact name of the exercise to query.
        user: Authenticated User instance.
        db: Scoped database session.
        
    Returns:
        List[Dict[str, Any]]: Array of records formatted as [{"date": "YYYY-MM-DD", "sets": [...]}, ...].
    """
    results = (
        db.query(ExerciseLog, WorkoutSession.session_date)
        .join(WorkoutSession, ExerciseLog.session_id == WorkoutSession.id)
        .filter(
            WorkoutSession.user_id == user.id,
            ExerciseLog.exercise_name == exercise_name
        )
        .order_by(WorkoutSession.session_date.asc())
        .all()
    )
    return [{"date": str(d), "sets": log.sets_data} for log, d in results]


@router.get("/suggestions", status_code=status.HTTP_200_OK)
def get_suggestions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Analyzes historical workout data to return AI progressive overload suggestions.
    
    Gracefully handles exceptions by returning an empty suggestions list if AI
    generation encounters any issues or if insufficient workout history exists.
    
    Args:
        user: Authenticated User instance.
        db: Scoped database session.
        
    Returns:
        Dict: {"suggestions": [{"exercise": "...", "suggestion": "..."}, ...]}
    """
    try:
        suggestions = get_progressive_overload_suggestions(user, db)
    except Exception:
        suggestions = []
    return {"suggestions": suggestions}