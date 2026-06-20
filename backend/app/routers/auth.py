from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, Token
from app.services.auth import hash_password, verify_password, create_access_token

router = APIRouter()

@router.post("/register", response_model=Token)
def register(body: UserRegister, db: Session = Depends(get_db)) -> Token:
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail='This email is already in use')
    else:
        user = User()
        user.email = body.email
        user.password_hash = hash_password(body.password)
        db.add(user)
        db.commit()
        db.refresh(user)
    return Token(access_token=create_access_token(str(user.id)))

@router.post("/login", response_model=Token)
def login(body: UserLogin, db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, detail="""You're not registered or wrong password""")
    return Token(access_token=create_access_token(str(user.id)))