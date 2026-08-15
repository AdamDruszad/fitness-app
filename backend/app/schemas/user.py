from pydantic import EmailStr, BaseModel, ConfigDict, Field
from typing import Optional
import uuid

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    
class UserProfile(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None
    weight_kg: Optional[float] = None
    goal: Optional[str] = None
    level: Optional[str] = None
    days_per_week: Optional[int] = None
    equipment: Optional[str] = None
    injuries: Optional[str] = None

class UserResponse(BaseModel):
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
    model_config = ConfigDict(from_attributes=True)