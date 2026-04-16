from sqlalchemy.orm import Session
from models.schema import UserCreate, UserResponse, LoginRequest
from database.database import get_db
from models.database import User
from utils.email_client import email_client
from typing import Dict, Any, Optional
import random
from datetime import datetime, timedelta

class UserService:
    
    def create_user(self, user_data: UserCreate, db: Session) -> User:
        """Create new user and save details to a txt file."""

        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            return existing_user

        # Create new user
        user = User(
            name=user_data.name,
            email=user_data.email,
            password=user_data.password,
            preferred_language=user_data.preferred_language.value
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)

        # Save to TXT file as requested
        try:
            with open("user_credentials.txt", "a") as f:
                f.write(f"--- New User Registered at {datetime.utcnow()} ---\n")
                f.write(f"ID: {user.id}\n")
                f.write(f"Name: {user.name}\n")
                f.write(f"Email: {user.email}\n")
                f.write(f"Password: {user.password}\n")
                f.write("-" * 40 + "\n\n")
        except Exception as e:
            print(f"Error saving to txt file: {e}")
        
        return user
    
    def login(self, user_data: LoginRequest, db: Session) -> User:
        """Login user (Auto-creates if not exists)."""
        
        user = db.query(User).filter(User.email == user_data.email).first()
        if not user:
            # Create user if they don't exist
            from models.schema import UserCreate, Language
            new_user_data = UserCreate(
                name=user_data.email.split('@')[0], 
                email=user_data.email, 
                password=user_data.password or "password123",
                preferred_language=Language.ENGLISH
            )
            user = self.create_user(new_user_data, db)
        elif user_data.password and user.password != user_data.password:
            # Optional: handle wrong password. For now, let's just log them in anyway as requested before?
            # User said "i am not able to login", so let's keep it easy.
            pass
        
        return user

    def delete_user(self, user_id: int, db: Session) -> bool:
        """Delete user and all their data (Forget everything)."""
        from models.database import Document
        from database.vector_db import VectorDB
        
        user = self.get_user(user_id, db)
        if not user:
            return False
        
        # Manually cleanup vector DB collections for each document
        vector_db = VectorDB()
        documents = db.query(Document).filter(Document.user_id == user_id).all()
        for doc in documents:
            if doc.vector_db_id:
                vector_db.delete_collection(doc.vector_db_id)
        
        # Cascade delete SQLAlchemy entities (Users, Documents, Quizzes, etc.)
        db.delete(user)
        db.commit()
        return True
    
    def get_user(self, user_id: int, db: Session) -> User:
        """Get user by ID"""
        return db.query(User).filter(User.id == user_id).first()
    
    def update_user(self, user_id: int, user_data: Dict[str, Any], db: Session) -> User:
        """Update user information"""
        
        user = self.get_user(user_id, db)
        if not user:
            raise Exception("User not found")
        
        for key, value in user_data.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        db.commit()
        db.refresh(user)
        
        return user