"""
User Database Model.

Defines the SQLAlchemy model representing users, their credentials,
and onboarding fitness profile attributes.
"""

import uuid
from sqlalchemy import Column, String, Integer, Float, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    """
    User entity storing account authentication details and fitness biometrics.
    
    Attributes:
        id: Primary key UUID generated automatically via uuid4.
        email: Unique user email address used for login and notifications.
        password_hash: Secure Argon2 password hash.
        age: User's age in years.
        gender: Gender identity ('male', 'female', 'other').
        weight_kg: Current body weight in kilograms.
        goal: Primary fitness target ('muscle_gain', 'fat_loss', 'strength', 'general').
        level: Experience level ('beginner', 'intermediate', 'advanced').
        days_per_week: Number of workout days preferred per week.
        equipment: Available equipment ('gym', 'home', 'none').
        injuries: Free-text descriptions of physical injuries or limitations.
        created_at: Timestamp when the user registered.
    """
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
    weekly_session_goal = Column(Integer, nullable=True)
    equipment = Column(String, nullable=True)
    injuries = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
