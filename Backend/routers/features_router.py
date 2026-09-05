from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
import uuid, os

from database.database import get_db
from services.quiz_service import QuizService
from services.pdf_service import PDFService
from services.flashcard_service import FlashcardService
from services.chat_service import ChatService
from services.summarizer_service import SummarizerService
from services.podcast_service import PodcastService
from services.mindmap_service import MindMapService
from services.progress_service import ProgressService
from services.timetable_service import TimetableService
from services.feynman_service import FeynmanService
from services.swarm_service import SwarmService
from services.answer_planner_service import AnswerPlannerService
from utils.tts_client import tts_client
from utils.stt_client import stt_client
from models.schema import (
    FlashcardRequest, FlashcardSetResponse, FlashcardStudyRequest, FlashcardStudyResponse, FlashcardHistoryResponse,
    ChatRequest, ChatResponse, DocumentProfileResponse,
    SummaryRequest, SummaryResponse,
    PodcastRequest,
    MindMapRequest, MindMapResponse,
    UserProgressResponse,
    TimetableRequest, TimetableResponse, TimetableProgressRequest,
    TranslationRequest, QuizRequest, QuizResponse, QuizResultResponse, QuizSubmissionRequest,
    AddXPRequest, AnswerPlannerRequest, AnswerPlannerResponse
)
from models.database import Document, Podcast, MindMap

router = APIRouter()

# ---- Dependency factories ----
def get_flashcard_service(): return FlashcardService()
def get_chat_service(): return ChatService()
def get_summarizer_service(): return SummarizerService()
def get_podcast_service(): return PodcastService()
def get_mindmap_service(): return MindMapService()
def get_progress_service(): return ProgressService()
def get_timetable_service(): return TimetableService()
def get_feynman_service(): return FeynmanService()
def get_quiz_service(): return QuizService()
def get_swarm_service(): return SwarmService()
def get_answer_planner_service(): return AnswerPlannerService()
from utils.auth import get_current_user, get_authorized_document
from models.database import User

# ==============================================
# QUIZ ENDPOINTS
# ==============================================

@router.post("/generate-quiz", response_model=QuizResponse, tags=["Quiz"])
async def generate_quiz(
    request: QuizRequest, 
    db: Session = Depends(get_db), 
    quiz_service: QuizService = Depends(get_quiz_service),
    current_user: User = Depends(get_current_user)
):
    """Generate quiz with centralized document authorization (SEC-03)"""
    try:
        # Enforce document ownership
        get_authorized_document(request.document_id, current_user.id, db)
        return await quiz_service.generate_quiz_from_document(request.document_id, request.num_questions, request.difficulty, db, user_id=current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/submit-quiz", response_model=QuizResultResponse, tags=["Quiz"])
async def submit_quiz(submission: QuizSubmissionRequest, db: Session = Depends(get_db), quiz_service: QuizService = Depends(get_quiz_service), progress_service: ProgressService = Depends(get_progress_service), current_user: User = Depends(get_current_user)):
    try:
        result = quiz_service.evaluate_quiz(submission, db, user_id=current_user.id)
        await progress_service.update_quiz_progress(current_user.id, submission.document_id, result, db)
        return result
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/quiz-history", tags=["Quiz"])
async def get_quiz_history(db: Session = Depends(get_db), quiz_service: QuizService = Depends(get_quiz_service), current_user: User = Depends(get_current_user)):
    return quiz_service.get_quiz_history(current_user.id, db)

# ==============================================
# FLASHCARD ENDPOINTS
# ==============================================

@router.post("/generate-flashcards", response_model=FlashcardSetResponse, tags=["Flashcards"])
async def generate_flashcards(
    request: FlashcardRequest, 
    db: Session = Depends(get_db), 
    flashcard_service: FlashcardService = Depends(get_flashcard_service),
    current_user: User = Depends(get_current_user)
):
    """Generate flashcards with centralized document authorization (SEC-03)"""
    try:
        get_authorized_document(request.document_id, current_user.id, db)
        return await flashcard_service.generate_flashcards_from_document(request.document_id, request.num_cards, db, user_id=current_user.id)
    except HTTPException:
        raise

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/study-flashcard", response_model=FlashcardStudyResponse, tags=["Flashcards"])
async def study_flashcard(study_request: FlashcardStudyRequest, db: Session = Depends(get_db), flashcard_service: FlashcardService = Depends(get_flashcard_service), current_user: User = Depends(get_current_user)):
    try:
        return flashcard_service.study_flashcard(study_request, db, current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

class FlashcardReviewDirectRequest(BaseModel):
    flashcard_id: str
    rating: Optional[int] = 3
    ease_rating: Optional[int] = None
    review_duration_ms: Optional[int] = 0

@router.get("/flashcards/review", tags=["Flashcards"])
async def get_flashcards_for_review(db: Session = Depends(get_db), flashcard_service: FlashcardService = Depends(get_flashcard_service), current_user: User = Depends(get_current_user)):
    return flashcard_service.get_cards_for_review(current_user.id, db)

@router.post("/flashcards/review", tags=["Flashcards"])
async def review_flashcard_alias(
    request: FlashcardReviewDirectRequest,
    db: Session = Depends(get_db),
    flashcard_service: FlashcardService = Depends(get_flashcard_service),
    progress_service: ProgressService = Depends(get_progress_service),
    current_user: User = Depends(get_current_user)
):
    effective_rating = request.ease_rating if request.ease_rating is not None else (request.rating or 3)
    study_req = FlashcardStudyRequest(
        flashcard_id=request.flashcard_id,
        ease_rating=effective_rating,
        review_duration_ms=request.review_duration_ms or 0
    )
    res = flashcard_service.study_flashcard(study_req, db, current_user.id)
    try:
        await progress_service.add_xp(current_user.id, 10, db)
    except Exception:
        pass
    return res

@router.get("/flashcards/{flashcard_id}/history", response_model=FlashcardHistoryResponse, tags=["Flashcards"])
async def get_flashcard_review_history(
    flashcard_id: str, 
    db: Session = Depends(get_db), 
    flashcard_service: FlashcardService = Depends(get_flashcard_service), 
    current_user: User = Depends(get_current_user)
):
    """Retrieve immutable chronological review history for forgetting curve reconstruction (DATA-01)"""
    return flashcard_service.get_review_history(flashcard_id, current_user.id, db)

from fastapi.responses import StreamingResponse

# ==============================================
# CHAT ENDPOINTS
# ==============================================

@router.post("/chat/stream", tags=["Chat"])
async def stream_chat_with_tutor(
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    chat_service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user)
):
    """
    Real-Time Server-Sent Events (SSE) Streaming Chat Endpoint across all Context Scopes.
    Yields typed SSE events: status -> citation -> token -> action -> done.
    """
    try:
        # Verify ownership of all requested documents
        if chat_request.document_ids:
            for doc_id in chat_request.document_ids:
                get_authorized_document(doc_id, current_user.id, db)
        if chat_request.active_document_id:
            get_authorized_document(chat_request.active_document_id, current_user.id, db)

        lang_val = chat_request.language.value if hasattr(chat_request.language, 'value') else (chat_request.language or "en")

        return StreamingResponse(
            chat_service.stream_chat_with_documents(
                user_id=current_user.id,
                message=chat_request.message,
                document_ids=chat_request.document_ids or [],
                active_document_id=chat_request.active_document_id,
                context_scope=chat_request.context_scope or "GLOBAL",
                room_id=chat_request.room_id,
                selected_text=chat_request.selected_text,
                language=str(lang_val),
                db=db,
                mode=chat_request.mode or "human",
                response_style=chat_request.response_style or "balanced",
                use_examples=chat_request.use_examples if chat_request.use_examples is not None else True,
                explain_terms=chat_request.explain_terms if chat_request.explain_terms is not None else True,
                ask_followups=chat_request.ask_followups if chat_request.ask_followups is not None else True,
                learning_goal=chat_request.learning_goal,
                current_level=chat_request.current_level
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Stream endpoint error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat_with_tutor(
    chat_request: ChatRequest, 
    db: Session = Depends(get_db), 
    chat_service: ChatService = Depends(get_chat_service), 
    current_user: User = Depends(get_current_user)
):
    try:
        # Verify ownership of all requested documents
        if chat_request.document_ids:
            for doc_id in chat_request.document_ids:
                get_authorized_document(doc_id, current_user.id, db)
        if chat_request.active_document_id:
            get_authorized_document(chat_request.active_document_id, current_user.id, db)

        return await chat_service.chat_with_documents(
            user_id=current_user.id,
            message=chat_request.message,
            document_ids=chat_request.document_ids or [],
            active_document_id=chat_request.active_document_id,
            context_scope=chat_request.context_scope or "GLOBAL",
            room_id=chat_request.room_id,
            selected_text=chat_request.selected_text,
            language=chat_request.language,
            db=db,
            mode=chat_request.mode or "human",
            response_style=chat_request.response_style or "balanced",
            use_examples=chat_request.use_examples if chat_request.use_examples is not None else True,
            explain_terms=chat_request.explain_terms if chat_request.explain_terms is not None else True,
            ask_followups=chat_request.ask_followups if chat_request.ask_followups is not None else True,
            learning_goal=chat_request.learning_goal,
            current_level=chat_request.current_level
        )
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/documents/{document_id}/profile", response_model=DocumentProfileResponse, tags=["Documents"])
async def get_document_profile(
    document_id: int,
    db: Session = Depends(get_db),
    chat_service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user)
):
    """Get study time estimation, word count, difficulty, and key topics for a document"""
    get_authorized_document(document_id, current_user.id, db)
    return chat_service.get_document_profile(document_id, current_user.id, db)

@router.get("/chat-history", tags=["Chat"])
async def get_chat_history(limit: int = 50, db: Session = Depends(get_db), chat_service: ChatService = Depends(get_chat_service), current_user: User = Depends(get_current_user)):
    return chat_service.get_chat_history(current_user.id, limit, db)

# ==============================================
# SUMMARIZATION ENDPOINTS
# ==============================================

@router.post("/summarize", response_model=SummaryResponse, tags=["Summary"])
async def summarize_document(
    request: SummaryRequest, 
    db: Session = Depends(get_db), 
    summarizer_service: SummarizerService = Depends(get_summarizer_service),
    current_user: User = Depends(get_current_user)
):
    """Summarize document with centralized document authorization (SEC-03)"""
    try:
        get_authorized_document(request.document_id, current_user.id, db)
        return await summarizer_service.generate_summary(request.document_id, request.summary_type, request.language, db)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/summaries", tags=["Summary"])
async def get_user_summaries(db: Session = Depends(get_db), summarizer_service: SummarizerService = Depends(get_summarizer_service), current_user: User = Depends(get_current_user)):
    return summarizer_service.get_user_summaries(current_user.id, db)

# ==============================================
# PODCAST ENDPOINTS
# ==============================================

@router.post("/generate-podcast", tags=["Podcast"])
async def generate_podcast(request: PodcastRequest, db: Session = Depends(get_db), podcast_service: PodcastService = Depends(get_podcast_service), current_user: User = Depends(get_current_user)):
    # Verify ownership of requested documents
    if request.document_ids:
        for doc_id in request.document_ids:
            get_authorized_document(doc_id, current_user.id, db)
            
    task_id = podcast_service.create_podcast_task(
        user_id=current_user.id, 
        document_ids=request.document_ids, 
        episodes=request.episodes, 
        language=request.language, 
        topic=request.topic, 
        db=db,
        mode=request.mode,
        narrator_voice=request.narrator_voice,
        duration=request.duration,
        custom_title=request.custom_title,
        subject=request.subject
    )
    return {"task_id": task_id, "status": "processing"}

@router.get("/podcast-status/{task_id}", tags=["Podcast"])
async def get_podcast_status(task_id: str, db: Session = Depends(get_db), podcast_service: PodcastService = Depends(get_podcast_service)):
    return podcast_service.get_task_status(task_id, db)

@router.get("/podcasts", tags=["Podcast"])
async def get_user_podcasts(db: Session = Depends(get_db), podcast_service: PodcastService = Depends(get_podcast_service), current_user: User = Depends(get_current_user)):
    return podcast_service.get_user_podcasts(current_user.id, db)

@router.delete("/podcasts/{podcast_id}", tags=["Podcast"])
async def delete_podcast(
    podcast_id: str, 
    db: Session = Depends(get_db), 
    podcast_service: PodcastService = Depends(get_podcast_service),
    current_user: User = Depends(get_current_user)
):
    """Delete podcast with owner authorization check"""
    podcast = db.query(Podcast).filter(Podcast.id == podcast_id, Podcast.user_id == current_user.id).first()
    if not podcast:
        raise HTTPException(status_code=404, detail="Podcast not found or access denied")
        
    success = podcast_service.delete_podcast(podcast_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Podcast not found")
    return {"status": "success", "message": "Podcast deleted successfully"}

# ==============================================
# MIND MAP ENDPOINTS
# ==============================================

@router.post("/generate-mindmap", response_model=MindMapResponse, tags=["MindMap"])
async def generate_mindmap(
    request: MindMapRequest, 
    db: Session = Depends(get_db), 
    mindmap_service: MindMapService = Depends(get_mindmap_service),
    current_user: User = Depends(get_current_user)
):
    """Generate mind map with centralized document authorization (SEC-03)"""
    try:
        get_authorized_document(request.document_id, current_user.id, db)
        return await mindmap_service.generate_mindmap(request.document_id, request.topic, request.depth, db)
    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mindmaps", tags=["MindMap"])
async def get_user_mindmaps(db: Session = Depends(get_db), mindmap_service: MindMapService = Depends(get_mindmap_service), current_user: User = Depends(get_current_user)):
    return mindmap_service.get_user_mindmaps(current_user.id, db)

@router.get("/mindmap-details/{mindmap_id}", tags=["MindMap"])
async def get_specific_mindmap(
    mindmap_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get mind map with owner authorization check"""
    mindmap = db.query(MindMap).filter(MindMap.id == mindmap_id, MindMap.user_id == current_user.id).first()
    if not mindmap:
        raise HTTPException(status_code=404, detail="Mind map not found or access denied")
    return {"mindmap_id": mindmap.id, "document_id": mindmap.document_id, "nodes": mindmap.nodes or [], "edges": mindmap.edges or [], "topic": mindmap.topic, "created_at": mindmap.created_at}


# ==============================================
# SWARM / INSIGHT ENDPOINTS
# ==============================================

@router.get("/insights", tags=["Swarm"])
async def get_library_insights(db: Session = Depends(get_db), swarm_service: SwarmService = Depends(get_swarm_service), current_user: User = Depends(get_current_user)):
    return swarm_service.get_user_insights(current_user.id, db)

@router.post("/insights/analyze", tags=["Swarm"])
async def trigger_swarm_analysis(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from tasks import run_swarm_analysis_task
    run_swarm_analysis_task.delay(current_user.id)
    return {"status": "analysis_triggered"}

@router.post("/insights/read/{insight_id}", tags=["Swarm"])
async def mark_insight_as_read(insight_id: int, db: Session = Depends(get_db), swarm_service: SwarmService = Depends(get_swarm_service)):
    if swarm_service.mark_insight_read(insight_id, db):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Insight not found")

# ==============================================
# PERSONAL API KEYS (BYOK) ENDPOINTS
# ==============================================

from pydantic import BaseModel

class SaveAPIKeysRequest(BaseModel):
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    preferred_provider: Optional[str] = "auto"
    byok_enabled: Optional[bool] = True

class ValidateAPIKeyRequest(BaseModel):
    provider: str
    api_key: str

@router.get("/api-keys", tags=["BYOK"])
async def get_user_api_keys(
    current_user: User = Depends(get_current_user)
):
    """Get masked BYOK status for the authenticated user without exposing secrets"""
    from utils.security import decrypt_secret, mask_api_key
    
    groq_plain = decrypt_secret(current_user.groq_api_key_encrypted) if current_user.groq_api_key_encrypted else None
    gemini_plain = decrypt_secret(current_user.gemini_api_key_encrypted) if current_user.gemini_api_key_encrypted else None
    openai_plain = decrypt_secret(current_user.openai_api_key_encrypted) if current_user.openai_api_key_encrypted else None

    return {
        "has_groq_key": bool(groq_plain),
        "groq_masked": mask_api_key(groq_plain, "groq") if groq_plain else None,
        "has_gemini_key": bool(gemini_plain),
        "gemini_masked": mask_api_key(gemini_plain, "gemini") if gemini_plain else None,
        "has_openai_key": bool(openai_plain),
        "openai_masked": mask_api_key(openai_plain, "openai") if openai_plain else None,
        "preferred_provider": current_user.preferred_ai_provider or "auto",
        "byok_enabled": bool(current_user.byok_enabled)
    }

@router.post("/api-keys", tags=["BYOK"])
async def save_user_api_keys(
    request: SaveAPIKeysRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Securely encrypt and store personal API keys for the authenticated user"""
    from utils.security import encrypt_secret, decrypt_secret, mask_api_key

    if request.groq_api_key is not None:
        if request.groq_api_key.strip():
            current_user.groq_api_key_encrypted = encrypt_secret(request.groq_api_key.strip())
        else:
            current_user.groq_api_key_encrypted = None

    if request.gemini_api_key is not None:
        if request.gemini_api_key.strip():
            current_user.gemini_api_key_encrypted = encrypt_secret(request.gemini_api_key.strip())
        else:
            current_user.gemini_api_key_encrypted = None

    if request.openai_api_key is not None:
        if request.openai_api_key.strip():
            current_user.openai_api_key_encrypted = encrypt_secret(request.openai_api_key.strip())
        else:
            current_user.openai_api_key_encrypted = None

    if request.preferred_provider is not None:
        current_user.preferred_ai_provider = request.preferred_provider

    if request.byok_enabled is not None:
        current_user.byok_enabled = request.byok_enabled

    db.commit()
    db.refresh(current_user)

    groq_plain = decrypt_secret(current_user.groq_api_key_encrypted) if current_user.groq_api_key_encrypted else None
    gemini_plain = decrypt_secret(current_user.gemini_api_key_encrypted) if current_user.gemini_api_key_encrypted else None
    openai_plain = decrypt_secret(current_user.openai_api_key_encrypted) if current_user.openai_api_key_encrypted else None

    return {
        "status": "success",
        "message": "Personal API keys securely encrypted and updated",
        "has_groq_key": bool(groq_plain),
        "groq_masked": mask_api_key(groq_plain, "groq") if groq_plain else None,
        "has_gemini_key": bool(gemini_plain),
        "gemini_masked": mask_api_key(gemini_plain, "gemini") if gemini_plain else None,
        "has_openai_key": bool(openai_plain),
        "openai_masked": mask_api_key(openai_plain, "openai") if openai_plain else None,
        "preferred_provider": current_user.preferred_ai_provider or "auto",
        "byok_enabled": bool(current_user.byok_enabled)
    }

@router.delete("/api-keys/{provider}", tags=["BYOK"])
async def delete_user_api_key(
    provider: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a personal API key and revert provider to platform quota"""
    from utils.security import decrypt_secret, mask_api_key

    prov = provider.lower().strip()
    if prov == "groq":
        current_user.groq_api_key_encrypted = None
    elif prov == "gemini":
        current_user.gemini_api_key_encrypted = None
    elif prov == "openai":
        current_user.openai_api_key_encrypted = None
    else:
        raise HTTPException(status_code=400, detail=f"Invalid provider '{provider}'")

    db.commit()
    db.refresh(current_user)

    groq_plain = decrypt_secret(current_user.groq_api_key_encrypted) if current_user.groq_api_key_encrypted else None
    gemini_plain = decrypt_secret(current_user.gemini_api_key_encrypted) if current_user.gemini_api_key_encrypted else None
    openai_plain = decrypt_secret(current_user.openai_api_key_encrypted) if current_user.openai_api_key_encrypted else None

    return {
        "status": "success",
        "message": f"{provider.capitalize()} API key removed. Reverted to platform quota.",
        "has_groq_key": bool(groq_plain),
        "groq_masked": mask_api_key(groq_plain, "groq") if groq_plain else None,
        "has_gemini_key": bool(gemini_plain),
        "gemini_masked": mask_api_key(gemini_plain, "gemini") if gemini_plain else None,
        "has_openai_key": bool(openai_plain),
        "openai_masked": mask_api_key(openai_plain, "openai") if openai_plain else None,
        "preferred_provider": current_user.preferred_ai_provider or "auto",
        "byok_enabled": bool(current_user.byok_enabled)
    }

@router.post("/api-keys/validate", tags=["BYOK"])
async def validate_api_key(
    request: ValidateAPIKeyRequest,
    current_user: User = Depends(get_current_user)
):
    """Validate a personal API key against the provider API in real-time"""
    from utils.llm_client import llm_client
    return await llm_client.validate_api_key(request.provider.lower().strip(), request.api_key.strip())

# ==============================================
# PROGRESS & STUDENT INSIGHTS ENDPOINTS
# ==============================================

@router.get("/student-insights", tags=["Progress"])
@router.get("/api/student-insights", tags=["Progress"])
async def get_student_insights(
    db: Session = Depends(get_db),
    progress_service: ProgressService = Depends(get_progress_service),
    current_user: User = Depends(get_current_user)
):
    """
    Unified Student Learning Health & Decision Engine:
    Returns aggregated mastery, weak areas, deterministic 1-click recovery payload,
    topic matrix, accuracy trend with session milestones, and evidence-based study window.
    """
    return await progress_service.get_student_insights(current_user.id, db)

@router.get("/progress", response_model=UserProgressResponse, tags=["Progress"])
async def get_user_progress(db: Session = Depends(get_db), progress_service: ProgressService = Depends(get_progress_service), current_user: User = Depends(get_current_user)):
    return await progress_service.get_user_progress(current_user.id, db)

@router.post("/progress/xp", tags=["Progress"])
async def add_xp(request: AddXPRequest, db: Session = Depends(get_db), progress_service: ProgressService = Depends(get_progress_service), current_user: User = Depends(get_current_user)):
    try:
        return await progress_service.add_xp(current_user.id, request.xp_amount, db)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/dashboard", tags=["Progress"])
async def get_dashboard_data(db: Session = Depends(get_db), progress_service: ProgressService = Depends(get_progress_service), current_user: User = Depends(get_current_user)):
    return await progress_service.get_dashboard_data(current_user.id, db)

@router.get("/activity", tags=["Progress"])
async def get_user_activity(db: Session = Depends(get_db), progress_service: ProgressService = Depends(get_progress_service), current_user: User = Depends(get_current_user)):
    return await progress_service.get_user_activity(current_user.id, db)

# ==============================================
# TIMETABLE ENDPOINTS
# ==============================================

@router.post("/create-timetable", response_model=TimetableResponse, tags=["Timetable"])
async def create_study_timetable(request: TimetableRequest, db: Session = Depends(get_db), timetable_service: TimetableService = Depends(get_timetable_service), current_user: User = Depends(get_current_user)):
    try:
        return await timetable_service.create_timetable(request, db, current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/timetable", tags=["Timetable"])
async def get_user_timetable(db: Session = Depends(get_db), timetable_service: TimetableService = Depends(get_timetable_service), current_user: User = Depends(get_current_user)):
    return timetable_service.get_user_timetable(current_user.id, db)

@router.post("/update-timetable-progress", tags=["Timetable"])
async def update_timetable_progress(request: TimetableProgressRequest, db: Session = Depends(get_db), timetable_service: TimetableService = Depends(get_timetable_service), current_user: User = Depends(get_current_user)):
    try:
        return timetable_service.update_task_progress(request, db, current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

# ==============================================
# FEYNMAN ENDPOINTS
# ==============================================

@router.get("/feynman/concepts", tags=["Feynman"])
async def get_feynman_concepts(
    document_id: int,
    db: Session = Depends(get_db),
    feynman_service: FeynmanService = Depends(get_feynman_service),
    current_user: User = Depends(get_current_user)
):
    """Fetch available conceptual topics for a document to allow student selection."""
    get_authorized_document(document_id, current_user.id, db)
    return await feynman_service.get_available_concepts(current_user.id, document_id, db)

@router.post("/feynman/challenge", tags=["Feynman"])
async def get_feynman_challenge(
    document_ids: str = Form("[]"), 
    concept_name: Optional[str] = Form(None),
    challenge_type: Optional[str] = Form(None),
    db: Session = Depends(get_db), 
    feynman_service: FeynmanService = Depends(get_feynman_service), 
    current_user: User = Depends(get_current_user)
):
    """Get pedagogical Feynman challenge with customizable concept and challenge type"""
    import json
    try:
        doc_ids = json.loads(document_ids) if document_ids else []
        if doc_ids:
            for d_id in doc_ids:
                get_authorized_document(d_id, current_user.id, db)
        return await feynman_service.get_challenge_concept(
            user_id=current_user.id, 
            document_ids=doc_ids, 
            concept_name=concept_name,
            challenge_type=challenge_type,
            db=db
        )
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/feynman/evaluate", tags=["Feynman"])
async def evaluate_feynman_explanation(
    concept_name: str = Form(...), 
    explanation: str = Form(...), 
    challenge_title: Optional[str] = Form(None),
    challenge_prompt: Optional[str] = Form(None),
    previous_gaps: Optional[str] = Form(None),
    db: Session = Depends(get_db), 
    feynman_service: FeynmanService = Depends(get_feynman_service), 
    current_user: User = Depends(get_current_user)
):
    """Evaluate student explanation across 5 diagnostic dimensions with follow-up generation"""
    try:
        return await feynman_service.evaluate_explanation(
            user_id=current_user.id, 
            concept_name=concept_name, 
            explanation=explanation, 
            challenge_title=challenge_title,
            challenge_prompt=challenge_prompt,
            previous_gaps=previous_gaps,
            db=db
        )
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

# ==============================================
# VOICE & AUDIO ENDPOINTS
# ==============================================

@router.post("/speak", tags=["Voice"])
async def text_to_speech_endpoint(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    text = request.get("text", "")
    lang = request.get("lang", "en")
    voice = request.get("voice", None)
    rate = request.get("rate", None)
    pitch = request.get("pitch", None)
    filename = f"shiro_{uuid.uuid4().hex}.mp3"
    filepath = os.path.join("static", filename)
    try:
        await tts_client.text_to_speech_async(text, filepath, lang=lang, voice=voice, rate=rate, pitch=pitch)
        return {"url": f"{os.getenv('BASE_URL', 'http://127.0.0.1:8000')}/static/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/voice-samples", tags=["Voice"])
async def list_voice_benchmark_samples():
    """Returns generated candidate voice benchmark samples for auditory evaluation."""
    samples_dir = os.path.join("static", "voice_samples")
    if not os.path.exists(samples_dir):
        return {"samples": []}
    files = [f for f in os.listdir(samples_dir) if f.endswith(".mp3")]
    base_url = os.getenv("BASE_URL", "http://127.0.0.1:8000")
    return {
        "samples": [
            {
                "filename": f,
                "url": f"{base_url}/static/voice_samples/{f}"
            }
            for f in sorted(files)
        ]
    }

@router.post("/stt", tags=["Voice"])
async def speech_to_text(
    audio: UploadFile = File(...), 
    language: Optional[str] = Form(None), 
    task: str = Form("transcribe"),
    current_user: User = Depends(get_current_user)
):
    technical_prompt = "Shiro.ai, RAG, Feynman Technique, SM-2 Spaced Repetition, Knowledge Graph, Mind Map, Active Recall."
    temp_filename = f"temp_{uuid.uuid4().hex}_{audio.filename}"
    temp_path = os.path.join("static", temp_filename)
    try:
        content = await audio.read()
        with open(temp_path, "wb") as f:
            f.write(content)
        text = stt_client.speech_to_text(temp_path, language=language if language != "auto" else None, task=task, prompt=technical_prompt)
        if os.path.exists(temp_path): os.remove(temp_path)
        return {"text": text}
    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

# ==============================================
# TRANSLATION ENDPOINT
# ==============================================

@router.post("/translate", tags=["Translation"])
async def translate_content(
    request: TranslationRequest,
    current_user: User = Depends(get_current_user)
):
    from services.translation_service import TranslationService
    try:
        return await TranslationService().translate_content(request.content, request.target_language, request.content_type)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

# ==============================================
# ANSWER PLANNER ENDPOINT
# ==============================================

@router.post("/features/answer-planner", response_model=AnswerPlannerResponse, tags=["Answer Planner"])
@router.post("/answer-planner", response_model=AnswerPlannerResponse, tags=["Answer Planner"])
async def plan_answer(
    request: AnswerPlannerRequest, 
    db: Session = Depends(get_db), 
    planner_service: AnswerPlannerService = Depends(get_answer_planner_service),
    current_user: User = Depends(get_current_user)
):
    """Generate answer plan with optional document authorization check"""
    try:
        if request.document_id:
            get_authorized_document(request.document_id, current_user.id, db)

        result = await planner_service.full_pipeline(
            request.question, request.marks, request.subject, request.answer_type, request.document_id, db
        )
        return {
            "question": request.question,
            "marks": request.marks,
            "plan": result["plan"],
            "final_answer": result["final_answer"],
            "verification": [v.model_dump() if hasattr(v, 'model_dump') else v for v in result["verification"]],
            "confidence": result["confidence"]
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

