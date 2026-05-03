from sqlalchemy.orm import Session
from models.database import FlashcardSet, Flashcard, FlashcardProgress, Document
from utils.llm_client import llm_client
from models.schema import FlashcardStudyRequest, FlashcardStudyResponse
from datetime import datetime, timedelta
import uuid
from typing import List, Dict, Any

class FlashcardService:
    async def generate_flashcards_from_document(self, document_id: int, num_cards: int, db: Session):
        """Generate flashcards from document and save as individual records"""
        
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise Exception("Document not found")
        
        # Generate flashcards using LLM
        cards_data = await llm_client.generate_flashcards(
            document.text_content,
            num_cards
        )
        
        # Save flashcard set
        set_id = str(uuid.uuid4())
        flashcard_set = FlashcardSet(
            id=set_id,
            document_id=document_id,
            user_id=document.user_id
        )
        db.add(flashcard_set)
        
        # Save individual flashcards and initial progress
        flashcards_output = []
        for card_data in cards_data:
            card_id = str(uuid.uuid4())
            flashcard = Flashcard(
                id=card_id,
                set_id=set_id,
                question=card_data["question"],
                answer=card_data["answer"]
            )
            db.add(flashcard)
            
            # Auto-create progress record so it shows up in review
            progress = FlashcardProgress(
                user_id=document.user_id,
                flashcard_id=card_id,
                next_review=datetime.utcnow()
            )
            db.add(progress)
            
            flashcards_output.append({
                "id": card_id,
                "question": flashcard.question,
                "answer": flashcard.answer,
                "next_review": progress.next_review
            })
        
        db.commit()
        
        return {
            "set_id": set_id,
            "document_id": document_id,
            "flashcards": flashcards_output,
            "created_at": flashcard_set.created_at
        }
    
    def study_flashcard(self, study_request: FlashcardStudyRequest, db: Session) -> FlashcardStudyResponse:
        """Record flashcard study session with improved SM-2 algorithm"""
        
        # Get progress record
        progress = db.query(FlashcardProgress).filter(
            FlashcardProgress.user_id == study_request.user_id,
            FlashcardProgress.flashcard_id == study_request.flashcard_id
        ).first()
        
        if not progress:
            # Fallback for old data or if somehow missing
            progress = FlashcardProgress(
                user_id=study_request.user_id,
                flashcard_id=study_request.flashcard_id
            )
            db.add(progress)
        
        # SM-2 Algorithm Implementation
        # Ratings: 1 (Again), 2 (Hard), 3 (Good), 4 (Very Good), 5 (Easy)
        # Note: Frontend sends 1, 2, 4, 5 currently. I'll treat 3-5 as success.
        q = study_request.ease_rating
        
        if q >= 3: # Success
            if progress.review_count == 0:
                progress.interval_days = 1
            elif progress.review_count == 1:
                progress.interval_days = 6
            else:
                progress.interval_days = round(progress.interval_days * progress.ease_factor)
            
            # Update ease factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
            progress.ease_factor = max(1.3, progress.ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
            progress.review_count += 1
        else: # Failure
            progress.interval_days = 1
            progress.review_count = 0 # Reset learning cycle
            # Ease factor doesn't typically decrease on failure in pure SM-2, 
            # but some variants do. We'll keep it stable to avoid "ease hell".

        progress.next_review = datetime.utcnow() + timedelta(days=progress.interval_days)
        progress.last_reviewed = datetime.utcnow()
        
        db.commit()
        
        return FlashcardStudyResponse(
            flashcard_id=study_request.flashcard_id,
            next_review_date=progress.next_review,
            interval_days=progress.interval_days
        )
    
    def get_cards_for_review(self, user_id: int, db: Session) -> List[Dict[str, Any]]:
        """Get flashcards due for review using efficient JOIN"""
        
        now = datetime.utcnow()
        
        # Optimized query using JOIN to get both progress and card content
        results = db.query(Flashcard, FlashcardProgress).join(
            FlashcardProgress, Flashcard.id == FlashcardProgress.flashcard_id
        ).filter(
            FlashcardProgress.user_id == user_id,
            FlashcardProgress.next_review <= now
        ).all()
        
        review_cards = []
        for card, progress in results:
            review_cards.append({
                "flashcard_id": card.id,
                "question": card.question,
                "answer": card.answer,
                "review_count": progress.review_count,
                "last_interval": progress.interval_days,
                "next_review": progress.next_review
            })
        
        return review_cards
