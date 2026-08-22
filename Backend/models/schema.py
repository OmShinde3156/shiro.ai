from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

class SummaryType(str, Enum):
    SHORT = "short"
    DETAILED = "detailed"
    BULLET_POINTS = "bullet_points"

class Language(str, Enum):
    ENGLISH = "en"
    HINDI = "hi"
    MARATHI = "mr"

# User Schemas
class UserCreate(BaseModel):
    name: str
    email: str
    password: str = "password123"
    preferred_language: Language = Language.ENGLISH

class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = "password123"

class UserOTPRequest(BaseModel):
    email: str

class OTPVerifyRequest(BaseModel):
    email: str
    code: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    preferred_language: str
    xp: int = 0
    level: int = 1
    created_at: datetime
    
    class Config:
        from_attributes = True

# Document Schemas
class DocumentResponse(BaseModel):
    id: int
    filename: str
    file_type: str
    subject: Optional[str]
    text_content: str
    upload_date: datetime
    user_id: int
    file_url: Optional[str] = None
    source_url: Optional[str] = None
    video_id: Optional[str] = None
    summary: Optional[Any] = None
    mindmap: Optional[Any] = None
    quiz: Optional[Any] = None
    
    class Config:
        from_attributes = True

# Quiz Schemas
class QuizRequest(BaseModel):
    document_id: int
    num_questions: int = Field(default=10, ge=1, le=50)
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM

class QuizQuestion(BaseModel):
    id: str
    question: str
    options: Dict[str, str]
    correct_answer: str

class QuizResponse(BaseModel):
    quiz_id: str
    document_id: int
    questions: List[QuizQuestion]
    created_at: datetime

class QuizSubmissionRequest(BaseModel):
    document_id: int
    quiz_id: str
    answers: Dict[str, str]  # question_id -> answer

class QuizResultResponse(BaseModel):
    quiz_id: str
    score: float
    total_questions: int
    correct_answers: int
    incorrect_answers: List[Dict[str, Any]]
    suggestions: List[str]

# Flashcard Schemas
class FlashcardRequest(BaseModel):
    document_id: int
    num_cards: int = Field(default=20, ge=1, le=100)

class Flashcard(BaseModel):
    id: str
    question: str
    answer: str
    difficulty: int = 0
    next_review: datetime

class FlashcardSetResponse(BaseModel):
    set_id: str
    document_id: int
    flashcards: List[Flashcard]
    created_at: datetime

class FlashcardStudyRequest(BaseModel):
    flashcard_id: str
    ease_rating: int = Field(ge=1, le=5)  # 1=hard, 5=easy

class FlashcardStudyResponse(BaseModel):
    flashcard_id: str
    next_review_date: datetime
    interval_days: int

# Chat Schemas
class ChatRequest(BaseModel):
    message: str
    document_ids: List[int]
    language: Language = Language.ENGLISH
    mode: str = "human" # "human" or "surgical"

class ChatResponse(BaseModel):
    response: str
    internal_thought: Optional[str] = None
    sources: List[Dict[str, Any]]
    language: str

# Summary Schemas
class SummaryRequest(BaseModel):
    document_id: int
    summary_type: SummaryType = SummaryType.DETAILED
    language: Language = Language.ENGLISH

class SummaryResponse(BaseModel):
    summary_id: str
    document_id: int
    summary_text: str
    summary_type: str
    language: str
    created_at: datetime

# Podcast Schemas
class PodcastRequest(BaseModel):
    document_ids: List[int]
    episodes: int = Field(default=1, ge=1, le=10)
    language: Language = Language.ENGLISH
    topic: Optional[str] = None

# Mind Map Schemas
class MindMapRequest(BaseModel):
    document_id: int
    topic: Optional[str] = None
    depth: int = Field(default=3, ge=1, le=5)

class MindMapNode(BaseModel):
    id: str
    label: str
    x: float
    y: float
    level: int
    score: Optional[float] = 0.8

class MindMapEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None

class MindMapResponse(BaseModel):
    mindmap_id: str
    document_id: int
    nodes: List[MindMapNode]
    edges: List[MindMapEdge]
    topic: str
    created_at: datetime

# Progress Schemas
class UserProgressResponse(BaseModel):
    user_id: int
    total_documents: int
    quizzes_taken: int
    average_score: float
    flashcards_studied: int
    study_streak: int
    xp: int = 0
    level: int = 1
    weak_subjects: List[str]
    strong_subjects: List[str]
    weekly_activity: Dict[str, int]
    knowledge_heatmap: Dict[str, float]

class AddXPRequest(BaseModel):
    xp_amount: int

# Important Questions Schema
class ImportantQuestionsRequest(BaseModel):
    document_id: int
    pyq_document_id: Optional[int] = None
    num_questions: int = Field(default=15, ge=5, le=50)

# Timetable Schemas
class TimetableRequest(BaseModel):
    exam_date: datetime
    subjects: List[Dict[str, Any]]  # [{"name": "Math", "priority": 1, "hours_needed": 20}]
    study_hours_per_day: int = 4
    crash_course: bool = False

class TimetableResponse(BaseModel):
    timetable_id: str
    user_id: int
    exam_date: datetime
    daily_schedule: Dict[str, List[Dict[str, Any]]]
    created_at: datetime

class TimetableProgressRequest(BaseModel):
    timetable_id: str
    task_id: str
    completed: bool
    hours_studied: float

# Translation Schema
class TranslationRequest(BaseModel):
    content: str
    target_language: Language
    content_type: str = "text"

# Answer Planner Schemas
class AnswerPlannerRequest(BaseModel):
    question: str
    marks: int = Field(default=5, ge=1, le=20)
    document_id: int
    answer_type: str = "descriptive"
    subject: str = "General"

class AnswerPlannerResponse(BaseModel):
    question: str
    marks: int
    plan: Dict[str, Any]
    final_answer: str
    verification: List[Dict[str, Any]]
    confidence: float
