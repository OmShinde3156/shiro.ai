from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional

from database.database import get_db
from services.pdf_service import PDFService
from models.schema import DocumentResponse

from services.summarizer_service import SummarizerService
from services.quiz_service import QuizService
from services.mindmap_service import MindMapService

router = APIRouter(tags=["Documents"])

def get_pdf_service(): return PDFService()
def get_summarizer_service(): return SummarizerService()
def get_quiz_service(): return QuizService()
def get_mindmap_service(): return MindMapService()

@router.post("/upload-document", response_model=List[DocumentResponse])
async def upload_document(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    user_id: Optional[int] = Form(None),
    subject: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    pdf_service: PDFService = Depends(get_pdf_service)
):
    """Upload and process PDF/DOCX/Image files"""
    effective_user_id = user_id or 1
    try:
        results = []
        for file in files:
            result = await pdf_service.process_document(file, effective_user_id, subject or "General", db, background_tasks)
            results.append(result)
        return results
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/documents/{user_id}", response_model=List[DocumentResponse])
async def get_user_documents(user_id: int, db: Session = Depends(get_db), pdf_service: PDFService = Depends(get_pdf_service)):
    """Get all documents uploaded by a user"""
    return pdf_service.get_user_documents(user_id, db)

@router.get("/documents/{user_id}/{document_id}", response_model=DocumentResponse)
async def get_document_details(
    user_id: int, 
    document_id: int, 
    db: Session = Depends(get_db), 
    pdf_service: PDFService = Depends(get_pdf_service),
    summarizer_service: SummarizerService = Depends(get_summarizer_service),
    quiz_service: QuizService = Depends(get_quiz_service),
    mindmap_service: MindMapService = Depends(get_mindmap_service)
):
    """Get specific document by ID with all associated study materials"""
    document = pdf_service.get_document_by_id(document_id, db)
    if not document or document.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Fetch latest study materials
    summary = summarizer_service.get_latest_summary_for_document(document_id, db)
    quiz = quiz_service.get_latest_quiz_for_document(document_id, db)
    mindmap = mindmap_service.get_latest_mindmap_for_document(document_id, db)
    
    return DocumentResponse(
        id=document.id,
        filename=document.filename,
        file_type=document.file_type,
        subject=document.subject,
        text_content=document.text_content,
        upload_date=document.upload_date,
        user_id=document.user_id,
        summary=summary,
        quiz=quiz,
        mindmap=mindmap
    )

@router.delete("/documents/{document_id}")
async def delete_document(document_id: int, db: Session = Depends(get_db), pdf_service: PDFService = Depends(get_pdf_service)):
    """Delete a document by ID"""
    try:
        success = pdf_service.delete_document(document_id, db)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        return {"message": "Document deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/documents/{document_id}/subject")
async def update_document_subject(document_id: int, subject: str = Form(...), db: Session = Depends(get_db), pdf_service: PDFService = Depends(get_pdf_service)):
    """Update document subject"""
    try:
        document = pdf_service.update_subject(document_id, subject, db)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        return document
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
