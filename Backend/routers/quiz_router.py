from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database.database import get_db
from services.quiz_service import QuizService
from services.progress_service import ProgressService
from models.schema import QuizRequest, QuizResponse, QuizSubmissionRequest, QuizResultResponse

router = APIRouter(tags=["Quiz"])

def get_quiz_service():
    return QuizService()

def get_progress_service():
    return ProgressService()

@router.post("/generate-quiz", response_model=QuizResponse)
async def generate_quiz(request: QuizRequest, db: Session = Depends(get_db), quiz_service: QuizService = Depends(get_quiz_service)):
    """Generate quiz from document"""
    try:
        return await quiz_service.generate_quiz_from_document(request.document_id, request.num_questions, request.difficulty, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/submit-quiz", response_model=QuizResultResponse)
async def submit_quiz(
    submission: QuizSubmissionRequest,
    db: Session = Depends(get_db),
    quiz_service: QuizService = Depends(get_quiz_service),
    progress_service: ProgressService = Depends(get_progress_service)
):
    """Submit quiz answers and get results"""
    try:
        result = quiz_service.evaluate_quiz(submission, db)
        await progress_service.update_quiz_progress(submission.user_id, submission.document_id, result, db)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/quiz-history/{user_id}")
async def get_quiz_history(user_id: int, db: Session = Depends(get_db), quiz_service: QuizService = Depends(get_quiz_service)):
    """Get quiz history for a user"""
    return quiz_service.get_quiz_history(user_id, db)

@router.post("/important-questions")
async def get_important_questions(
    user_id: int = None,
    document_id: int = None,
    num_questions: int = 15,
    db: Session = Depends(get_db),
    quiz_service: QuizService = Depends(get_quiz_service),
):
    """Generate important questions based on document content"""
    try:
        from fastapi import Form, File, UploadFile
        questions = await quiz_service.generate_important_questions(document_id, None, num_questions, db)
        return questions
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
