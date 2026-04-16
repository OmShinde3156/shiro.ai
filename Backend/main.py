from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import List, Optional
import uvicorn
from datetime import datetime
import os

from dotenv import load_dotenv
# Load .env file explicitly from the directory where main.py is located
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from database.database import get_db, init_db, Base, engine
from services.pdf_service import PDFService
from services.user_service import UserService
from services.quiz_service import QuizService
from services.flashcard_service import FlashcardService
from services.chat_service import ChatService
from services.summarizer_service import SummarizerService
from services.podcast_service import PodcastService
from services.mindmap_service import MindMapService
from services.progress_service import ProgressService
from services.timetable_service import TimetableService
from models.schema import *
from sqlalchemy.orm import Session
from models.database import Document, Podcast


# ✅ Define app first
app = FastAPI(title="Personalized Study Guide Generator", version="1.0.0")

# ✅ Create all tables
Base.metadata.create_all(bind=engine) 

# ✅ Mount static AFTER app is defined
app.mount("/static", StaticFiles(directory="static"), name="static") 

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    # Ensure guest user exists for the "skip login" feature
    db = next(get_db())
    try:
        from models.database import User
        guest = db.query(User).filter(User.id == 1).first()
        if not guest:
            guest = User(id=1, name="Guest User", email="guest@study.ai", password="password123")
            db.add(guest)
            db.commit()
            print("Created default Guest User (ID: 1)")
    except Exception as e:
        print(f"Error creating guest user: {e}")
    finally:
        db.close()

# Dependency injection
def get_pdf_service():
    return PDFService()

def get_user_service():
    return UserService()

# ==============================================
# AUTHENTICATION ENDPOINTS
# ==============================================

@app.post("/login", response_model=UserResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Login user (Auto-creates if not exists)"""
    try:
        user = user_service.login(request, db)
        return user
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/users", response_model=UserResponse)
async def create_user(
    request: UserCreate,
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Create new user"""
    try:
        user = user_service.create_user(request, db)
        return user
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Get user details"""
    user = user_service.get_user(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def get_quiz_service():
    return QuizService()

def get_flashcard_service():
    return FlashcardService()

def get_chat_service():
    return ChatService()

def get_summarizer_service():
    return SummarizerService()

def get_podcast_service():
    return PodcastService()

def get_mindmap_service():
    return MindMapService()

def get_progress_service():
    return ProgressService()

def get_timetable_service():
    return TimetableService()


# ==============================================
# DOCUMENT UPLOAD & PROCESSING ENDPOINTS
# ==============================================

        

@app.post("/upload-document", response_model=List[DocumentResponse])
async def upload_document(
    files: List[UploadFile] = File(...),
    user_id: Optional[int] = Form(None),
    subject: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    pdf_service: PDFService = Depends(get_pdf_service)
):
    """Upload and process PDF/DOCX/Image files"""
    print(f"DEBUG: Received upload request. Files: {[f.filename for f in files]}, UserID: {user_id}, Subject: {subject}")
    
    # Fallback to guest user ID 1 if not provided
    effective_user_id = user_id or 1
    
    try:
        results = []
        for file in files:
            result = await pdf_service.process_document(file, effective_user_id, subject or "General", db)
            print(f"Document uploaded successfully: ID={result.id}, UserID={result.user_id}, Filename={result.filename}")
            results.append(result)
        return results
    except Exception as e:
        import traceback
        print(f"Error processing document: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/documents/{user_id}", response_model=List[DocumentResponse])
async def get_user_documents(
    user_id: int,
    db: Session = Depends(get_db),
    pdf_service: PDFService = Depends(get_pdf_service)
):
    """Get all documents uploaded by a user"""
    return pdf_service.get_user_documents(user_id, db)

@app.get("/documents/{user_id}/{document_id}", response_model=DocumentResponse)
async def get_document_details(
    user_id: int,
    document_id: int,
    db: Session = Depends(get_db),
    pdf_service: PDFService = Depends(get_pdf_service)
):
    """Get specific document by ID for a user"""
    document = pdf_service.get_document_by_id(document_id, db)
    if not document or document.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@app.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    pdf_service: PDFService = Depends(get_pdf_service)
):
    """Delete a document by ID"""
    try:
        success = pdf_service.delete_document(document_id, db)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        return {"message": "Document deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/documents/{document_id}/subject")
async def update_document_subject(
    document_id: int,
    subject: str = Form(...),
    db: Session = Depends(get_db),
    pdf_service: PDFService = Depends(get_pdf_service)
):
    """Update document subject"""
    try:
        document = pdf_service.update_subject(document_id, subject, db)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        return document
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==============================================
# QUIZ ENDPOINTS
# ==============================================

@app.post("/generate-quiz", response_model=QuizResponse)
async def generate_quiz(
    request: QuizRequest,
    db: Session = Depends(get_db),
    quiz_service: QuizService = Depends(get_quiz_service)
):
    """Generate quiz from document"""
    try:
        quiz = await quiz_service.generate_quiz_from_document(
            request.document_id, request.num_questions, request.difficulty, db
        )
        return quiz
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/submit-quiz", response_model=QuizResultResponse)
async def submit_quiz(
    submission: QuizSubmissionRequest,
    db: Session = Depends(get_db),
    quiz_service: QuizService = Depends(get_quiz_service),
    progress_service: ProgressService = Depends(get_progress_service)
):
    """Submit quiz answers and get results"""
    try:
        result = quiz_service.evaluate_quiz(submission, db)
        # Update progress
        await progress_service.update_quiz_progress(
            submission.user_id, submission.document_id, result, db
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/quiz-history/{user_id}")
async def get_quiz_history(
    user_id: int,
    db: Session = Depends(get_db),
    quiz_service: QuizService = Depends(get_quiz_service)
):
    """Get quiz history for a user"""
    return quiz_service.get_quiz_history(user_id, db)

# ==============================================
# FLASHCARD ENDPOINTS
# ==============================================

@app.post("/generate-flashcards", response_model=FlashcardSetResponse)
async def generate_flashcards(
    request: FlashcardRequest,
    db: Session = Depends(get_db),
    flashcard_service: FlashcardService = Depends(get_flashcard_service)
):
    """Generate flashcards from document"""
    try:
        flashcards = await flashcard_service.generate_flashcards_from_document(
            request.document_id, request.num_cards, db
        )
        return flashcards
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/study-flashcard", response_model=FlashcardStudyResponse)
async def study_flashcard(
    study_request: FlashcardStudyRequest,
    db: Session = Depends(get_db),
    flashcard_service: FlashcardService = Depends(get_flashcard_service)
):
    """Record flashcard study session with spaced repetition"""
    try:
        return flashcard_service.study_flashcard(study_request, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/flashcards/review/{user_id}")
async def get_flashcards_for_review(
    user_id: int,
    db: Session = Depends(get_db),
    flashcard_service: FlashcardService = Depends(get_flashcard_service)
):
    """Get flashcards due for review based on spaced repetition"""
    return flashcard_service.get_cards_for_review(user_id, db)

# ==============================================
# CHAT/TUTOR ENDPOINTS
# ==============================================

@app.post("/chat", response_model=ChatResponse)
async def chat_with_tutor(
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Chat with AI tutor using RAG from uploaded documents"""
    try:
        response = await chat_service.chat_with_documents(
            chat_request.user_id,
            chat_request.message,
            chat_request.document_ids,
            chat_request.language,
            db
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/chat-history/{user_id}")
async def get_chat_history(
    user_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    chat_service: ChatService = Depends(get_chat_service)
):
    """Get chat history for a user"""
    return chat_service.get_chat_history(user_id, limit, db)

@app.post("/speak")
async def text_to_speech_endpoint(
    request: Dict[str, str],
    background_tasks: BackgroundTasks
):
    """Convert text to speech and return the audio URL"""
    from utils.tts_client import tts_client
    import uuid
    
    text = request.get("text", "")
    filename = f"voice_{uuid.uuid4().hex}.mp3"
    filepath = os.path.join("static", filename)
    
    tts_client.text_to_speech(text, filepath)
    
    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    return {"url": f"{base_url}/static/{filename}"}

# ==============================================
# SUMMARIZATION ENDPOINTS
# ==============================================

@app.post("/summarize", response_model=SummaryResponse)
async def summarize_document(
    request: SummaryRequest,
    db: Session = Depends(get_db),
    summarizer_service: SummarizerService = Depends(get_summarizer_service)
):
    """Generate summary from document"""
    try:
        summary = await summarizer_service.generate_summary(
            request.document_id, request.summary_type, request.language, db
        )
        return summary
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/summaries/{user_id}")
async def get_user_summaries(
    user_id: int,
    db: Session = Depends(get_db),
    summarizer_service: SummarizerService = Depends(get_summarizer_service)
):
    """Get all summaries created by user"""
    return summarizer_service.get_user_summaries(user_id, db)

# ==============================================
# PODCAST ENDPOINTS
# ==============================================

@app.post("/generate-podcast")
async def generate_podcast(
    request: PodcastRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    podcast_service: PodcastService = Depends(get_podcast_service)
):
    task_id = podcast_service.create_podcast_task(
        request.user_id, request.document_ids, request.episodes, request.language, request.topic, db
    )

    podcast = db.query(Podcast).filter(Podcast.id == task_id).first()
    document = db.query(Document).filter(Document.id.in_(request.document_ids)).first()

    background_tasks.add_task(
        podcast_service.generate_podcast,
        podcast, document, db
    )

    return {"task_id": task_id, "status": "processing"}



@app.get("/podcast-status/{task_id}")
async def get_podcast_status(
    task_id: str,
    db: Session = Depends(get_db),
    podcast_service: PodcastService = Depends(get_podcast_service)
):
    """Check podcast generation status"""
    return podcast_service.get_task_status(task_id, db)


@app.get("/podcasts/{user_id}")
async def get_user_podcasts(
    user_id: int,
    db: Session = Depends(get_db),
    podcast_service: PodcastService = Depends(get_podcast_service)
):
    """Get all podcasts generated by user"""
    return podcast_service.get_user_podcasts(user_id, db)

# ==============================================
# MIND MAP ENDPOINTS
# ==============================================

@app.post("/generate-mindmap", response_model=MindMapResponse)
async def generate_mindmap(
    request: MindMapRequest,
    db: Session = Depends(get_db),
    mindmap_service: MindMapService = Depends(get_mindmap_service)
):
    """Generate mind map from document"""
    try:
        mindmap = await mindmap_service.generate_mindmap(
            request.document_id, request.topic, request.depth, db
        )
        return mindmap
    except Exception as e:
        import traceback
        print(f"Error generating mindmap: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/mindmaps/{user_id}")
async def get_user_mindmaps(
    user_id: int,
    db: Session = Depends(get_db),
    mindmap_service: MindMapService = Depends(get_mindmap_service)
):
    """Get all mind maps created by user"""
    return mindmap_service.get_user_mindmaps(user_id, db)
# Add this endpoint to your main.py file in the MIND MAP ENDPOINTS section

@app.get("/mindmaps/{mindmap_id}")
async def get_specific_mindmap(
    mindmap_id: str,
    db: Session = Depends(get_db)
):
    """Get specific mind map by ID"""
    from models.database import MindMap
    
    mindmap = db.query(MindMap).filter(MindMap.id == mindmap_id).first()
    if not mindmap:
        raise HTTPException(status_code=404, detail="Mind map not found")
    
    return {
        "mindmap_id": mindmap.id,
        "document_id": mindmap.document_id,
        "nodes": mindmap.nodes or [],
        "edges": mindmap.edges or [],
        "topic": mindmap.topic,
        "created_at": mindmap.created_at
    }
# ==============================================
# PROGRESS & ANALYTICS ENDPOINTS
# ==============================================

@app.get("/progress/{user_id}", response_model=UserProgressResponse)
async def get_user_progress(
    user_id: int,
    db: Session = Depends(get_db),
    progress_service: ProgressService = Depends(get_progress_service)
):
    """Get comprehensive user progress and analytics"""
    return await progress_service.get_user_progress(user_id, db)

@app.get("/dashboard/{user_id}")
async def get_dashboard_data(
    user_id: int,
    db: Session = Depends(get_db),
    progress_service: ProgressService = Depends(get_progress_service)
):
    """Get dashboard data including streaks, heatmaps, weak subjects"""
    return await progress_service.get_dashboard_data(user_id, db)

@app.post("/request-otp")
async def request_otp(
    request: UserOTPRequest,
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Request login OTP"""
    # For now, simulate sending OTP as requested for ease of use
    return {"message": "OTP sent successfully (Simulated)"}

@app.post("/verify-otp", response_model=UserResponse)
async def verify_otp(
    request: OTPVerifyRequest,
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Verify OTP and login"""
    # For now, just find user by email as simulation
    from models.database import User
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/activity/{user_id}")
async def get_user_activity(
    user_id: int,
    db: Session = Depends(get_db),
    progress_service: ProgressService = Depends(get_progress_service)
):
    """Get chronological user activity history"""
    return await progress_service.get_user_activity(user_id, db)

@app.post("/important-questions")
async def get_important_questions(
    file: Optional[UploadFile] = File(None),
    user_id: int = Form(...),
    document_id: int = Form(...),
    num_questions: int = Form(15),
    db: Session = Depends(get_db),
    quiz_service: QuizService = Depends(get_quiz_service),
    pdf_service: PDFService = Depends(get_pdf_service)
):
    """Generate important questions based on PYQs and document content"""
    try:
        pyq_document_id = None
        if file:
            # Process the uploaded PYQ document
            pyq_doc_result = await pdf_service.process_document(file, user_id, "PYQ", db)
            pyq_document_id = pyq_doc_result.id

        questions = await quiz_service.generate_important_questions(
            document_id, pyq_document_id, num_questions, db
        )
        return questions
    except Exception as e:
        import traceback
        print(f"Error generating important questions: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

# ==============================================
# TIMETABLE & STUDY PLAN ENDPOINTS
# ==============================================

@app.post("/create-timetable", response_model=TimetableResponse)
async def create_study_timetable(
    request: TimetableRequest,
    db: Session = Depends(get_db),
    timetable_service: TimetableService = Depends(get_timetable_service)
):
    """Create personalized study timetable"""
    try:
        timetable = await timetable_service.create_timetable(request, db)
        return timetable
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/timetable/{user_id}")
async def get_user_timetable(
    user_id: int,
    db: Session = Depends(get_db),
    timetable_service: TimetableService = Depends(get_timetable_service)
):
    """Get user's current study timetable"""
    return timetable_service.get_user_timetable(user_id, db)

@app.post("/update-timetable-progress")
async def update_timetable_progress(
    request: TimetableProgressRequest,
    db: Session = Depends(get_db),
    timetable_service: TimetableService = Depends(get_timetable_service)
):
    """Update progress on timetable tasks"""
    try:
        return timetable_service.update_task_progress(request, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==============================================
# MULTILINGUAL SUPPORT ENDPOINTS
# ==============================================

@app.post("/translate")
async def translate_content(
    request: TranslationRequest,
    db: Session = Depends(get_db)
):
    """Translate content to different languages"""
    from services.translation_service import TranslationService
    translation_service = TranslationService()
    try:
        result = await translation_service.translate_content(
            request.content, request.target_language, request.content_type
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==============================================
# HEALTH CHECK
# ==============================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)