"""
Workout Sessions & Exercise Logs Router.

Endpoints for recording completed workouts, querying session history,
and logging individual exercise sets with weights and repetitions.
"""

from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.session import WorkoutSession, ExerciseLog
from app.schemas.session import (
    SessionCreate,
    SessionResponse,
    ExerciseLogIn,
    ExerciseLogResponse,
)

router = APIRouter()


@router.post("/", response_model=SessionResponse, status_code=status.HTTP_200_OK)
def create_new_session(
    body: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
) -> SessionResponse:
    """
    Creates a new workout session record for the current user.
    
    Args:
        body: SessionCreate payload containing session date and optional notes.
        current_user: Authenticated User instance.
        db: Scoped database session.
        
    Returns:
        SessionResponse: The newly created workout session record.
    """
    new_session = WorkoutSession(
        user_id=current_user.id,
        session_date=body.session_date,
        notes=body.notes
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@router.get("/", response_model=List[SessionResponse], status_code=status.HTTP_200_OK)
def get_sessions(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
) -> List[SessionResponse]:
    """
    Retrieves the 20 most recent workout sessions for the user, ordered by date descending.
    
    Args:
        current_user: Authenticated User instance.
        db: Scoped database session.
        
    Returns:
        List[SessionResponse]: List of session records with their eager-loaded exercise logs.
    """
    sessions = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.user_id == current_user.id)
        .order_by(WorkoutSession.created_at.desc())
        .limit(20)
        .all()
    )
    return sessions


@router.get("/{session_id}", response_model=SessionResponse, status_code=status.HTTP_200_OK)
def get_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
) -> SessionResponse:
    """
    Retrieves a single workout session by its UUID.
    
    Args:
        session_id: UUID of the session.
        current_user: Authenticated User instance.
        db: Scoped database session.
        
    Raises:
        HTTPException: 404 Not Found if the session does not exist or does not belong to the user.
        
    Returns:
        SessionResponse: The requested session entity.
    """
    session = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.id == session_id, WorkoutSession.user_id == current_user.id)
        .first()
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    return session


@router.post("/{session_id}/logs", response_model=ExerciseLogResponse, status_code=status.HTTP_200_OK)
def add_log(
    session_id: uuid.UUID,
    body: ExerciseLogIn,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
) -> ExerciseLogResponse:
    """
    Logs an exercise and its performed sets into a specific session.
    
    Args:
        session_id: UUID of the session to attach logs to.
        body: ExerciseLogIn containing exercise name and list of sets (weight + reps).
        current_user: Authenticated User instance.
        db: Scoped database session.
        
    Raises:
        HTTPException: 404 Not Found if the session does not exist or belongs to another user.
        
    Returns:
        ExerciseLogResponse: Saved exercise log record.
    """
    session = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.id == session_id, WorkoutSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # Convert Pydantic set models to JSON-serializable dictionaries
    sets_list = [s.model_dump() for s in body.sets_data]
    new_log = ExerciseLog(
        session_id=session_id,
        exercise_name=body.exercise_name,
        sets_data=sets_list,
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log