import uuid
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
from sqlalchemy import Column, Boolean,  DateTime, ForeignKey
from sqlalchemy.sql import func

class WorkoutPlan(Base):
    __tablename__ = "workout_plans"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan_data = Column(JSONB, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())