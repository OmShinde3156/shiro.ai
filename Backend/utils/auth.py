import os
import logging
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional, Tuple
from fastapi import Request, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from models.database import User
from database.database import get_db

load_dotenv()
logger = logging.getLogger(__name__)

# Security configuration
SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    # If no secret key is set, use a fallback for local dev but log a warning
    SECRET_KEY = "shiro-ai-insecure-development-secret-key-change-in-production"
    logger.warning("JWT_SECRET not set in environment variables! Using fallback secret.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24)) # 24 hours default

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)


# --- Password Hashing & Verification ---

def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt (12 rounds)."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    if not hashed_password or not plain_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def verify_and_migrate_password(plain_password: str, stored_password: str) -> Tuple[bool, bool]:
    """
    Verify password, supporting both modern bcrypt hashes and legacy plaintext records.
    Returns: (is_valid: bool, needs_rehash: bool)
    """
    if not stored_password or not plain_password:
        return False, False

    # Check if stored password is a valid bcrypt hash format ($2a$, $2b$, $2y$)
    if stored_password.startswith(("$2a$", "$2b$", "$2y$")):
        is_valid = verify_password(plain_password, stored_password)
        return is_valid, False

    # Legacy plaintext password check
    if stored_password == plain_password:
        return True, True  # Valid, but must be migrated to bcrypt

    return False, False


# --- Token Management ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# --- Guest & User Resolution ---

def get_guest_user(db: Session) -> User:
    """Retrieve or initialize the default Guest User (ID: 1) within the active DB session."""
    guest = db.query(User).filter(User.id == 1).first()
    if not guest:
        guest = User(
            id=1,
            name="Guest User",
            email="guest@study.ai",
            password=hash_password("guest_secret_password_123"),
            preferred_language="en"
        )
        db.add(guest)
        try:
            db.commit()
            db.refresh(guest)
        except Exception:
            db.rollback()
            guest = db.query(User).filter(User.id == 1).first()
    return guest


def get_user_from_token(token: Optional[str], db: Session) -> Optional[User]:
    """Decode token and return User object if valid, else None."""
    if not token or token in ("guest", "null", "undefined", ""):
        return get_guest_user(db)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return db.query(User).filter(User.id == int(user_id)).first()
    except Exception:
        return None


def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Resolve the current user.
    - If a valid JWT Bearer token is provided: returns the authenticated user.
    - If no token or a guest token is provided: falls back to the Guest user (ID: 1).
    This ensures all users (guest or authenticated) have seamless access to features.
    """
    user = get_user_from_token(token, db)
    if user is None:
        return get_guest_user(db)
    return user


def get_required_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Strict user authentication for account-level modifications (e.g. settings, password changes).
    Raises 401 if unauthenticated.
    """
    if not token or token in ("guest", "null", "undefined", ""):
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_authorized_document(document_id: int, user_id: int, db: Session):
    """
    Centralized authorization helper (SEC-01 & SEC-03).
    Verifies that the document exists and belongs to the authenticated user.
    Raises HTTPException(404) on not found or unauthorized access to prevent resource enumeration.
    """
    from models.database import Document
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user_id
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found or access denied")
    return document


