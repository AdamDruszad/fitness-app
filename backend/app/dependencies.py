from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.services.auth import decode_access_token

bearer_scheme = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme), db: Session = Depends(get_db)) -> User:
    try:
        user_id = decode_access_token(credentials.credentials)
        user = db.query(User).filter(User.id == user_id).first()
    except JWTError:
        raise HTTPException(401, detail="Wrong token")
    if user is None:
        raise HTTPException(401, detail="User not found")
    return user