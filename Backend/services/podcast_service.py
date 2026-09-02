import os
from uuid import uuid4
from sqlalchemy.orm import Session
from models.database import Podcast, Document, User
from datetime import datetime

# Import LLM + TTS clients
from utils.llm_client import llm_client
from utils.tts_client import tts_client


def chunk_text(text, max_chars=3000):
    return [text[i:i + max_chars] for i in range(0, len(text), max_chars)]


class PodcastService:
    def __init__(self):
        # Dynamically point to the static folder in the Backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.STATIC_DIR = os.path.join(backend_dir, "static")
        os.makedirs(self.STATIC_DIR, exist_ok=True)

        # Base URL served by FastAPI static mount
        self.BASE_URL = "http://localhost:8000/static"

    def create_podcast_task(
        self, user_id: int, document_ids: list[int],
        episodes: int, language: str, topic: str, db: Session,
        mode: str = "dialogue", narrator_voice: str = None,
        duration: str = "standard", custom_title: str = None,
        subject: str = None
    ):
        podcast_id = str(uuid4())

        document = db.query(Document).filter(Document.id.in_(document_ids)).first()
        user = db.query(User).filter(User.id == user_id).first()

        if not document or not user:
            raise ValueError("Invalid user or document ID")

        derived_subject = subject or getattr(document, "subject", None) or "General"

        podcast = Podcast(
            id=podcast_id,
            document_id=document.id,
            user_id=user.id,
            title=custom_title or f"Study Session: {document.filename}",
            subject=derived_subject,
            episodes=[],
            script_content="",
            language=language,
            status="processing",
            created_at=datetime.utcnow()
        )
        db.add(podcast)
        db.commit()
        
        # Trigger Celery Task
        from tasks import generate_podcast_task
        generate_podcast_task.delay(
            podcast_id, document.id, episodes, topic, mode, narrator_voice,
            duration, custom_title, derived_subject
        )

        return podcast.id

    def get_task_status(self, task_id: str, db: Session):
        podcast = db.query(Podcast).filter(Podcast.id == task_id).first()
        if not podcast:
            return {"task_id": task_id, "status": "not_found"}

        is_failed = podcast.status.startswith("failed") if podcast.status else False
        return {
            "task_id": podcast.id,
            "title": getattr(podcast, "title", None) or f"Series #{podcast.id[:8]}",
            "subject": getattr(podcast, "subject", None) or "General",
            "status": "failed" if is_failed else podcast.status,
            "error": podcast.status if is_failed else None,
            "episodes": podcast.episodes or [],
            "script": podcast.script_content if podcast.status == "completed" else None
        }

    def get_user_podcasts(self, user_id: int, db: Session):
        podcasts = db.query(Podcast).filter(Podcast.user_id == user_id).order_by(Podcast.created_at.desc()).all()
        result = []
        for p in podcasts:
            subj = getattr(p, "subject", None) or "General"
            title = getattr(p, "title", None) or f"Series #{p.id[:8]}"
            result.append({
                "id": p.id,
                "document_id": p.document_id,
                "user_id": p.user_id,
                "title": title,
                "subject": subj,
                "episodes": p.episodes or [],
                "script_content": p.script_content,
                "language": p.language,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None
            })
        return result

    def delete_podcast(self, podcast_id: str, db: Session):
        podcast = db.query(Podcast).filter(Podcast.id == podcast_id).first()
        if not podcast:
            return False
            
        if podcast.episodes:
            for ep in podcast.episodes:
                ep_url = ep.get("audio_url", "") if isinstance(ep, dict) else str(ep)
                filename = ep_url.split("/")[-1]
                path = os.path.join(self.STATIC_DIR, filename)
                if os.path.exists(path):
                    try:
                        os.remove(path)
                    except Exception:
                        pass
                        
        db.delete(podcast)
        db.commit()
        return True
