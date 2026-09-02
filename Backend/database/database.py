from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from models.database import Base
import os

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./study_guide.db")
SQLALCHEMY_DATABASE_URL = DATABASE_URL

# PostgreSQL specific tuning vs SQLite WAL concurrency tuning
if DATABASE_URL.startswith("postgresql"):
    engine = create_engine(
        DATABASE_URL, 
        pool_size=30, 
        max_overflow=20, 
        pool_pre_ping=True
    )
else:
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False, "timeout": 30}
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        """Enable WAL mode and fast concurrency for SQLite."""
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.close()
        except Exception:
            pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database tables and handle schema migrations"""
    Base.metadata.create_all(bind=engine)
    
    # Surgical Migration for missing columns (SQLite fallback)
    if "sqlite" in str(engine.url):
        from sqlalchemy import text
        with engine.connect() as conn:
            # Users table migrations
            for col, col_type in [
                ("avatar_url", "TEXT"),
                ("xp", "INTEGER DEFAULT 0"),
                ("level", "INTEGER DEFAULT 1"),
                ("ai_quota_daily", "INTEGER DEFAULT 50"),
                ("groq_api_key_encrypted", "TEXT"),
                ("gemini_api_key_encrypted", "TEXT"),
                ("openai_api_key_encrypted", "TEXT"),
                ("preferred_ai_provider", "TEXT DEFAULT 'auto'"),
                ("byok_enabled", "BOOLEAN DEFAULT 1")
            ]:
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

            # AIRequestLog table migrations
            for col, col_type in [
                ("billing_source", "TEXT DEFAULT 'platform'"),
                ("latency_ms", "INTEGER DEFAULT 0")
            ]:
                try:
                    conn.execute(text(f"SELECT {col} FROM ai_request_logs LIMIT 1"))
                except Exception:
                    try:
                        conn.execute(text(f"ALTER TABLE ai_request_logs ADD COLUMN {col} {col_type}"))
                        conn.commit()
                    except Exception as e:
                        print(f"Migration for {col} on ai_request_logs failed: {e}")

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
            for col, col_type in [
                ("source_url", "TEXT"),
                ("video_id", "TEXT"),
                ("content_hash", "TEXT"),
                ("version", "INTEGER DEFAULT 1"),
                ("file_url", "TEXT")
            ]:
                try:
                    conn.execute(text(f"SELECT {col} FROM documents LIMIT 1"))
                except Exception:
                    print(f"Adding missing {col} column to documents table...")
                    try:
                        conn.execute(text(f"ALTER TABLE documents ADD COLUMN {col} {col_type}"))
                        conn.commit()
                    except Exception as e:
                        print(f"Migration for {col} on documents failed: {e}")

            # FlashcardProgress table FSRS migrations
            fsrs_columns = [
                ("fsrs_state", "INTEGER DEFAULT 0"),
                ("fsrs_stability", "FLOAT DEFAULT 0.0"),
                ("fsrs_difficulty", "FLOAT DEFAULT 0.0"),
                ("fsrs_elapsed_days", "INTEGER DEFAULT 0"),
                ("fsrs_scheduled_days", "INTEGER DEFAULT 0"),
                ("fsrs_reps", "INTEGER DEFAULT 0"),
                ("fsrs_lapses", "INTEGER DEFAULT 0")
            ]
            for col, col_type in fsrs_columns:
                try:
                    conn.execute(text(f"SELECT {col} FROM flashcard_progress LIMIT 1"))
                except Exception:
                    print(f"Adding missing {col} column to flashcard_progress table...")
                    try:
                        conn.execute(text(f"ALTER TABLE flashcard_progress ADD COLUMN {col} {col_type}"))
                        conn.commit()
                    except Exception as e:
                        print(f"Migration for {col} on flashcard_progress failed: {e}")

            # Summaries table migrations
            for col, col_type in [("status", "TEXT DEFAULT 'completed'")]:
                try:
                    conn.execute(text(f"SELECT {col} FROM summaries LIMIT 1"))
                except Exception:
                    print(f"Adding missing {col} column to summaries table...")
                    try:
                        conn.execute(text(f"ALTER TABLE summaries ADD COLUMN {col} {col_type}"))
                        conn.commit()
                    except Exception as e:
                        print(f"Migration for {col} on summaries failed: {e}")

            # Podcasts table migrations
            for col, col_type in [
                ("title", "TEXT"),
                ("subject", "TEXT DEFAULT 'General'")
            ]:
                try:
                    conn.execute(text(f"SELECT {col} FROM podcasts LIMIT 1"))
                except Exception:
                    print(f"Adding missing {col} column to podcasts table...")
                    try:
                        conn.execute(text(f"ALTER TABLE podcasts ADD COLUMN {col} {col_type}"))
                        conn.commit()
                    except Exception as e:
                        print(f"Migration for {col} on podcasts failed: {e}")

            # ChatHistory table migrations
            for col, col_type in [("status", "TEXT DEFAULT 'completed'"), ("latency_ms", "INTEGER DEFAULT 0")]:
                try:
                    conn.execute(text(f"SELECT {col} FROM chat_history LIMIT 1"))
                except Exception:
                    print(f"Adding missing {col} column to chat_history table...")
                    try:
                        conn.execute(text(f"ALTER TABLE chat_history ADD COLUMN {col} {col_type}"))
                        conn.commit()
                    except Exception as e:
                        print(f"Migration for {col} on chat_history failed: {e}")

def get_db():
    """Database dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
