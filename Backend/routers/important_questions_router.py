from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from database.database import get_db
from services.quiz_service import QuizService
from services.pdf_service import PDFService
from models.database import User
from utils.auth import get_current_user, get_authorized_document

router = APIRouter(prefix="/api/important-questions", tags=["Important Questions"])

def get_quiz_service():
    return QuizService()

def get_pdf_service():
    return PDFService()

@router.post("/generate")
async def generate_important_questions(
    document_id: int = Form(...),
    pyq_file: Optional[UploadFile] = File(None),
    num_questions: int = Form(15),
    db: Session = Depends(get_db),
    quiz_service: QuizService = Depends(get_quiz_service),
    pdf_service: PDFService = Depends(get_pdf_service),
    current_user: User = Depends(get_current_user)
):
    """
    Generate highly optimized important questions by cross-referencing 
    document content with Previous Year Questions (PYQs).
    Protected with centralized document authorization (SEC-03).
    """
    try:
        # Enforce document ownership
        get_authorized_document(document_id, current_user.id, db)

        pyq_document_id = None
        if pyq_file:
            # Process the uploaded PYQ document for current user
            pyq_doc_result = await pdf_service.process_document(pyq_file, current_user.id, "PYQ", db)
            pyq_document_id = pyq_doc_result.id

        questions = await quiz_service.generate_optimized_important_questions(
            document_id=document_id,
            pyq_document_id=pyq_document_id,
            num_questions=num_questions,
            db=db,
            user_id=current_user.id
        )
        return questions
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

