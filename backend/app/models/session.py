"""
Workout Session and Exercise Log Database Models.

Stores logged workout days, user notes, and sets/reps performance data.
"""

import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Date, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class WorkoutSession(Base):
    """
    Represents a logged workout session performed on a specific date.
    
    Attributes:
        id: Primary key UUID generated automatically.
        user_id: Foreign key referencing the user who completed the workout.
        plan_id: Optional foreign key to the WorkoutPlan that guided this session.
        session_date: Calendar date of the workout session.
        notes: Optional user notes or reflections on workout performance.
        created_at: Timestamp when this session record was persisted.
        exercise_logs: One-to-many relationship linking to all individual exercises completed.
    """
    __tablename__ = "workout_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("workout_plans.id"), nullable=True)
    session_date = Column(Date)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    occurrence_id = Column(UUID(as_uuid=True), nullable=True)
    completion_hash = Column(String(64), nullable=True)
    status = Column(String, nullable=False, default="legacy", server_default="legacy")
    revision = Column(Integer, nullable=False, default=1, server_default="1")
    day_id = Column(String, nullable=True)
    workout_snapshot = Column(JSONB, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (UniqueConstraint("user_id", "occurrence_id", name="uq_session_occurrence"),)

    # Eagerly load exercise_logs with selectin so Pydantic's from_attributes can serialize
    # logs within session responses without additional N+1 queries.
    exercise_logs = relationship(
        "ExerciseLog",
        back_populates="session",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class ExerciseLog(Base):
    """
    Stores set-by-set metrics for a specific exercise within a WorkoutSession.
    
    Attributes:
        id: Primary key UUID generated automatically.
        session_id: Foreign key linking this exercise log to its parent WorkoutSession.
        exercise_name: Standardized or custom name of the exercise (e.g. 'Barbell Bench Press').
        sets_data: JSONB list containing set records with weight (kg) and rep counts:
                   [{"weight": 80.0, "reps": 8}, ...]
        session: Back-reference relationship to the parent WorkoutSession.
    """
    __tablename__ = "exercise_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("workout_sessions.id"), nullable=False)
    # The initial production migration allowed null legacy fields. Keep those
    # records intact; new writes require complete values through request schemas.
    exercise_name = Column(String, nullable=True)
    sets_data = Column(JSONB, nullable=True)
    exercise_id = Column(String, nullable=True, index=True)
    slot_id = Column(String, nullable=True)
    measurement = Column(String, nullable=False, default="reps", server_default="reps")
    load_basis = Column(String, nullable=False, default="unspecified", server_default="unspecified")
    target_data = Column(JSONB, nullable=True)
    notes = Column(Text, nullable=True)

    session = relationship("WorkoutSession", back_populates="exercise_logs")
