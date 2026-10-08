"""
Workout Plan Schemas.

Pydantic models for workout plan responses serialized from SQLAlchemy models.
"""

from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PlanExercise(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    sets: int = Field(ge=1, le=20)
    reps: str = Field(min_length=1, max_length=50)
    rest_seconds: int = Field(ge=0, le=3600)


class PlanDay(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    day: str = Field(min_length=1, max_length=50)
    focus: str = Field(min_length=1, max_length=200)
    exercises: list[PlanExercise] = Field(max_length=20)

    @field_validator("exercises")
    @classmethod
    def unique_exercises(cls, exercises):
        names = [exercise.name.casefold() for exercise in exercises]
        if len(names) != len(set(names)):
            raise ValueError("Each exercise must have a unique name within its day")
        return exercises


class GeneratedPlan(BaseModel):
    """Validate untrusted provider output before replacing the active plan."""
    weeks: int = Field(ge=1, le=52)
    days: list[PlanDay] = Field(min_length=1, max_length=7)

    @field_validator("days")
    @classmethod
    def valid_training_days(cls, days):
        names = [day.day.casefold() for day in days]
        if len(names) != len(set(names)):
            raise ValueError("Training day names must be unique")
        if not any(day.exercises for day in days):
            raise ValueError("A plan must contain at least one exercise")
        return days


class ProgressSuggestion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    exercise: str = Field(min_length=1, max_length=200)
    suggestion: str = Field(min_length=1, max_length=2000)


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
