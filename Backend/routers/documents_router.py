from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional

from database.database import get_db
from services.pdf_service import PDFService
from models.schema import DocumentResponse, DocumentIngestionStatusResponse
from utils.auth import get_current_user
from models.database import User

from services.summarizer_service import SummarizerService
from services.quiz_service import QuizService
from services.mindmap_service import MindMapService
from services.research_service import research_service

router = APIRouter(tags=["Documents"])

def get_pdf_service(): return PDFService()
def get_summarizer_service(): return SummarizerService()
def get_quiz_service(): return QuizService()
def get_mindmap_service(): return MindMapService()

@router.post("/upload-document", response_model=List[DocumentResponse])
@router.post("/documents/upload", response_model=List[DocumentResponse])
@router.post("/api/documents/upload", response_model=List[DocumentResponse])
async def upload_document(
    background_tasks: BackgroundTasks,
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    subject: Optional[str] = Form(None),
    user_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    pdf_service: PDFService = Depends(get_pdf_service),
    current_user: User = Depends(get_current_user)
):
    """Upload and process any document format (PDF, DOCX, DOC, PPTX, PPT, CSV, XLSX, Images, Markdown, Code)"""
    effective_user_id = current_user.id if current_user else (user_id or 1)
    
    # Collect all provided files
    all_files: List[UploadFile] = []
    if files:
        all_files.extend([f for f in files if f.filename])
    if file and file.filename:
        all_files.append(file)

    if not all_files:
        raise HTTPException(status_code=400, detail="No valid file provided for upload.")

    try:
        results = []
        for f in all_files:
            result = await pdf_service.process_document(f, effective_user_id, subject or "General", db, background_tasks)
            results.append(result)
        return results
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/upload-url", response_model=DocumentResponse)
async def upload_url(
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    subject: str = Form("General"),
    db: Session = Depends(get_db),
    pdf_service: PDFService = Depends(get_pdf_service),
    current_user: User = Depends(get_current_user)
):
    """Ingest content from a URL (YouTube or Website)"""
    try:
        source_url = url
        video_id = None
        if "youtube.com" in url or "youtu.be" in url:
            title, content = await research_service.get_youtube_content(url)
            video_id = research_service.extract_youtube_id(url)
            doc_type = "youtube"
        else:
            title, content = await research_service.get_web_content(url)
            doc_type = "web"

        # Create Document record
        document, is_new = pdf_service.save_document_to_db(current_user.id, title, content, subject, doc_type, db, source_url=source_url, video_id=video_id)
        
        if is_new:
            # Trigger background embedding only for NEW documents
            background_tasks.add_task(
                pdf_service.process_document_background,
                document.id, content, current_user.id
            )
        else:
            print(f"DEBUG: Skipping background processing for existing document {document.id}")
            
        return document
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/documents", response_model=List[DocumentResponse])
async def get_user_documents(db: Session = Depends(get_db), pdf_service: PDFService = Depends(get_pdf_service), current_user: User = Depends(get_current_user)):
    """Get all documents uploaded by a user"""
    return pdf_service.get_user_documents(current_user.id, db)

@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document_details(
    document_id: int, 
    db: Session = Depends(get_db), 
    pdf_service: PDFService = Depends(get_pdf_service),
    summarizer_service: SummarizerService = Depends(get_summarizer_service),
    quiz_service: QuizService = Depends(get_quiz_service),
    mindmap_service: MindMapService = Depends(get_mindmap_service),
    current_user: User = Depends(get_current_user)
):
    """Get specific document by ID with all associated study materials"""
    document = pdf_service.get_document_by_id(document_id, db)
    if not document or document.user_id != current_user.id:
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
async def delete_document(
    document_id: int, 
    db: Session = Depends(get_db), 
    pdf_service: PDFService = Depends(get_pdf_service),
    current_user: User = Depends(get_current_user)
):
    """Delete a document by ID with tenant/owner authorization check (SEC-01)"""
    try:
        success = pdf_service.delete_document(document_id, db, user_id=current_user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found or access denied")
        return {"message": "Document deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/documents/{document_id}/subject")
async def update_document_subject(
    document_id: int, 
    subject: str = Form(...), 
    db: Session = Depends(get_db), 
    pdf_service: PDFService = Depends(get_pdf_service),
    current_user: User = Depends(get_current_user)
):
    """Update document subject with tenant/owner authorization check (SEC-01)"""
    try:
        document = pdf_service.update_subject(document_id, subject, db, user_id=current_user.id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found or access denied")
        return document
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/documents/{document_id}/status", response_model=DocumentIngestionStatusResponse)
async def get_document_ingestion_status(
    document_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Retrieve durable ingestion job status for a document (TASK-01)"""
    from utils.auth import get_authorized_document
    from models.database import DocumentIngestionJob
    from datetime import datetime
    
    # Enforce document ownership
    get_authorized_document(document_id, current_user.id, db)
    
    # Retrieve latest ingestion job
    job = db.query(DocumentIngestionJob).filter(
        DocumentIngestionJob.document_id == document_id,
        DocumentIngestionJob.user_id == current_user.id
    ).order_by(DocumentIngestionJob.created_at.desc()).first()
    
    if not job:
        # Fallback synthesized status if job record doesn't exist
        return DocumentIngestionStatusResponse(
            document_id=document_id,
            job_id="legacy",
            status="INDEXED",
            progress=100,
            current_step="COMPLETED",
            attempt=1,
            max_attempts=3,
            queued_at=datetime.utcnow()
        )
        
    return DocumentIngestionStatusResponse(
        document_id=job.document_id,
        job_id=job.id,
        status=job.status,
        progress=job.progress,
        current_step=job.current_step,
        attempt=job.attempt,
        max_attempts=job.max_attempts,
        queued_at=job.queued_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error_code=job.error_code,
        error_message=job.error_message
    )



