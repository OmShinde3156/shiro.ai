from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Boolean, ForeignKey, JSON, Numeric
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False, default="password123")
    avatar_url = Column(String, nullable=True) # Custom profile picture path
    preferred_language = Column(String, default="en")
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    ai_quota_daily = Column(Integer, default=50) # Daily AI request quota (AI-01)
    
    # Personal BYOK API Keys (Server-Side Encrypted)
    groq_api_key_encrypted = Column(Text, nullable=True)
    gemini_api_key_encrypted = Column(Text, nullable=True)
    openai_api_key_encrypted = Column(Text, nullable=True)
    preferred_ai_provider = Column(String, default="auto") # "auto", "groq", "gemini", "openai"
    byok_enabled = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    quiz_results = relationship("QuizResult", back_populates="user", cascade="all, delete-orphan")
    flashcard_progress = relationship("FlashcardProgress", back_populates="user", cascade="all, delete-orphan")
    chat_history = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    subject = Column(String)
    text_content = Column(Text, nullable=False)
    vector_db_id = Column(String)  # ChromaDB collection ID
    file_url = Column(String, nullable=True) # Path to the stored static PDF file
    source_url = Column(String, nullable=True) # Original URL (YT/Web)
    video_id = Column(String, nullable=True) # Extracted YouTube ID
    content_hash = Column(String, nullable=True, index=True) # Hash of content for idempotence
    version = Column(Integer, default=1, nullable=False) # Document version for provenance (RAG-01)
    upload_date = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    user = relationship("User", back_populates="documents")

class AIRequestLog(Base):
    __tablename__ = "ai_request_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True) # UUID
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    feature = Column(String, nullable=False, index=True) # "quiz", "flashcards", "chat", "summary", "mindmap"
    provider = Column(String, nullable=False) # "groq", "gemini", "openai", "fallback"
    model = Column(String, nullable=False)
    rate_card_version = Column(String, default="2026-Q3")
    prompt_version = Column(String, default="v1.0")
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    latency_ms = Column(Integer, default=0)
    cost_usd = Column(Numeric(12, 8), default=0.0)
    fallback_used = Column(Boolean, default=False)
    billing_source = Column(String, default="platform") # "platform" | "personal"
    success = Column(Boolean, default=True)
    error_code = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User")


class Quiz(Base):
    __tablename__ = "quizzes"
    
    id = Column(String, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    questions = Column(JSON)  # Store questions as JSON
    difficulty = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class QuizResult(Base):
    __tablename__ = "quiz_results"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    document_id = Column(Integer, ForeignKey("documents.id"))
    quiz_id = Column(String, ForeignKey("quizzes.id"))
    score = Column(Float, nullable=False)
    total_questions = Column(Integer, nullable=False)
    answers = Column(JSON)  # Store user answers
    taken_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="quiz_results")

class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"
    
    id = Column(String, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    flashcards = relationship("Flashcard", back_populates="set", cascade="all, delete-orphan")

class Flashcard(Base):
    __tablename__ = "flashcards"
    
    id = Column(String, primary_key=True)
    set_id = Column(String, ForeignKey("flashcard_sets.id"))
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    set = relationship("FlashcardSet", back_populates="flashcards")
    progress = relationship("FlashcardProgress", back_populates="flashcard", cascade="all, delete-orphan")

class FlashcardProgress(Base):
    __tablename__ = "flashcard_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    flashcard_id = Column(String, ForeignKey("flashcards.id"))
    
    # Legacy SM-2 fields (kept for backward compatibility or migration)
    ease_factor = Column(Float, default=2.5)
    interval_days = Column(Integer, default=0) # 0 means new
    review_count = Column(Integer, default=0)
    
    # FSRS fields
    fsrs_state = Column(Integer, default=0) # State: 0=New, 1=Learning, 2=Review, 3=Relearning
    fsrs_stability = Column(Float, default=0.0)
    fsrs_difficulty = Column(Float, default=0.0)
    fsrs_elapsed_days = Column(Integer, default=0)
    fsrs_scheduled_days = Column(Integer, default=0)
    fsrs_reps = Column(Integer, default=0)
    fsrs_lapses = Column(Integer, default=0)
    
    next_review = Column(DateTime, default=datetime.utcnow)
    last_reviewed = Column(DateTime)
    
    # Relationships
    user = relationship("User", back_populates="flashcard_progress")
    flashcard = relationship("Flashcard", back_populates="progress")

class FlashcardReview(Base):
    __tablename__ = "flashcard_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    flashcard_id = Column(String, ForeignKey("flashcards.id"), nullable=False, index=True)
    idempotency_key = Column(String, nullable=True, index=True)
    rating = Column(Integer, nullable=False) # 1=Again, 2=Hard, 3=Good, 4=Easy
    review_duration_ms = Column(Integer, default=0)
    fsrs_state_before = Column(Integer, default=0)
    fsrs_state_after = Column(Integer, default=0)
    stability_after = Column(Float, default=0.0)
    difficulty_after = Column(Float, default=0.0)
    reviewed_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User")
    flashcard = relationship("Flashcard")

class DocumentIngestionJob(Base):
    __tablename__ = "document_ingestion_jobs"
    
    id = Column(String, primary_key=True) # UUID
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, default="QUEUED", index=True) # QUEUED, EXTRACTING, CHUNKING, EMBEDDING, GRAPH_BUILDING, INDEXED, FAILED
    current_step = Column(String, default="INITIALIZED")
    progress = Column(Integer, default=0) # 0-100%
    attempt = Column(Integer, default=1)
    max_attempts = Column(Integer, default=3)
    error_code = Column(String, nullable=True) # e.g. CORRUPT_DOCUMENT, PROVIDER_TIMEOUT
    error_message = Column(Text, nullable=True) # Sanitized user-safe message
    celery_task_id = Column(String, nullable=True)
    queued_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    document = relationship("Document", backref="ingestion_jobs")
    user = relationship("User")

class ChatHistory(Base):

    __tablename__ = "chat_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    document_ids = Column(JSON)  # List of document IDs used
    language = Column(String, default="en")
    status = Column(String, default="completed")  # completed, stopped, failed
    latency_ms = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="chat_history")

class Summary(Base):
    __tablename__ = "summaries"
    
    id = Column(String, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    summary_text = Column(Text, nullable=False)
    summary_type = Column(String, nullable=False)
    language = Column(String, default="en")
    status = Column(String, default="processing") # processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)

class Podcast(Base):
    __tablename__ = "podcasts"
    
    id = Column(String, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=True)
    subject = Column(String, default="General")
    episodes = Column(JSON)  # List of episode objects or paths
    script_content = Column(Text)
    language = Column(String, default="en")
    status = Column(String, default="processing")  # processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)

class MindMap(Base):
    __tablename__ = "mindmaps"
    
    id = Column(String, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    topic = Column(String, nullable=False)
    nodes = Column(JSON)  # Mind map nodes
    edges = Column(JSON)  # Mind map edges
    created_at = Column(DateTime, default=datetime.utcnow)

class StudyTimetable(Base):
    __tablename__ = "study_timetables"
    
    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    exam_date = Column(DateTime, nullable=False)
    daily_schedule = Column(JSON)  # Detailed daily schedule
    subjects = Column(JSON)  # Subject priorities and hours
    crash_course = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class TimetableProgress(Base):
    __tablename__ = "timetable_progress"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    timetable_id = Column(String, ForeignKey("study_timetables.id"))
    task_id = Column(String, nullable=False)
    completed = Column(Boolean, default=False)
    hours_studied = Column(Float, default=0.0)
    completion_date = Column(DateTime)

# Shiro v2.5: Graph-Augmented RAG Models
class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    label = Column(String, nullable=False, index=True) # Concept Name (e.g. "Mitochondria")
    description = Column(Text, nullable=True)
    importance_score = Column(Float, default=0.5)
    created_at = Column(DateTime, default=datetime.utcnow)

class KnowledgeEdge(Base):
    __tablename__ = "knowledge_edges"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    source_node_id = Column(Integer, ForeignKey("knowledge_nodes.id"))
    target_node_id = Column(Integer, ForeignKey("knowledge_nodes.id"))
    relation = Column(String, nullable=False) # e.g. "contains", "results_in", "instance_of"
    weight = Column(Float, default=1.0)
    confidence_score = Column(Float, default=1.0) # From Architect extraction
    created_at = Column(DateTime, default=datetime.utcnow)

class LibraryInsight(Base):
    __tablename__ = "library_insights"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String, nullable=False) # "contradiction", "synergy", "suggestion"
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    source_doc_ids = Column(JSON) # List of doc IDs involved
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# Shiro v2.5: Multiplayer Study Rooms
class StudyRoom(Base):
    __tablename__ = "study_rooms"
    
    id = Column(String, primary_key=True)  # Room code, e.g., "DSA-GRAPH-123"
    name = Column(String, nullable=False)
    subject = Column(String)
    description = Column(String)
    is_public = Column(Boolean, default=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    document = relationship("Document")
    members = relationship("RoomMember", back_populates="room", cascade="all, delete-orphan")
    messages = relationship("RoomMessage", back_populates="room", cascade="all, delete-orphan")
    host = relationship("User")

class RoomMember(Base):
    __tablename__ = "room_members"
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String, ForeignKey("study_rooms.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    joined_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Relationships
    room = relationship("StudyRoom", back_populates="members")
    user = relationship("User")

class RoomMessage(Base):
    __tablename__ = "room_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String, ForeignKey("study_rooms.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # None for AI
    client_message_id = Column(String, index=True, nullable=True) # Client idempotency key (WS-01)
    sequence = Column(Integer, default=1, index=True, nullable=False) # Total room ordering sequence (WS-01)
    is_ai = Column(Boolean, default=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    room = relationship("StudyRoom", back_populates="messages")
    user = relationship("User")


class StudyPack(Base):
    __tablename__ = "study_packs"
    
    id = Column(String, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Store all the 12 sections as JSON
    pack_data = Column(JSON)  # Contains detailed_notes, glossary, timeline, cheat_sheet, etc.
    
    status = Column(String, default="processing")  # processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)

