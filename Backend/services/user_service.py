from sqlalchemy.orm import Session
from models.schema import UserCreate, UserResponse, LoginRequest
from models.database import User
from utils.auth import hash_password, verify_and_migrate_password
from typing import Dict, Any, Optional
from datetime import datetime

class UserService:
    
    def create_user(self, user_data: UserCreate, db: Session) -> User:
        """Create a new user with a bcrypt hashed password."""
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise Exception("An account with this email already exists.")

        # Hash password securely
        hashed_password = hash_password(user_data.password)

        pref_lang = user_data.preferred_language
        if hasattr(pref_lang, "value"):
            pref_lang = pref_lang.value

        user = User(
            name=user_data.name,
            email=user_data.email,
            password=hashed_password,
            preferred_language=str(pref_lang)
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    def login(self, user_data: LoginRequest, db: Session) -> User:
        """Authenticate user with bcrypt password verification and legacy migration."""
        user = db.query(User).filter(User.email == user_data.email).first()
        if not user:
            raise Exception("Invalid email or password.")
        
        # Verify password and check if legacy plaintext needs to be upgraded to bcrypt
        is_valid, needs_rehash = verify_and_migrate_password(user_data.password or "", user.password)
        if not is_valid:
            raise Exception("Invalid email or password.")
        
        # Upgrade legacy password to bcrypt hash in-place
        if needs_rehash and user_data.password:
            user.password = hash_password(user_data.password)
            db.commit()
            db.refresh(user)
        
        return user

    def delete_user(self, user_id: int, db: Session) -> bool:
        """Delete user and all their data."""
        from models.database import Document
        from database.vector_db import VectorDB
        
        user = self.get_user(user_id, db)
        if not user:
            return False
        
        # Cleanup vector DB collections for each document
        try:
            vector_db = VectorDB()
            documents = db.query(Document).filter(Document.user_id == user_id).all()
            for doc in documents:
                if doc.vector_db_id:
                    vector_db.delete_collection(doc.vector_db_id)
        except Exception:
            pass
        
        # Cascade delete SQLAlchemy entities
        db.delete(user)
        db.commit()
        return True
    
    def get_user(self, user_id: int, db: Session) -> Optional[User]:
        """Get user by ID"""
        return db.query(User).filter(User.id == user_id).first()
    
    def update_user(self, user_id: int, user_data: Dict[str, Any], db: Session) -> User:
        """Update user information"""
        user = self.get_user(user_id, db)
        if not user:
            raise Exception("User not found")
        
        for key, value in user_data.items():
            if key == "password" and value:
                value = hash_password(value)
            if hasattr(user, key):
                setattr(user, key, value)
        
        db.commit()
        db.refresh(user)
        return user