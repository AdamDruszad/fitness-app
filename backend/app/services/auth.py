"""
Authentication & Cryptography Service.

Handles password hashing and verification using recommended Argon2 algorithms via pwdlib,
and JWT access token signing/decoding via python-jose.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID
from jose import jwt, JWTError
from pwdlib import PasswordHash
from app.config import settings

# Initializes PasswordHash using the library's recommended secure scheme (Argon2)
password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """
    Hashes a plain-text password securely using Argon2.
    
    Args:
        password: Plain text password.
        
    Returns:
        str: Salted cryptographic password hash.
    """
    return password_hash.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verifies a plain-text password against a stored cryptographic hash.
    
    Args:
        plain: The plain-text password candidate from user input.
        hashed: The stored password hash from the database.
        
    Returns:
        bool: True if passwords match, False otherwise.
    """
    return password_hash.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    """
    Generates a signed JWT bearer token containing the user's UUID in the 'sub' claim.
    
    Args:
        user_id: String representation of the user's UUID.
        
    Returns:
        str: Encoded JSON Web Token.
    """
    exp_time = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload_dict = {
        'sub': user_id,
        'exp': exp_time,
    }
    return jwt.encode(payload_dict, settings.secret_key.get_secret_value(), algorithm=settings.algorithm)


def decode_access_token(token: str) -> UUID:
    """
    Decodes and validates a signed JWT token, extracting the subject user ID.
    
    Args:
        token: Bearer JWT string.
        
    Raises:
        JWTError: If token is expired, malformed, invalid signature, or missing 'sub'.
        
    Returns:
        str: User ID extracted from the token subject claim.
    """
    payload = jwt.decode(
        token, settings.secret_key.get_secret_value(), algorithms=[settings.algorithm],
        options={"require_exp": True, "require_sub": True},
    )
    sub = payload.get('sub')
    try:
        return UUID(sub)
    except (ValueError, TypeError, AttributeError) as exc:
        raise JWTError("Invalid token subject") from exc
