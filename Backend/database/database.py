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
    """Initialize database tables and handle schema migrations"""
    Base.metadata.create_all(bind=engine)
    
    # Surgical Migration for missing columns (SQLite fallback)
    if "sqlite" in str(engine.url):
        from sqlalchemy import text
        with engine.connect() as conn:
            # Users table migrations
            for col, col_type in [("avatar_url", "TEXT"), ("xp", "INTEGER DEFAULT 0"), ("level", "INTEGER DEFAULT 1")]:
                try:
                    # Check if column exists
                    conn.execute(text(f"SELECT {col} FROM users LIMIT 1"))
                except Exception:
                    print(f"Adding missing {col} column to users table...")
                    try:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                        conn.commit()
                    except Exception as e:
                        print(f"Migration for {col} on users failed: {e}")

            # Knowledge Edge migrations
            try:
                conn.execute(text(f"SELECT confidence_score FROM knowledge_edges LIMIT 1"))
            except Exception:
                print(f"Adding missing confidence_score column to knowledge_edges table...")
                try:
                    conn.execute(text(f"ALTER TABLE knowledge_edges ADD COLUMN confidence_score FLOAT DEFAULT 1.0"))
                    conn.commit()
                except Exception as e:
                    print(f"Migration for confidence_score failed: {e}")

            # Documents table migrations
            for col, col_type in [("source_url", "TEXT"), ("video_id", "TEXT"), ("content_hash", "TEXT")]:
                try:
                    conn.execute(text(f"SELECT {col} FROM documents LIMIT 1"))
                except Exception:
                    print(f"Adding missing {col} column to documents table...")
                    try:
                        conn.execute(text(f"ALTER TABLE documents ADD COLUMN {col} {col_type}"))
                        conn.commit()
                    except Exception as e:
                        print(f"Migration for {col} on documents failed: {e}")

def get_db():
    """Database dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
