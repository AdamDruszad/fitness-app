"""
Workout Plan Schemas.

Pydantic models for workout plan responses serialized from SQLAlchemy models.
"""

from datetime import datetime
import uuid
from typing import Literal
import re
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class PlanExercise(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    id: str | None = Field(None, max_length=100)
    exercise_id: str | None = Field(None, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    sets: int = Field(ge=1, le=20)
    reps: str | None = Field(None, max_length=50)
    measurement: Literal["reps", "duration", "legacy"] = "reps"
    duration_seconds: int | None = Field(None, ge=1, le=86400)
    load_basis: Literal["unspecified", "total", "per_hand", "added", "bodyweight", "assistance"] = "unspecified"
    notes: str = Field("", max_length=2000)
    target_weight: float | None = Field(None, ge=0, le=2000, allow_inf_nan=False)
    rest_seconds: int = Field(ge=0, le=3600)

    @model_validator(mode="after")
    def prescription(self):
        if self.measurement == "duration":
            if self.duration_seconds is None or self.reps:
                raise ValueError("Timed exercises require seconds, not reps")
        elif self.measurement == "reps":
            match = re.fullmatch(r"(\d+)(?:\s*[-–]\s*(\d+))?", self.reps or "")
            if not match or not 1 <= int(match[1]) <= int(match[2] or match[1]) <= 10000:
                raise ValueError("Use a repetition count or range, such as 8–10")
            if self.duration_seconds is not None:
                raise ValueError("Rep-based exercises cannot prescribe seconds")
        elif not self.reps:
            raise ValueError("Keep the original prescription for an unsupported legacy exercise")
        return self


class PlanDay(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    id: str | None = Field(None, max_length=100)
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
    title: str = Field("My training plan", min_length=1, max_length=200)
    schema_version: int = 2
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
    version: int = 1
    source: str = "generated"
    base_plan_id: uuid.UUID | None = None
    lineage_id: uuid.UUID | None = None

    # Enable ORM serialization from SQLAlchemy WorkoutPlan objects
    model_config = ConfigDict(from_attributes=True)


class ProposalCreate(BaseModel):
    request_id: uuid.UUID
    base_plan_id: uuid.UUID | None = None
    source_message_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    instructions: str = Field("", max_length=6000)
    keep_exercises: list[str] = Field(default_factory=list, max_length=50)
    plan_data: GeneratedPlan | None = None
    from_proposal_id: uuid.UUID | None = None

    @field_validator("keep_exercises")
    @classmethod
    def bounded_names(cls, names):
        if any(not name.strip() or len(name) > 200 for name in names):
            raise ValueError("Keep-exercise names must be between 1 and 200 characters")
        return list(dict.fromkeys(name.strip() for name in names))


class ProposalUpdate(BaseModel):
    revision: int = Field(ge=1)
    plan_data: GeneratedPlan


class ProposalApply(BaseModel):
    revision: int = Field(ge=1)
    expected_active_id: uuid.UUID | None = None


class RestorePlan(BaseModel):
    request_id: uuid.UUID
    expected_active_id: uuid.UUID | None = None
