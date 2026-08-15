from pydantic import BaseModel, ConfigDict
import uuid
from datetime import datetime


class ChatMessageIn(BaseModel):
    content: str
    
class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)