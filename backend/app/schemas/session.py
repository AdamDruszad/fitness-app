"""
Workout Session and Logging Schemas.

Pydantic models defining input validation and serialization for workout sessions
and exercise performance sets.
"""

from datetime import date, datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class SetData(BaseModel):
    """
    Performance data for a single set within an exercise.
    
    Attributes:
        weight: Weight in kilograms (e.g. 80.0; can be 0 for bodyweight exercises).
        reps: Completed repetitions count.
    """
    weight: float = Field(ge=0, description="Weight used in kg")
    reps: int = Field(ge=0, description="Number of repetitions completed")


class ExerciseLogIn(BaseModel):
    """
    Payload for logging an exercise and its completed sets.
    
    Attributes:
        exercise_name: Title of the exercise.
        sets_data: List of individual set metrics.
    """
    exercise_name: str
    sets_data: List[SetData]


class ExerciseLogResponse(BaseModel):
    """
    Response schema for a logged exercise.
    """
    id: uuid.UUID
    exercise_name: str
    sets_data: list
    model_config = ConfigDict(from_attributes=True)


class SessionCreate(BaseModel):
    """
    Payload to initiate a new workout session record.
    
    Attributes:
        session_date: The calendar date the session occurred on.
        notes: Optional comments about form, fatigue, or equipment used.
    """
    session_date: date
    notes: Optional[str] = None


class SessionResponse(BaseModel):
    """
    Response schema returning a workout session and all associated exercise logs.
    """
    id: uuid.UUID
    session_date: date
    notes: Optional[str] = None
    created_at: datetime
    exercise_logs: List[ExerciseLogResponse] = []

    model_config = ConfigDict(from_attributes=True)