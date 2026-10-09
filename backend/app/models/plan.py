"""
Workout Plan Database Model.

Defines the entity storing AI-generated workout routines and active plan statuses.
"""

import uuid
from sqlalchemy import Column, Boolean, DateTime, ForeignKey, Integer, String, Text, Index, text, UniqueConstraint
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
    version = Column(Integer, nullable=False, default=1, server_default="1")
    source = Column(String, nullable=False, default="generated", server_default="generated")
    base_plan_id = Column(UUID(as_uuid=True), ForeignKey("workout_plans.id"), nullable=True)
    lineage_id = Column(UUID(as_uuid=True), nullable=True)
    __table_args__ = (Index("uq_active_plan_user", "user_id", unique=True,
                           postgresql_where=text("is_active = true"), sqlite_where=text("is_active = 1")),)


class PlanProposal(Base):
    """Persisted candidate; only the activation service may make it a plan."""
    __tablename__ = "plan_proposals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    request_id = Column(UUID(as_uuid=True), nullable=False)
    request_hash = Column(String(64), nullable=False)
    base_plan_id = Column(UUID(as_uuid=True), ForeignKey("workout_plans.id"), nullable=True)
    applied_plan_id = Column(UUID(as_uuid=True), ForeignKey("workout_plans.id"), nullable=True)
    source_message_ids = Column(JSONB, nullable=False, default=list)
    instructions = Column(Text, nullable=False, default="")
    keep_exercises = Column(JSONB, nullable=False, default=list)
    plan_data = Column(JSONB, nullable=True)
    status = Column(String, nullable=False, default="creating")
    revision = Column(Integer, nullable=False, default=1)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    __table_args__ = (UniqueConstraint("user_id", "request_id", name="uq_proposal_request"),)
