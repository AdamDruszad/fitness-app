"""
AI Coach Chat Schemas.

Pydantic models for incoming chat queries and serialized chat history messages.
"""

from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict, Field


class ChatMessageIn(BaseModel):
    """
    User chat message submission payload.
    
    Attributes:
        content: The text query or question sent to the coach.
    """
    content: str = Field(min_length=1, description="Message content sent by user")


class ChatMessageResponse(BaseModel):
    """
    Chat message schema returned in conversational history queries.
    
    Attributes:
        id: Unique identifier for the message.
        role: Author role ('user' or 'assistant').
        content: Text content of the message.
        created_at: Creation timestamp.
    """
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)