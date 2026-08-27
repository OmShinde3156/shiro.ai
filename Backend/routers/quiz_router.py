from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database.database import get_db
from services.quiz_service import QuizService
from services.progress_service import ProgressService
from models.schema import QuizRequest, QuizResponse, QuizSubmissionRequest, QuizResultResponse
from models.database import User
from utils.auth import get_current_user, get_authorized_document

router = APIRouter(tags=["Quiz"])

def get_quiz_service():
    return QuizService()

def get_progress_service():
    return ProgressService()

@router.post("/generate-quiz", response_model=QuizResponse)
async def generate_quiz(
    request: QuizRequest, 
    db: Session = Depends(get_db), 
    quiz_service: QuizService = Depends(get_quiz_service),
    current_user: User = Depends(get_current_user)
):
    """Generate quiz from document with authorization check"""
    try:
        get_authorized_document(request.document_id, current_user.id, db)
        return await quiz_service.generate_quiz_from_document(request.document_id, request.num_questions, request.difficulty, db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/submit-quiz", response_model=QuizResultResponse)
async def submit_quiz(
    submission: QuizSubmissionRequest,
    db: Session = Depends(get_db),
    quiz_service: QuizService = Depends(get_quiz_service),
    progress_service: ProgressService = Depends(get_progress_service),
    current_user: User = Depends(get_current_user)
):
    """Submit quiz answers and get results"""
    try:
        result = quiz_service.evaluate_quiz(submission, db)
        await progress_service.update_quiz_progress(current_user.id, submission.document_id, result, db)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/quiz-history/{user_id}")
async def get_quiz_history(
    user_id: int, 
    db: Session = Depends(get_db), 
    quiz_service: QuizService = Depends(get_quiz_service),
    current_user: User = Depends(get_current_user)
):
    """Get quiz history for a user (scoped to current user)"""
    return quiz_service.get_quiz_history(current_user.id, db)

