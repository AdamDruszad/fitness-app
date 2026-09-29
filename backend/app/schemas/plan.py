"""
Workout Plan Schemas.

Pydantic models for workout plan responses serialized from SQLAlchemy models.
"""

from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict


class PlanResponse(BaseModel):
    """
    Structured representation of a user's workout routine.
    
    Attributes:
        id: Unique identifier of the plan.
        plan_data: JSON dictionary detailing weeks, workout days, focus, and exercises.
        is_active: Whether this plan is the user's active program.
        created_at: Generation timestamp.
    """
    id: uuid.UUID
    plan_data: dict
    is_active: bool
    created_at: datetime

    # Enable ORM serialization from SQLAlchemy WorkoutPlan objects
    model_config = ConfigDict(from_attributes=True)