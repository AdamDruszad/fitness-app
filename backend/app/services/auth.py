from pwdlib import PasswordHash
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.config import settings

password_hash = PasswordHash.recommended()

def hash_password(password: str) -> str:
    return password_hash.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return password_hash.verify(plain, hashed)

def create_access_token(user_id: str) -> str:
    exp_time = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload_dict = {'sub': user_id, 'exp': exp_time}
    return jwt.encode(payload_dict, settings.secret_key, settings.algorithm)

def decode_access_token(token: str) -> str:
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    sub = payload.get('sub')
    if sub is None:
        raise JWTError("Invalid token")
    return sub