from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.database import Base
import os

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./study_guide.db")

# PostgreSQL specific tuning
if DATABASE_URL.startswith("postgresql"):
    engine = create_engine(
        DATABASE_URL, 
        pool_size=20, 
        max_overflow=10, 
        pool_pre_ping=True
    )
else:
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Database dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()