"""
FastAPI Security & Authentication Dependencies.

Provides dependencies to protect endpoints by validating incoming JWT Bearer tokens
and resolving the authenticated user from the database.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.services.auth import decode_access_token

# HTTP Bearer scheme expects 'Authorization: Bearer <token>' in request headers
bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates the JWT token from the Authorization header and returns the current User.
    
    Args:
        credentials: The Bearer token extracted by HTTPBearer.
        db: Scoped database session dependency.
        
    Raises:
        HTTPException: 401 Unauthorized if token is invalid, expired, or user not found.
        
    Returns:
        User: The authenticated SQLAlchemy User model instance.
    """
    try:
        # Decode and verify the JWT token to extract the user UUID subject
        user_id = decode_access_token(credentials.credentials)
        user = db.query(User).filter(User.id == user_id).first()
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user