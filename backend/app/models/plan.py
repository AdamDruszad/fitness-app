"""
Workout Plan Database Model.

Defines the entity storing AI-generated workout routines and active plan statuses.
"""

import uuid
from sqlalchemy import Column, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database import Base


class WorkoutPlan(Base):
    """
    Represents an AI-generated multi-week workout program for a user.
    
    Attributes:
        id: Primary key UUID generated automatically.
        user_id: Foreign key referencing the user who owns this plan.
        plan_data: JSONB structure containing weeks, days, focus areas, and exercise sets/reps.
        is_active: Boolean flag indicating if this is currently the active routine for the user.
        created_at: Timestamp when this plan was created.
    """
    __tablename__ = "workout_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan_data = Column(JSONB, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())