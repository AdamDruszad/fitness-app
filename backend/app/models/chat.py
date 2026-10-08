"""
AI Coach Chat Message Database Model.

Persists chat history between the user and FitAI assistant.
"""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


def utc_now() -> datetime:
    """
    Application-side timestamp with microsecond precision.

    Chat history is ordered by ``created_at`` alone, so messages sharing one
    database clock tick (``now()`` is second-precision on SQLite and fixed for the
    whole transaction on PostgreSQL) can be returned in the wrong order.
    """
    return datetime.now(timezone.utc)


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
    created_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now())