"""
Workout Session and Logging Schemas.

Pydantic models defining input validation and serialization for workout sessions
and exercise performance sets.
"""

from datetime import date, datetime
from typing import Annotated, List, Optional, Literal
import uuid
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


class SetData(BaseModel):
    """
    Performance data for a single set within an exercise.
    
    Attributes:
        weight: Weight in kilograms (e.g. 80.0; can be 0 for bodyweight exercises).
        reps: Completed repetitions count.
    """
    weight: float = Field(ge=0, le=2000, allow_inf_nan=False, description="Weight used in kg")
    reps: int = Field(ge=1, le=10000, strict=True, description="Number of repetitions completed")


class ExerciseLogIn(BaseModel):
    """
    Payload for logging an exercise and its completed sets.
    
    Attributes:
        exercise_name: Title of the exercise.
        sets_data: List of individual set metrics.
    """
    exercise_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    sets_data: List[SetData] = Field(min_length=1, max_length=100)


class ExerciseLogResponse(BaseModel):
    """
    Response schema for a logged exercise.
    """
    id: uuid.UUID
    exercise_name: str | None
    sets_data: list | None
    exercise_id: str | None = None
    slot_id: str | None = None
    measurement: str = "reps"
    load_basis: str = "unspecified"
    target_data: dict | None = None
    notes: str | None = None
    model_config = ConfigDict(from_attributes=True)


class SessionCreate(BaseModel):
    """
    Payload to initiate a new workout session record.
    
    Attributes:
        session_date: The calendar date the session occurred on.
        notes: Optional comments about form, fatigue, or equipment used.
    """
    session_date: date
    notes: Optional[str] = Field(None, max_length=2000)


class SessionResponse(BaseModel):
    """
    Response schema returning a workout session and all associated exercise logs.
    """
    id: uuid.UUID
    session_date: date
    notes: Optional[str] = None
    created_at: datetime
    exercise_logs: List[ExerciseLogResponse] = []
    occurrence_id: uuid.UUID | None = None
    plan_id: uuid.UUID | None = None
    day_id: str | None = None
    status: str = "legacy"
    revision: int = 1
    workout_snapshot: dict | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ActualSet(BaseModel):
    model_config = ConfigDict(extra="forbid")
    weight: float | None = Field(None, ge=0, le=2000, allow_inf_nan=False)
    reps: int | None = Field(None, ge=1, le=10000, strict=True)
    duration_seconds: int | None = Field(None, ge=1, le=86400, strict=True)

    @model_validator(mode="after")
    def single_measurement(self):
        if (self.reps is None) == (self.duration_seconds is None):
            raise ValueError("Record either repetitions or seconds")
        return self


class TargetRecord(BaseModel):
    source_session_id: uuid.UUID | None = None
    rule: str = Field("manual", max_length=100)
    reason: str = Field("", max_length=2000)
    weight: float | None = Field(None, ge=0, le=2000, allow_inf_nan=False)
    reps: int | None = Field(None, ge=1, le=10000)
    duration_seconds: int | None = Field(None, ge=1, le=86400)
    override_reason: str = Field("", max_length=500)


class CompletedExercise(BaseModel):
    slot_id: str = Field(min_length=1, max_length=100)
    measurement: Literal["reps", "duration"]
    sets_data: list[ActualSet] = Field(min_length=1, max_length=100)
    target_data: TargetRecord | None = None
    notes: str = Field("", max_length=2000)

    @model_validator(mode="after")
    def matching_measurement(self):
        if any((s.reps is not None) != (self.measurement == "reps") for s in self.sets_data):
            raise ValueError("Set measurements must match the exercise")
        return self


class CompleteSession(SessionCreate):
    occurrence_id: uuid.UUID
    plan_id: uuid.UUID
    day_id: str = Field(min_length=1, max_length=100)
    exercises: list[CompletedExercise] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def unique_slots(self):
        if len({e.slot_id for e in self.exercises}) != len(self.exercises):
            raise ValueError("An exercise slot can appear only once")
        return self


class CorrectSession(BaseModel):
    revision: int = Field(ge=1)
    logs: dict[uuid.UUID, list[ActualSet]] = Field(min_length=1, max_length=20)
    notes: str | None = Field(None, max_length=2000)


class HistoryRequest(BaseModel):
    plan_id: uuid.UUID
    day_id: str = Field(min_length=1, max_length=100)
    increments: dict[str, float] = Field(default_factory=dict, max_length=20)
