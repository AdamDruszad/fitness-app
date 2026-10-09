"""
Progress and Analytics Router.

Endpoints for retrieving exercise-specific historical trends
and requesting progressive overload coaching recommendations.
"""

import threading
import time
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.session import WorkoutSession, ExerciseLog
from app.services.ai import get_progressive_overload_suggestions

router = APIRouter()
logger = logging.getLogger(__name__)

# Every page view used to trigger a fresh LLM call. Cache each user's answer for
# a few minutes and collapse concurrent requests, so browsing the Progress page
# cannot be turned into an unbounded provider bill.
SUGGESTION_TTL_SECONDS = 300
_suggestion_cache: Dict[str, tuple] = {}
_suggestion_locks: dict = {}
_cache_guard = threading.Lock()


def _user_lock(key: str) -> threading.Lock:
    """Return (creating if needed) the per-user lock used to single-flight AI calls."""
    with _cache_guard:
        lock = _suggestion_locks.get(key)
        if lock is None:
            if len(_suggestion_locks) > 500:
                _suggestion_locks.clear()
            lock = threading.Lock()
            _suggestion_locks[key] = lock
        return lock


def cached_suggestions(user: User, db: Session) -> List[Dict[str, Any]]:
    """
    Return progressive overload suggestions, generating them at most once per TTL.

    Failed generations are never cached, so the next request retries.
    """
    key = str(user.id)
    now = time.monotonic()
    entry = _suggestion_cache.get(key)
    if entry and now - entry[0] < SUGGESTION_TTL_SECONDS:
        return entry[1]

    with _user_lock(key):
        entry = _suggestion_cache.get(key)
        if entry and time.monotonic() - entry[0] < SUGGESTION_TTL_SECONDS:
            return entry[1]
        suggestions = get_progressive_overload_suggestions(user, db)
        _suggestion_cache[key] = (time.monotonic(), suggestions)
        if len(_suggestion_cache) > 500:
            cutoff = time.monotonic() - SUGGESTION_TTL_SECONDS
            for stale_key, stale in list(_suggestion_cache.items()):
                if stale[0] < cutoff:
                    _suggestion_cache.pop(stale_key, None)
        return suggestions


def reset_cache() -> None:
    """Drop cached suggestions and locks (used by tests)."""
    with _cache_guard:
        _suggestion_cache.clear()
        _suggestion_locks.clear()


def invalidate_cache(user_id) -> None:
    with _cache_guard:
        _suggestion_cache.pop(str(user_id), None)


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
        suggestions = cached_suggestions(user, db)
    except Exception as error:
        # Never log the provider payload: it can contain the user's training data.
        logger.warning("Progressive overload suggestions failed (%s)", type(error).__name__)
        suggestions = []
    return {"suggestions": suggestions}
