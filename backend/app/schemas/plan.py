import uuid
from pydantic import BaseModel, ConfigDict
from datetime import datetime

class PlanResponse(BaseModel):
    id: uuid.UUID
    plan_data: dict
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)