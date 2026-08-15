import uuid
from app.database import Base
from sqlalchemy import Column, String, Integer, Float, Text,  DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    weight_kg = Column(Float, nullable=True)
    goal = Column(String, nullable=True)
    level = Column(String, nullable=True)
    days_per_week = Column(Integer, nullable=True)
    equipment = Column(String, nullable=True)
    injuries = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())