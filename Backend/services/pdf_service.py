from fastapi import UploadFile, BackgroundTasks
from sqlalchemy.orm import Session
from models.database import Document, User
from database.vector_db import VectorDB
from utils.document_processor import DocumentProcessor
from utils.text_splitter import TextSplitter
from services.graph_service import GraphService
import uuid
from typing import List

class PDFService:
    def __init__(self):
        self.vector_db = VectorDB()
        self.text_splitter = TextSplitter()
        self.doc_processor = DocumentProcessor()
        self.graph_service = GraphService()
    
    async def process_document(self, file: UploadFile, user_id: int, subject: str, db: Session, background_tasks: BackgroundTasks) -> Document:
        """Process uploaded document and store in database. Returns quickly, processes in background."""
        
        # Read file content
        content = await file.read()
        
        # Extract text based on file type (do this synchronously to get filename/type, and ensure it's not empty)
        text_content, file_type = await self.doc_processor.process_document(content, file.filename)
        
        if not text_content.strip():
            raise Exception("No text content could be extracted from the document")
        
        # Create vector database collection name
        collection_name = f"doc_{uuid.uuid4().hex}"
        
        # Save document to database immediately so it shows up in UI
        document = Document(
            filename=file.filename,
            file_type=file_type,
            subject=subject,
            text_content=text_content,
            vector_db_id=collection_name,
            user_id=user_id,
            source_url=None,
            video_id=None
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        # Move heavy lifting to background
        background_tasks.add_task(self._background_process, collection_name, text_content, document.id, user_id)
        
        return document

    def save_document_to_db(self, user_id: int, filename: str, content: str, subject: str, file_type: str, db: Session, source_url: str = None, video_id: str = None) -> Document:
        """Helper to save an externally fetched document (Web/YT) to the database."""
        collection_name = f"doc_{uuid.uuid4().hex}"
        document = Document(
            filename=filename,
            file_type=file_type,
            subject=subject,
            text_content=content,
            vector_db_id=collection_name,
            user_id=user_id,
            source_url=source_url,
            video_id=video_id
        )
        db.add(document)
        db.commit()
        db.refresh(document)
        return document

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

    def get_document_by_id(self, document_id: int, db: Session) -> Document:
        """Get document by ID"""
        return db.query(Document).filter(Document.id == document_id).first()

    def delete_document(self, document_id: int, db: Session) -> bool:
        """Delete document by ID"""
        document = self.get_document_by_id(document_id, db)
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

    def update_subject(self, document_id: int, subject: str, db: Session) -> Document:
        """Update document subject"""
        document = self.get_document_by_id(document_id, db)
        if not document:
            return None
        
        document.subject = subject
        db.commit()
        db.refresh(document)
        return document
