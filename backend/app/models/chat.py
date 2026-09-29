"""
AI Coach Chat Message Database Model.

Persists chat history between the user and FitAI assistant.
"""

import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class ChatMessage(Base):
    """
    Individual chat message record between a user and the AI fitness coach.
    
    Attributes:
        id: Primary key UUID generated automatically.
        user_id: Foreign key referencing the user who owns this chat history.
        role: Author role, either 'user' or 'assistant'.
        content: The text content of the message (supports markdown for coach responses).
        created_at: Timestamp when the message was sent or generated.
    """
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())