"""
Authentication Router.

Endpoints for user account registration and login authentication,
issuing JWT access bearer tokens.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models.user import User
from app.ratelimit import rate_limit
from app.schemas.user import UserRegister, UserLogin, Token
from app.services.auth import hash_password, verify_password, create_access_token

router = APIRouter()

# Credential endpoints are brute-force and account-farm targets, so each client
# address gets a small budget per sliding window.
REGISTER_LIMIT = rate_limit("auth.register", limit=5, window_seconds=300)
LOGIN_LIMIT = rate_limit("auth.login", limit=10, window_seconds=300)


@router.post("/register", response_model=Token, status_code=status.HTTP_200_OK)
def register(
    body: UserRegister,
    db: Session = Depends(get_db),
    _rate: None = Depends(REGISTER_LIMIT),
) -> Token:
    """
    Registers a new user account with unique email and secure hashed password.
    
    Args:
        body: UserRegister containing email and plain-text password.
        db: Scoped database session.
        
    Raises:
        HTTPException: 400 Bad Request if the email address is already registered.
        HTTPException: 429 Too Many Requests if the client exhausted its registration budget.
        
    Returns:
        Token: JWT access token for immediate client authentication.
    """
    email_lower = body.email.lower().strip()
    # Check if a user with this normalized email already exists
    if db.query(User).filter(User.email == email_lower).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email is already in use"
        )

    # Hash the password with Argon2 and persist new user
    user = User()
    user.email = email_lower
    user.password_hash = hash_password(body.password)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # The unique constraint may win a race after the earlier lookup.
        if db.query(User).filter(User.email == email_lower).first():
            raise HTTPException(status_code=400, detail="This email is already in use") from None
        raise
    db.refresh(user)

    # Generate and return signed JWT token
    return Token(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
def login(
    body: UserLogin,
    db: Session = Depends(get_db),
    _rate: None = Depends(LOGIN_LIMIT),
) -> Token:
    """
    Authenticates user credentials against the database.
    
    Args:
        body: UserLogin containing email and plain-text password.
        db: Scoped database session.
        
    Raises:
        HTTPException: 401 Unauthorized if email is not found or password verification fails.
        HTTPException: 429 Too Many Requests if the client exhausted its login budget.
        
    Returns:
        Token: JWT access token for authenticated session requests.
    """
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You're not registered or wrong password"
        )

    return Token(access_token=create_access_token(str(user.id)))
