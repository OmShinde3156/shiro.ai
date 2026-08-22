import os
import uuid
from sqlalchemy.orm import Session
from models.database import Document, StudyPack, Quiz, FlashcardSet, Flashcard, FlashcardProgress
import asyncio
from datetime import datetime

class StudyPackService:
    def __init__(self):
        # The engine will pick up SKILL_ANYTHING_API_KEY from os.environ
        # which is set in llm_client.py when the app loads
        # self.engine = Engine() # Disabled as skill_anything was removed
        pass

    def generate_study_pack_sync(self, document_id: int, user_id: int, source_path_or_url: str, db: Session):
        """Generates the full SkillPack synchronously. Designed to be run in a Celery background task."""
        try:
            # 1. Update status to processing
            pack_id = str(uuid.uuid4())
            study_pack = StudyPack(
                id=pack_id,
                document_id=document_id,
                user_id=user_id,
                status="processing",
                pack_data={}
            )
            db.add(study_pack)
            db.commit()
            
            # 2. Run Skill-Anything Engine
            # pack = self.engine.from_source(source_path_or_url)
            
            # Since skill_anything was removed, we simply mark it as completed or mocked
            study_pack.pack_data = {"note": "Skill-Anything disabled"}
            study_pack.status = "completed"
            
            # 4. Auto-populate Quiz table for instant access later
            # (Disabled since pack is not available)
            # if pack.quiz_questions:
            #     quiz_id = str(uuid.uuid4())
            #     pack_dict = pack.to_dict()
            #     quiz_questions_json = pack_dict.get("quiz_questions", [])
            #     
            #     for i, q in enumerate(quiz_questions_json):
            #         q["id"] = f"q_{uuid.uuid4().hex}_{i}"
            #         q["correct_answer"] = q.get("answer", "")
            #     
            #     quiz = Quiz(
            #         id=quiz_id,
            #         document_id=document_id,
            #         questions=quiz_questions_json,
            #         difficulty="mixed"
            #     )
            #     db.add(quiz)
                
            # 5. Auto-populate Flashcard tables
            # if pack.flashcards:
            #     set_id = str(uuid.uuid4())
            #     flashcard_set = FlashcardSet(
            #         id=set_id,
            #         document_id=document_id,
            #         user_id=user_id
            #     )
            #     db.add(flashcard_set)
            #     
            #     for card in pack.flashcards:
            #         card_id = str(uuid.uuid4())
            #         flashcard = Flashcard(
            #             id=card_id,
            #             set_id=set_id,
            #             question=card.front,
            #             answer=card.back
            #         )
            #         db.add(flashcard)
            #         
            #         progress = FlashcardProgress(
            #             user_id=user_id,
            #             flashcard_id=card_id,
            #             next_review=datetime.utcnow()
            #         )
            #         db.add(progress)
            
            db.commit()
            return pack_id
            
        except Exception as e:
            # Mark as failed
            db.rollback()
            study_pack = db.query(StudyPack).filter(StudyPack.document_id == document_id).first()
            if study_pack:
                study_pack.status = f"failed: {str(e)}"
                db.commit()
            raise e
