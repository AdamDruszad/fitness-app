import uuid
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Date
from sqlalchemy.sql import func
from app.database import Base

class WorkoutSession(Base):
    __tablename__ = "workout_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("workout_plans.id"), nullable=True)
    session_date = Column(Date)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ExerciseLog(Base):
    __tablename__ = "exercise_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("workout_sessions.id"), nullable=False)
    exercise_name = Column(String)
    sets_data = Column(JSONB)