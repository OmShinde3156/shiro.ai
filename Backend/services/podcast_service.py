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
        episodes: int, language: str, topic: str, db: Session
    ):
        podcast_id = str(uuid4())

        document = db.query(Document).filter(Document.id.in_(document_ids)).first()
        user = db.query(User).filter(User.id == user_id).first()

        if not document or not user:
            raise ValueError("Invalid user or document ID")

        podcast = Podcast(
            id=podcast_id,
            document_id=document.id,
            user_id=user.id,
            episodes=[],
            script_content="",
            language=language,
            status="processing",
            created_at=datetime.utcnow()
        )
        db.add(podcast)
        db.commit()
        
        # Save IDs to use in the background task
        document_id = document.id
        
        import asyncio
        asyncio.create_task(self.generate_podcast_bg(podcast_id, document_id, episodes, topic))

        return podcast.id

    async def generate_podcast_bg(self, podcast_id: str, document_id: int, episodes: int, topic: str):
        from database.database import SessionLocal
        db = SessionLocal()
        try:
            podcast = db.query(Podcast).filter(Podcast.id == podcast_id).first()
            document = db.query(Document).filter(Document.id == document_id).first()
            if not podcast or not document:
                return
            
            chunks = chunk_text(document.text_content, max_chars=3000)
            chunks = chunks[:episodes]

            all_scripts = []
            episode_files = []

            for i, chunk in enumerate(chunks, start=1):
                focus_prompt = f"Focus on this topic: {topic}." if topic else ""
                prompt = f"Summarize in under 200 words for podcast episode {i} (Language: {podcast.language}). {focus_prompt}\n\nContent:\n{chunk}"
                resp = await llm_client.generate_response(prompt)
                all_scripts.append(resp)

                mp3_filename = f"{podcast.id}_ep{i}.mp3"
                mp3_path = os.path.join(self.STATIC_DIR, mp3_filename)

                tts_client.text_to_speech(resp, mp3_path, lang=podcast.language)

                episode_files.append(f"{self.BASE_URL}/{mp3_filename}")

            final_script = "\n\n".join(all_scripts)
            podcast.script_content = final_script[:10000]
            podcast.episodes = episode_files
            podcast.status = "completed"
            db.commit()

        except Exception as e:
            podcast = db.query(Podcast).filter(Podcast.id == podcast_id).first()
            if podcast:
                podcast.status = f"failed: {str(e)}"
                db.commit()
        finally:
            db.close()

    def get_task_status(self, task_id: str, db: Session):
        podcast = db.query(Podcast).filter(Podcast.id == task_id).first()
        if not podcast:
            return {"task_id": task_id, "status": "not_found"}

        return {
            "task_id": podcast.id,
            "status": podcast.status,
            "episodes": podcast.episodes,
            "script": podcast.script_content if podcast.status == "completed" else None
        }

    def get_user_podcasts(self, user_id: int, db: Session):
        return db.query(Podcast).filter(Podcast.user_id == user_id).all()
