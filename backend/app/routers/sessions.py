from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from typing import List
import uuid
from app.database import get_db
from app.models.user import User
from app.models.session import WorkoutSession, ExerciseLog
from app.schemas.session import SessionCreate, SessionResponse, ExerciseLogIn, ExerciseLogResponse
from app.dependencies import get_current_user

router = APIRouter()

@router.post("/")
def create_new_session(body: SessionCreate, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)) -> SessionResponse:
    new_session = WorkoutSession(user_id = current_user.id, session_date = body.session_date)
    db.add(new_session); db.commit(); db.refresh(new_session)
    return new_session
    
@router.get("/")
def get_sessions(current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)) -> List[SessionResponse]:
    sessions = db.query(WorkoutSession).filter(WorkoutSession.user_id == current_user.id).order_by(WorkoutSession.created_at.desc()).limit(20).all()
    return sessions

@router.get("/{session_id}")
def get_session(session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)) -> SessionResponse:
    session = db.query(WorkoutSession).filter(WorkoutSession.id == session_id, WorkoutSession.user_id == current_user.id).first()
    if session is None: raise HTTPException(404, "Session not found")
    return session

@router.post("/{session_id}/logs")
def add_log(session_id: uuid.UUID, body:ExerciseLogIn, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)) -> ExerciseLogResponse:
    if not db.query(WorkoutSession).filter(WorkoutSession.id == session_id, WorkoutSession.user_id == current_user.id).first(): raise HTTPException(404, "Session not found")
    new_log = ExerciseLog(session_id = session_id, exercise_name = body.exercise_name, sets_data = [s.model_dump() for s in body.sets_data])
    db.add(new_log); db.commit(); db.refresh(new_log)
    return new_log