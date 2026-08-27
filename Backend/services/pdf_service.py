from fastapi import UploadFile, BackgroundTasks
from sqlalchemy.orm import Session
from models.database import Document, User
from database.vector_db import VectorDB

from utils.document_processor import DocumentProcessor
from utils.text_splitter import TextSplitter
from services.graph_service import GraphService
import uuid
import hashlib
import os
import logging
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

class PDFService:
    def __init__(self):
        self.vector_db = VectorDB()
        self.text_splitter = TextSplitter()
        self.doc_processor = DocumentProcessor()
        self.graph_service = GraphService()

    def _generate_hash(self, text: str) -> str:
        """Generate a SHA-256 hash for document content"""
        return hashlib.sha256(text.encode('utf-8')).hexdigest()
    
    async def process_document(self, file: UploadFile, user_id: int, subject: str, db: Session, background_tasks: BackgroundTasks) -> Document:
        """Process uploaded document and store in database. Returns existing document if content matches."""
        
        # Read file content
        content = await file.read()
        
        # Save file to disk for Pathway live indexing
        upload_dir = os.path.join("static", "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(upload_dir, f"{uuid.uuid4().hex}_{file.filename}")
        file_url = filepath.replace("\\", "/")
        with open(filepath, "wb") as f:
            f.write(content)
        
        # Extract text based on file type (Universal Multi-Format Support)
        text_content, file_type = await self.doc_processor.process_document(content, file.filename)
        
        if not text_content or not text_content.strip():
            text_content = f"Document: {file.filename}\nUploaded study material."

        # IDEMPOTENCE CHECK: Content Hash
        content_hash = self._generate_hash(text_content)
        existing_doc = db.query(Document).filter(
            Document.user_id == user_id,
            Document.content_hash == content_hash
        ).first()

        if existing_doc:
            print(f"DEBUG: Found existing document with same hash for user {user_id}. Skipping duplicate ingestion.")
            return existing_doc
        
        # Create vector database collection name
        collection_name = f"doc_{uuid.uuid4().hex}"
        
        # Save document to database
        document = Document(
            filename=file.filename,
            file_type=file_type,
            subject=subject,
            text_content=text_content,
            vector_db_id=collection_name,
            file_url=file_url,
            content_hash=content_hash,
            user_id=user_id,
            source_url=None,
            video_id=None
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        # Create durable DocumentIngestionJob (TASK-01)
        from models.database import DocumentIngestionJob
        job_id = str(uuid.uuid4())
        job = DocumentIngestionJob(
            id=job_id,
            document_id=document.id,
            user_id=user_id,
            status="QUEUED",
            current_step="QUEUED",
            progress=0
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        # Dispatch to Celery queue with FastAPI background task fallback
        dispatched_celery = False
        try:
            from tasks import process_document_ingestion_task
            task_res = process_document_ingestion_task.delay(job_id)
            if task_res:
                job.celery_task_id = str(task_res.id)
                db.commit()
                dispatched_celery = True
        except Exception as e:
            logger.info(f"Celery queue not active, running via background task: {e}")
            job.error_code = "LOCAL_ASYNC"
            job.error_message = "Processed via local background task."
            db.commit()

        if not dispatched_celery and background_tasks:
            background_tasks.add_task(
                self.process_document_background,
                document.id, text_content, user_id
            )
        
        return document

    def save_document_to_db(self, user_id: int, filename: str, content: str, subject: str, file_type: str, db: Session, source_url: str = None, video_id: str = None) -> Tuple[Document, bool]:
        """Helper to save an externally fetched document. Returns (Document, is_new)."""
        
        # IDEMPOTENCE CHECK: Source URL or Video ID
        query = db.query(Document).filter(Document.user_id == user_id)
        if video_id:
            existing_doc = query.filter(Document.video_id == video_id).first()
        elif source_url:
            existing_doc = query.filter(Document.source_url == source_url).first()
        else:
            existing_doc = None

        if existing_doc:
            return existing_doc, False

        content_hash = self._generate_hash(content)
        collection_name = f"doc_{uuid.uuid4().hex}"
        document = Document(
            filename=filename,
            file_type=file_type,
            subject=subject,
            text_content=content,
            vector_db_id=collection_name,
            content_hash=content_hash,
            user_id=user_id,
            source_url=source_url,
            video_id=video_id
        )
        db.add(document)
        db.commit()
        db.refresh(document)

        # Create durable DocumentIngestionJob (TASK-01)
        from models.database import DocumentIngestionJob
        job_id = str(uuid.uuid4())
        job = DocumentIngestionJob(
            id=job_id,
            document_id=document.id,
            user_id=user_id,
            status="QUEUED",
            current_step="QUEUED",
            progress=0
        )
        db.add(job)
        db.commit()

        try:
            from tasks import process_document_ingestion_task
            task_res = process_document_ingestion_task.delay(job_id)
            job.celery_task_id = str(task_res.id) if task_res else None
            db.commit()
        except Exception as e:
            logger.warning(f"Task broker enqueue error for job {job_id}: {e}")
            job.error_code = "ENQUEUE_FAILED"
            job.error_message = "Task broker unavailable. Job queued for worker pickup."
            db.commit()

        return document, True


    async def process_document_background(self, document_id: int, text_content: str, user_id: int):
        """Wrapper for background tasks (Async)."""
        from database.database import SessionLocal
        db = SessionLocal()
        try:
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                await self._background_process(document.vector_db_id, text_content, document_id, user_id)
        finally:
            db.close()

    async def _background_process(self, collection_name: str, text_content: str, document_id: int, user_id: int):
        try:
            # 1. Vector Embedding (Existing)
            collection = self.vector_db.create_collection(collection_name)
            chunks = self.text_splitter.split_text(text_content)
            metadatas = [{"chunk_index": i, "document_id": document_id} for i in range(len(chunks))]
            self.vector_db.add_documents(collection_name, chunks, metadatas)
            print(f"DEBUG: Successfully embedded vector search for {collection_name}")
            
            # 2. Epistemic Graph Extraction (THE FIX)
            from database.database import SessionLocal
            db = SessionLocal()
            try:
                await self.graph_service.extract_and_store_graph(document_id, text_content, user_id, db)
                print(f"DEBUG: Successfully extracted Knowledge Graph for document {document_id}")
                
                # 3. Trigger full SkillPack Generation via Celery
                from tasks import generate_study_pack_task
                document = db.query(Document).filter(Document.id == document_id).first()
                if document:
                    # Construct source path/url
                    if document.source_url:
                        source = document.source_url
                    elif document.video_id:
                        source = f"https://www.youtube.com/watch?v={document.video_id}"
                    elif document.file_url:
                        # Assuming Backend is the CWD for Celery workers
                        source = document.file_url
                    else:
                        source = None
                    
                    if source:
                        print(f"DEBUG: Triggering StudyPack Generation for {source}")
                        generate_study_pack_task.delay(document_id, user_id, source)
                        
            finally:
                db.close()
                
        except Exception as e:
            print(f"DEBUG: Background processing failed for doc {document_id}: {e}")
    
    def get_user_documents(self, user_id: int, db: Session) -> List[Document]:
        """Get all documents for a user"""
        return db.query(Document).filter(Document.user_id == user_id).all()

    
    def get_all_documents(self, db: Session) -> List[Document]:
        """Get all documents"""
        return db.query(Document).all()

    def get_document_by_id(self, document_id: int, db: Session, user_id: Optional[int] = None) -> Optional[Document]:
        """Get document by ID, optionally verifying ownership"""
        query = db.query(Document).filter(Document.id == document_id)
        if user_id is not None:
            query = query.filter(Document.user_id == user_id)
        return query.first()

    def delete_document(self, document_id: int, db: Session, user_id: Optional[int] = None) -> bool:
        """Delete document by ID scoped to authorized user"""
        document = self.get_document_by_id(document_id, db, user_id=user_id)
        if not document:
            return False
        
        # Delete from vector DB
        if document.vector_db_id:
            try:
                self.vector_db.delete_collection(document.vector_db_id)
            except:
                pass # Collection might not exist
        
        db.delete(document)
        db.commit()
        return True

    def update_subject(self, document_id: int, subject: str, db: Session, user_id: Optional[int] = None) -> Optional[Document]:
        """Update document subject scoped to authorized user"""
        document = self.get_document_by_id(document_id, db, user_id=user_id)
        if not document:
            return None
        
        document.subject = subject
        db.commit()
        db.refresh(document)
        return document

