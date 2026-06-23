from app.models.user import User
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.schemas.user import UserResponse, UserProfile
from app.database import get_db
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user

@router.put("/me", response_model=UserResponse)
def update_me(body: UserProfile, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserResponse:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit(); db.refresh(current_user)
    return current_user