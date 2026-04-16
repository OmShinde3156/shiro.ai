from sqlalchemy.orm import Session
from models.database import Document, Summary
from utils.llm_client import LLMClient
import uuid
from typing import Dict, Any, List

class SummarizerService:
    def __init__(self):
        self.llm_client = LLMClient()
    
    async def generate_summary(self, document_id: int, summary_type: str, language: str, db: Session):
        """Generate summary from document"""
        
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise Exception("Document not found")
        
        # Generate summary
        summary_text = await self.llm_client.generate_summary(
            document.text_content[:40000],
            summary_type,
            language
        )
        
        # Save summary
        summary_id = str(uuid.uuid4())
        summary = Summary(
            id=summary_id,
            document_id=document_id,
            user_id=document.user_id,
            summary_text=summary_text,
            summary_type=summary_type,
            language=language
        )
        
        db.add(summary)
        db.commit()
        
        return {
            "summary_id": summary_id,
            "document_id": document_id,
            "summary_text": summary_text,
            "summary_type": summary_type,
            "language": language,
            "created_at": summary.created_at
        }
    
    def get_user_summaries(self, user_id: int, db: Session) -> List[Dict[str, Any]]:
        """Get all summaries for user"""
        
        summaries = db.query(Summary).filter(Summary.user_id == user_id).all()
        
        return [
            {
                "summary_id": s.id,
                "document_id": s.document_id,
                "summary_text": s.summary_text[:200] + "..." if len(s.summary_text) > 200 else s.summary_text,
                "summary_type": s.summary_type,
                "language": s.language,
                "created_at": s.created_at
            }
            for s in summaries
        ]

