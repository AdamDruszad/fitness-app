"""
User Authentication and Profile Schemas.

Pydantic models for user registration, login, JWT token responses,
and profile onboarding data validation.
"""

from typing import Optional
import uuid
from pydantic import EmailStr, BaseModel, ConfigDict, Field


class UserRegister(BaseModel):
    """
    Registration request payload.
    
    Attributes:
        email: Valid email address.
        password: Plain-text password with minimum 8 characters and maximum 128 characters.
    """
    email: EmailStr
    password: str = Field(min_length=8, max_length=128, description="User password (min 8 characters)")


class UserLogin(BaseModel):
    """
    Login request payload.
    
    Attributes:
        email: Registered user email.
        password: User password for verification.
    """
    email: EmailStr
    password: str


class Token(BaseModel):
    """
    JWT authentication bearer token response.
    
    Attributes:
        access_token: Encoded JSON Web Token.
        token_type: Standard token type (defaults to 'bearer').
    """
    access_token: str
    token_type: str = "bearer"


class UserProfile(BaseModel):
    """
    User fitness profile attributes for onboarding and settings updates.
    
    All fields are optional to allow partial updates via PUT /users/me.
    """
    age: Optional[int] = Field(None, ge=10, le=120, description="Age in years")
    gender: Optional[str] = Field(None, description="Gender identity ('male', 'female', 'other')")
    weight_kg: Optional[float] = Field(None, gt=0, description="Current weight in kilograms")
    goal: Optional[str] = Field(None, description="Fitness goal ('muscle_gain', 'fat_loss', 'strength', 'general')")
    level: Optional[str] = Field(None, description="Experience level ('beginner', 'intermediate', 'advanced')")
    days_per_week: Optional[int] = Field(None, ge=1, le=7, description="Available workout days per week")
    equipment: Optional[str] = Field(None, description="Equipment accessibility ('gym', 'home', 'none')")
    injuries: Optional[str] = Field(None, description="Notes on past/current injuries or movement restrictions")


class UserResponse(BaseModel):
    """
    Public user profile response returning non-sensitive account data.
    """
    id: uuid.UUID
    email: EmailStr
    age: Optional[int] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    goal: Optional[str] = None
    level: Optional[str] = None
    days_per_week: Optional[int] = None
    equipment: Optional[str] = None
    injuries: Optional[str] = None

    # Enable ORM mode to serialize directly from SQLAlchemy model instances
    model_config = ConfigDict(from_attributes=True)