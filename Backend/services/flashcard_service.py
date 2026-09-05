from sqlalchemy.orm import Session
from models.database import FlashcardSet, Flashcard, FlashcardProgress, FlashcardReview, Document
from utils.llm_client import llm_client
from utils.quality_gate import QualityGate
from models.schema import FlashcardStudyRequest, FlashcardStudyResponse
from datetime import datetime, timedelta
import uuid
from typing import List, Dict, Any, Optional

class FlashcardService:
    async def generate_flashcards_from_document(self, document_id: int, num_cards: int, db: Session, user_id: Optional[int] = None):
        """Fetch pre-generated flashcards from document with QualityGate validation (AI-02)"""
        
        # Get document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise Exception("Document not found")
            
        # Get flashcard set
        flashcard_set = db.query(FlashcardSet).filter(FlashcardSet.document_id == document_id).order_by(FlashcardSet.created_at.desc()).first()
        if not flashcard_set:
            # Fallback to on-the-fly generation
            raw_cards = await llm_client.generate_flashcards(
                content=document.text_content[:15000], 
                num_cards=num_cards,
                user_id=user_id or document.user_id,
                db=db
            )
            
            # AI-02 Quality Gate Validation
            generated_cards = QualityGate.validate_flashcard_quality(
                flashcards=raw_cards,
                source_text=document.text_content,
                min_grounding_score=0.20
            )
            if not generated_cards:
                generated_cards = raw_cards
            
            flashcard_set = FlashcardSet(
                id=str(uuid.uuid4()),
                document_id=document_id,
                user_id=document.user_id
            )
            db.add(flashcard_set)
            
            for card in generated_cards:
                card_id = str(uuid.uuid4())
                flashcard = Flashcard(
                    id=card_id,
                    set_id=flashcard_set.id,
                    question=card['question'],
                    answer=card['answer']
                )
                db.add(flashcard)

                
                # Auto-create progress
                progress = FlashcardProgress(
                    user_id=document.user_id,
                    flashcard_id=card_id,
                    next_review=datetime.utcnow()
                )
                db.add(progress)
            
            db.commit()
            
        flashcards_output = []
        
        # Use a join to get progress along with flashcards
        results = db.query(Flashcard, FlashcardProgress).join(
            FlashcardProgress, Flashcard.id == FlashcardProgress.flashcard_id
        ).filter(
            Flashcard.set_id == flashcard_set.id,
            FlashcardProgress.user_id == document.user_id
        ).all()
        
        for card, progress in results:
            flashcards_output.append({
                "id": card.id,
                "question": card.question,
                "answer": card.answer,
                "next_review": progress.next_review
            })
            
        # Optionally slice to num_cards
        if len(flashcards_output) > num_cards:
            import random
            flashcards_output = random.sample(flashcards_output, num_cards)
            
        return {
            "set_id": flashcard_set.id,
            "document_id": document_id,
            "flashcards": flashcards_output,
            "created_at": flashcard_set.created_at
        }
    
    def study_flashcard(self, study_request: FlashcardStudyRequest, db: Session, user_id: int) -> FlashcardStudyResponse:
        """Record flashcard study session with FSRS algorithm"""
        try:
            try:
                from fsrs import FSRS, Card, Rating, State
            except ImportError:
                from fsrs import Scheduler as FSRS, Card, Rating, State
            has_fsrs = True
        except ImportError:
            has_fsrs = False
            import logging
            logging.error("FSRS package not installed. Using fallback SM-2.")
        
        # Get progress record
        progress = db.query(FlashcardProgress).filter(
            FlashcardProgress.user_id == user_id,
            FlashcardProgress.flashcard_id == study_request.flashcard_id
        ).first()
        
        if not progress:
            progress = FlashcardProgress(
                user_id=user_id,
                flashcard_id=study_request.flashcard_id,
                ease_factor=2.5,
                interval_days=0,
                review_count=0
            )
            db.add(progress)
            
        now = datetime.utcnow()
        
        # Idempotency check: avoid double-logging duplicate review submissions
        if study_request.idempotency_key:
            existing_review = db.query(FlashcardReview).filter(
                FlashcardReview.user_id == user_id,
                FlashcardReview.idempotency_key == study_request.idempotency_key
            ).first()
            if existing_review:
                return FlashcardStudyResponse(
                    flashcard_id=study_request.flashcard_id,
                    next_review_date=progress.next_review or now,
                    interval_days=progress.interval_days or 0,
                    fsrs_state=progress.fsrs_state,
                    stability=progress.fsrs_stability,
                    difficulty=progress.fsrs_difficulty
                )

        fsrs_state_before = progress.fsrs_state if progress.fsrs_state is not None else 0

        if has_fsrs:
            f = FSRS()
            # Map frontend rating (1=Again, 2=Hard, 3/4=Good, 5=Easy) to FSRS Rating
            rating_map = {
                1: Rating.Again,
                2: Rating.Hard,
                3: Rating.Good,
                4: Rating.Good,
                5: Rating.Easy
            }
            fsrs_rating = rating_map.get(study_request.ease_rating, Rating.Good)
            
            # Reconstruct FSRS Card
            card = Card()
            card.state = State(progress.fsrs_state) if progress.fsrs_state is not None else State.New
            card.stability = progress.fsrs_stability or 0.0
            card.difficulty = progress.fsrs_difficulty or 0.0
            card.elapsed_days = progress.fsrs_elapsed_days or 0
            card.scheduled_days = progress.fsrs_scheduled_days or 0
            card.reps = progress.fsrs_reps or 0
            card.lapses = progress.fsrs_lapses or 0
            # Note: py-fsrs expects timezone-aware datetimes in newer versions, but utcnow is fine for generic use
            if progress.last_reviewed:
                card.last_review = progress.last_reviewed.replace(tzinfo=datetime.timezone.utc) if progress.last_reviewed.tzinfo is None else progress.last_reviewed
            
            # Calculate next review
            scheduling_cards = f.repeat(card, now.replace(tzinfo=datetime.timezone.utc))
            card = scheduling_cards[fsrs_rating].card
            
            # Update progress record (materialized current state)
            progress.fsrs_state = card.state.value
            progress.fsrs_stability = card.stability
            progress.fsrs_difficulty = card.difficulty
            progress.fsrs_elapsed_days = card.elapsed_days
            progress.fsrs_scheduled_days = card.scheduled_days
            progress.fsrs_reps = card.reps
            progress.fsrs_lapses = card.lapses
            
            # Remove timezone for SQLite/Postgres naive columns
            progress.next_review = card.due.replace(tzinfo=None)
            progress.last_reviewed = now
            progress.interval_days = card.scheduled_days
            progress.review_count = card.reps
            
        else:
            # Fallback SM-2 Algorithm
            q = study_request.ease_rating
            if q >= 3:
                if progress.review_count == 0:
                    progress.interval_days = 1
                elif progress.review_count == 1:
                    progress.interval_days = 6
                else:
                    progress.interval_days = round(progress.interval_days * progress.ease_factor)
                progress.ease_factor = max(1.3, progress.ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
                progress.review_count += 1
            else:
                progress.interval_days = 1
                progress.review_count = 0 
            progress.next_review = now + timedelta(days=progress.interval_days)
            progress.last_reviewed = now

        # Append immutable review event (DATA-01)
        review_event = FlashcardReview(
            user_id=user_id,
            flashcard_id=study_request.flashcard_id,
            idempotency_key=study_request.idempotency_key,
            rating=study_request.ease_rating,
            review_duration_ms=study_request.review_duration_ms or 0,
            fsrs_state_before=fsrs_state_before,
            fsrs_state_after=progress.fsrs_state if progress.fsrs_state is not None else 0,
            stability_after=progress.fsrs_stability or 0.0,
            difficulty_after=progress.fsrs_difficulty or progress.ease_factor,
            reviewed_at=now
        )
        db.add(review_event)

        # Atomic commit of both materialized progress and historical event log
        try:
            db.commit()
            db.refresh(progress)
        except Exception:
            db.rollback()
            raise
        
        return FlashcardStudyResponse(
            flashcard_id=study_request.flashcard_id,
            next_review_date=progress.next_review,
            interval_days=progress.interval_days,
            fsrs_state=progress.fsrs_state,
            stability=progress.fsrs_stability,
            difficulty=progress.fsrs_difficulty
        )

    def get_review_history(self, flashcard_id: str, user_id: int, db: Session) -> dict:
        """Retrieve chronological review history for forgetting curve reconstruction (DATA-01)"""
        reviews = db.query(FlashcardReview).filter(
            FlashcardReview.flashcard_id == flashcard_id,
            FlashcardReview.user_id == user_id
        ).order_by(FlashcardReview.reviewed_at.asc()).all()
        
        return {
            "flashcard_id": flashcard_id,
            "total_reviews": len(reviews),
            "reviews": [
                {
                    "id": r.id,
                    "flashcard_id": r.flashcard_id,
                    "rating": r.rating,
                    "review_duration_ms": r.review_duration_ms,
                    "fsrs_state_before": r.fsrs_state_before,
                    "fsrs_state_after": r.fsrs_state_after,
                    "stability_after": r.stability_after,
                    "difficulty_after": r.difficulty_after,
                    "reviewed_at": r.reviewed_at
                }
                for r in reviews
            ]
        }
    
    def get_cards_for_review(self, user_id: int, db: Session) -> List[dict]:
        """Get flashcards due for review for a user"""
        now = datetime.utcnow()
        results = db.query(Flashcard, FlashcardProgress).join(
            FlashcardProgress, Flashcard.id == FlashcardProgress.flashcard_id
        ).filter(
            FlashcardProgress.user_id == user_id,
            FlashcardProgress.next_review <= now
        ).all()
        
        cards_output = []
        for card, progress in results:
            cards_output.append({
                "id": card.id,
                "question": card.question,
                "answer": card.answer,
                "interval_days": progress.interval_days,
                "review_count": progress.review_count,
                "next_review": progress.next_review
            })
        return cards_output

    async def generate_flashcards_from_text(self, text: str, num_cards: int, user_id: int, db: Session) -> List[dict]:
        """Generate flashcard items directly from text/notes"""
        raw_cards = await llm_client.generate_flashcards(
            content=text[:12000],
            num_cards=num_cards,
            user_id=user_id,
            db=db
        )
        output = []
        for c in raw_cards:
            output.append({
                "id": str(uuid.uuid4()),
                "question": c.get("question", ""),
                "answer": c.get("answer", "")
            })
        return output

