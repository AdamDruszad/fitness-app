"""
User Profile Router.

Endpoints for retrieving and updating the authenticated user's profile and fitness biometrics.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, UserProfile

router = APIRouter()


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """
    Retrieves the authenticated user's current account profile and fitness metrics.
    
    Args:
        current_user: User instance resolved from Bearer JWT.
        
    Returns:
        UserResponse: Current user details excluding sensitive password hashes.
    """
    return current_user


@router.put("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
def update_me(
    body: UserProfile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Updates the authenticated user's profile with onboarding or settings data.
    
    Args:
        body: UserProfile object with fields to update (only unset fields are ignored).
        current_user: Authenticated User instance.
        db: Scoped database session.
        
    Returns:
        UserResponse: Updated user entity.
    """
    # Exclude unset fields so partial updates do not overwrite existing values with None
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return current_user