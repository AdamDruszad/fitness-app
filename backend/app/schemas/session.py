from pydantic import BaseModel
import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import ConfigDict

class SetData(BaseModel):
    weight: float
    reps: int
    
class ExerciseLogIn(BaseModel):
    exercise_name: str
    sets_data: list[SetData]

class ExerciseLogResponse(BaseModel):
    id: uuid.UUID
    exercise_name: str
    sets_data: list
    model_config = ConfigDict(from_attributes=True)
    
class SessionCreate(BaseModel):
    session_date: date
    notes: Optional[str] = None
    
class SessionResponse(BaseModel):
    id: uuid.UUID
    session_date: date
    notes: Optional[str] = None
    created_at: datetime
    exercise_logs: list[ExerciseLogResponse] = []
    model_config = ConfigDict(from_attributes=True)