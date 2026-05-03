from celery_app import celery_app
from database.database import SessionLocal
from models.database import Podcast, Document, Summary, KnowledgeNode, KnowledgeEdge
from utils.llm_client import llm_client
from utils.tts_client import tts_client
import os
import asyncio
import logging

logger = logging.getLogger(__name__)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def chunk_text(text, max_chars=3000):
    return [text[i:i + max_chars] for i in range(0, len(text), max_chars)]

@celery_app.task(name="tasks.generate_podcast")
def generate_podcast_task(podcast_id: str, document_id: int, episodes: int, topic: str):
    db = SessionLocal()
    try:
        podcast = db.query(Podcast).filter(Podcast.id == podcast_id).first()
        document = db.query(Document).filter(Document.id == document_id).first()
        if not podcast or not document:
            return

        # Setup paths
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        static_dir = os.path.join(backend_dir, "static")
        base_url = "http://localhost:8000/static"

        chunks = chunk_text(document.text_content, max_chars=3000)
        chunks = chunks[:episodes]

        all_scripts = []
        episode_files = []

        # Use an event loop to run the async LLM calls
        loop = asyncio.get_event_loop()

        for i, chunk in enumerate(chunks, start=1):
            focus_prompt = f"Focus on this topic: {topic}." if topic else ""
            prompt = f"Summarize in under 200 words for podcast episode {i} (Language: {podcast.language}). {focus_prompt}\n\nContent:\n{chunk}"
            
            # Run async LLM call in sync environment
            resp = loop.run_until_complete(llm_client.generate_response(prompt))
            all_scripts.append(resp)

            mp3_filename = f"{podcast.id}_ep{i}.mp3"
            mp3_path = os.path.join(static_dir, mp3_filename)

            tts_client.text_to_speech(resp, mp3_path, lang=podcast.language)
            episode_files.append(f"{base_url}/{mp3_filename}")

        final_script = "\n\n".join(all_scripts)
        podcast.script_content = final_script[:10000]
        podcast.episodes = episode_files
        podcast.status = "completed"
        db.commit()

    except Exception as e:
        logger.error(f"Podcast Task Failed: {e}")
        db.rollback()
        podcast = db.query(Podcast).filter(Podcast.id == podcast_id).first()
        if podcast:
            podcast.status = f"failed: {str(e)}"
            db.commit()
    finally:
        db.close()

@celery_app.task(name="tasks.generate_summary")
def generate_summary_task(summary_id: str, document_id: int, summary_type: str, language: str):
    db = SessionLocal()
    try:
        summary = db.query(Summary).filter(Summary.id == summary_id).first()
        document = db.query(Document).filter(Document.id == document_id).first()
        if not summary or not document:
            return

        loop = asyncio.get_event_loop()
        summary_text = loop.run_until_complete(llm_client.generate_summary(document.text_content, summary_type, language))
        
        summary.summary_text = summary_text
        summary.status = "completed"
        db.commit()

    except Exception as e:
        logger.error(f"Summary Task Failed: {e}")
        db.rollback()
        summary = db.query(Summary).filter(Summary.id == summary_id).first()
        if summary:
            summary.status = f"failed: {str(e)}"
            db.commit()
    finally:
        db.close()
