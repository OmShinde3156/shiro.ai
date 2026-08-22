from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional, List
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
    FlashcardRequest, FlashcardSetResponse, FlashcardStudyRequest, FlashcardStudyResponse,
    ChatRequest, ChatResponse,
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
from utils.auth import get_current_user
from models.database import User

# ==============================================
# QUIZ ENDPOINTS
# ==============================================

@router.post("/generate-quiz", response_model=QuizResponse, tags=["Quiz"])
async def generate_quiz(request: QuizRequest, db: Session = Depends(get_db), quiz_service: QuizService = Depends(get_quiz_service)):
    try:
        return await quiz_service.generate_quiz_from_document(request.document_id, request.num_questions, request.difficulty, db)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/submit-quiz", response_model=QuizResultResponse, tags=["Quiz"])
async def submit_quiz(submission: QuizSubmissionRequest, db: Session = Depends(get_db), quiz_service: QuizService = Depends(get_quiz_service), progress_service: ProgressService = Depends(get_progress_service), current_user: User = Depends(get_current_user)):
    try:
        result = quiz_service.evaluate_quiz(submission, db)
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
async def generate_flashcards(request: FlashcardRequest, db: Session = Depends(get_db), flashcard_service: FlashcardService = Depends(get_flashcard_service)):
    try:
        return await flashcard_service.generate_flashcards_from_document(request.document_id, request.num_cards, db)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/study-flashcard", response_model=FlashcardStudyResponse, tags=["Flashcards"])
async def study_flashcard(study_request: FlashcardStudyRequest, db: Session = Depends(get_db), flashcard_service: FlashcardService = Depends(get_flashcard_service), current_user: User = Depends(get_current_user)):
    try:
        study_request.user_id = current_user.id # inject back for service if needed, wait, schema doesn't have it.
        # Let's see if flashcard_service uses user_id. We'll pass current_user.id if needed, but wait, study_flashcard takes study_request.
        return flashcard_service.study_flashcard(study_request, db, current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/flashcards/review", tags=["Flashcards"])
async def get_flashcards_for_review(db: Session = Depends(get_db), flashcard_service: FlashcardService = Depends(get_flashcard_service), current_user: User = Depends(get_current_user)):
    return flashcard_service.get_cards_for_review(current_user.id, db)

# ==============================================
# CHAT ENDPOINTS
# ==============================================

@router.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat_with_tutor(chat_request: ChatRequest, db: Session = Depends(get_db), chat_service: ChatService = Depends(get_chat_service), current_user: User = Depends(get_current_user)):
    try:
        return await chat_service.chat_with_documents(
            current_user.id, chat_request.message, chat_request.document_ids,
            chat_request.language, db, chat_request.mode
        )
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/chat-history", tags=["Chat"])
async def get_chat_history(limit: int = 50, db: Session = Depends(get_db), chat_service: ChatService = Depends(get_chat_service), current_user: User = Depends(get_current_user)):
    return chat_service.get_chat_history(current_user.id, limit, db)

# ==============================================
# SUMMARIZATION ENDPOINTS
# ==============================================

@router.post("/summarize", response_model=SummaryResponse, tags=["Summary"])
async def summarize_document(request: SummaryRequest, db: Session = Depends(get_db), summarizer_service: SummarizerService = Depends(get_summarizer_service)):
    try:
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
    task_id = podcast_service.create_podcast_task(current_user.id, request.document_ids, request.episodes, request.language, request.topic, db)
    return {"task_id": task_id, "status": "processing"}

@router.get("/podcast-status/{task_id}", tags=["Podcast"])
async def get_podcast_status(task_id: str, db: Session = Depends(get_db), podcast_service: PodcastService = Depends(get_podcast_service)):
    return podcast_service.get_task_status(task_id, db)

@router.get("/podcasts", tags=["Podcast"])
async def get_user_podcasts(db: Session = Depends(get_db), podcast_service: PodcastService = Depends(get_podcast_service), current_user: User = Depends(get_current_user)):
    return podcast_service.get_user_podcasts(current_user.id, db)

@router.delete("/podcasts/{podcast_id}", tags=["Podcast"])
async def delete_podcast(podcast_id: str, db: Session = Depends(get_db), podcast_service: PodcastService = Depends(get_podcast_service)):
    success = podcast_service.delete_podcast(podcast_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Podcast not found")
    return {"status": "success", "message": "Podcast deleted successfully"}

# ==============================================
# MIND MAP ENDPOINTS
# ==============================================

@router.post("/generate-mindmap", response_model=MindMapResponse, tags=["MindMap"])
async def generate_mindmap(request: MindMapRequest, db: Session = Depends(get_db), mindmap_service: MindMapService = Depends(get_mindmap_service)):
    try:
        return await mindmap_service.generate_mindmap(request.document_id, request.topic, request.depth, db)
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mindmaps", tags=["MindMap"])
async def get_user_mindmaps(db: Session = Depends(get_db), mindmap_service: MindMapService = Depends(get_mindmap_service), current_user: User = Depends(get_current_user)):
    return mindmap_service.get_user_mindmaps(current_user.id, db)

@router.get("/mindmap-details/{mindmap_id}", tags=["MindMap"])
async def get_specific_mindmap(mindmap_id: str, db: Session = Depends(get_db)):
    mindmap = db.query(MindMap).filter(MindMap.id == mindmap_id).first()
    if not mindmap:
        raise HTTPException(status_code=404, detail="Mind map not found")
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
# PROGRESS ENDPOINTS
# ==============================================

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

@router.post("/feynman/challenge", tags=["Feynman"])
async def get_feynman_challenge(document_ids: str = Form("[]"), db: Session = Depends(get_db), feynman_service: FeynmanService = Depends(get_feynman_service), current_user: User = Depends(get_current_user)):
    import json
    try:
        doc_ids = json.loads(document_ids)
        return await feynman_service.get_challenge_concept(current_user.id, doc_ids, db)
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'Error: {e}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/feynman/evaluate", tags=["Feynman"])
async def evaluate_feynman_explanation(concept_name: str = Form(...), explanation: str = Form(...), db: Session = Depends(get_db), feynman_service: FeynmanService = Depends(get_feynman_service), current_user: User = Depends(get_current_user)):
    try:
        return await feynman_service.evaluate_explanation(current_user.id, concept_name, explanation, db)
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
async def text_to_speech_endpoint(request: dict):
    text = request.get("text", "")
    lang = request.get("lang", "en")
    filename = f"shiro_{uuid.uuid4().hex}.mp3"
    filepath = os.path.join("static", filename)
    try:
        tts_client.text_to_speech(text, filepath, lang=lang)
        return {"url": f"{os.getenv('BASE_URL', 'http://127.0.0.1:8000')}/static/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stt", tags=["Voice"])
async def speech_to_text(audio: UploadFile = File(...), language: Optional[str] = Form(None), task: str = Form("transcribe")):
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
async def translate_content(request: TranslationRequest):
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

@router.post("/answer-planner", response_model=AnswerPlannerResponse, tags=["Answer Planner"])
async def plan_answer(request: AnswerPlannerRequest, db: Session = Depends(get_db), planner_service: AnswerPlannerService = Depends(get_answer_planner_service)):
    try:
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
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
