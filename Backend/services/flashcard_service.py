from sqlalchemy.orm import Session
from models.database import FlashcardSet, FlashcardProgress, Document
from utils.llm_client import LLMClient
from models.schema import FlashcardStudyRequest, FlashcardStudyResponse
from datetime import datetime, timedelta
import uuid
from typing import List, Dict, Any

class FlashcardService:
    def __init__(self):
        self.llm_client = LLMClient()
    
    async def generate_flashcards_from_document(self, document_id: int, num_cards: int, db: Session):
        """Generate flashcards from document"""
        
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise Exception("Document not found")
        
        # Generate flashcards using LLM
        cards_data = await self.llm_client.generate_flashcards(
            document.text_content[:4000],
            num_cards
        )
        
        # Add unique IDs and scheduling info
        flashcards = []
        for card_data in cards_data:
            flashcard = {
                "id": str(uuid.uuid4()),
                "question": card_data["question"],
                "answer": card_data["answer"],
                "difficulty": 0,
                "next_review": datetime.utcnow().isoformat()
            }
            flashcards.append(flashcard)
        
        # Save flashcard set
        set_id = str(uuid.uuid4())
        flashcard_set = FlashcardSet(
            id=set_id,
            document_id=document_id,
            flashcards=flashcards
        )
        
        db.add(flashcard_set)
        db.commit()
        
        return {
            "set_id": set_id,
            "document_id": document_id,
            "flashcards": flashcards,
            "created_at": flashcard_set.created_at
        }
    
    def study_flashcard(self, study_request: FlashcardStudyRequest, db: Session) -> FlashcardStudyResponse:
        """Record flashcard study session with spaced repetition algorithm"""
        
        # Get or create progress record
        progress = db.query(FlashcardProgress).filter(
            FlashcardProgress.user_id == study_request.user_id,
            FlashcardProgress.flashcard_id == study_request.flashcard_id
        ).first()
        
        if not progress:
            progress = FlashcardProgress(
                user_id=study_request.user_id,
                flashcard_id=study_request.flashcard_id
            )
            db.add(progress)
        
        # Update using spaced repetition algorithm (SM-2)
        ease_rating = study_request.ease_rating
        
        if ease_rating >= 3:
            if progress.review_count == 0:
                progress.interval_days = 1
            elif progress.review_count == 1:
                progress.interval_days = 6
            else:
                progress.interval_days = int(progress.interval_days * progress.ease_factor)
            
            progress.ease_factor = max(1.3, progress.ease_factor + (0.1 - (5 - ease_rating) * (0.08 + (5 - ease_rating) * 0.02)))
        else:
            progress.interval_days = 1
            progress.ease_factor = max(1.3, progress.ease_factor - 0.2)
        
        progress.next_review = datetime.utcnow() + timedelta(days=progress.interval_days)
        progress.last_reviewed = datetime.utcnow()
        progress.review_count += 1
        
        db.commit()
        
        return FlashcardStudyResponse(
            flashcard_id=study_request.flashcard_id,
            next_review_date=progress.next_review,
            interval_days=progress.interval_days
        )
    
    def get_cards_for_review(self, user_id: int, db: Session) -> List[Dict[str, Any]]:
        """Get flashcards due for review"""
        
        now = datetime.utcnow()
        
        # Get cards due for review
        progress_records = db.query(FlashcardProgress).filter(
            FlashcardProgress.user_id == user_id,
            FlashcardProgress.next_review <= now
        ).all()
        
        # Get flashcard details
        review_cards = []
        for progress in progress_records:
            # Find the flashcard in sets (this could be optimized with better DB design)
            flashcard_sets = db.query(FlashcardSet).all()
            for fset in flashcard_sets:
                for card in fset.flashcards:
                    if card['id'] == progress.flashcard_id:
                        review_cards.append({
                            "flashcard_id": card['id'],
                            "question": card['question'],
                            "answer": card['answer'],
                            "review_count": progress.review_count,
                            "last_interval": progress.interval_days
                        })
                        break
        
        return review_cards
