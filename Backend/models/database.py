from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Boolean, ForeignKey, JSON
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
    upload_date = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    user = relationship("User", back_populates="documents")

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
    flashcards = Column(JSON)  # Store flashcards as JSON
    created_at = Column(DateTime, default=datetime.utcnow)

class FlashcardProgress(Base):
    __tablename__ = "flashcard_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    flashcard_id = Column(String, nullable=False)
    ease_factor = Column(Float, default=2.5)
    interval_days = Column(Integer, default=1)
    next_review = Column(DateTime)
    review_count = Column(Integer, default=0)
    last_reviewed = Column(DateTime)
    
    # Relationships
    user = relationship("User", back_populates="flashcard_progress")

class ChatHistory(Base):
    __tablename__ = "chat_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    document_ids = Column(JSON)  # List of document IDs used
    language = Column(String, default="en")
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
    created_at = Column(DateTime, default=datetime.utcnow)

class Podcast(Base):
    __tablename__ = "podcasts"
    
    id = Column(String, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    episodes = Column(JSON)  # List of episode file paths
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
    created_at = Column(DateTime, default=datetime.utcnow)
