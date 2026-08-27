from celery_app import celery_app
from database.database import SessionLocal
from models.database import Podcast, Document, Summary, KnowledgeNode, KnowledgeEdge, LibraryInsight
from utils.llm_client import llm_client
from utils.tts_client import tts_client
from services.swarm_service import SwarmService
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
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        for i, chunk in enumerate(chunks, start=1):
            focus_prompt = f"Focus on this topic: {topic}." if topic else ""
            prompt = f"""Generate a two-speaker conversational podcast script for episode {i} (Language: {podcast.language}).
The two speakers are "Host" and "Co-Host". 
Make it an engaging, natural dialogue discussing the following content. {focus_prompt}
Do not use generic AI phrases like "Let's dive in" or "In conclusion".
Format the response strictly as:
Host: [Dialogue]
Co-Host: [Dialogue]

Content:
{chunk}"""
            
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

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
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

@celery_app.task(name="tasks.run_swarm_analysis")
def run_swarm_analysis_task(user_id: int):
    db = SessionLocal()
    try:
        swarm_service = SwarmService()
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        loop.run_until_complete(swarm_service.run_library_analysis(user_id, db))
    except Exception as e:
        logger.error(f"Swarm Task Failed: {e}")
    finally:
        db.close()

@celery_app.task(name="tasks.generate_study_pack_task")
def generate_study_pack_task(document_id: int, user_id: int, source_path_or_url: str):
    db = SessionLocal()
    try:
        from services.study_pack_service import StudyPackService
        service = StudyPackService()
        service.generate_study_pack_sync(document_id, user_id, source_path_or_url, db)
    except Exception as e:
        logger.error(f"Study Pack Generation Task Failed: {e}")
    finally:
        db.close()

@celery_app.task(name="tasks.process_document_ingestion", bind=True, max_retries=3)
def process_document_ingestion_task(self, job_id: str, db=None):
    """
    Durable Document Ingestion State Machine (TASK-01)
    Steps: QUEUED -> EXTRACTING -> CHUNKING -> EMBEDDING -> GRAPH_BUILDING -> INDEXED
    """
    from models.database import DocumentIngestionJob, Document
    from datetime import datetime
    from database.database import SessionLocal
    from database.vector_db import VectorDB
    from services.graph_service import GraphService
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        job = db.query(DocumentIngestionJob).filter(DocumentIngestionJob.id == job_id).first()
        if not job:
            logger.error(f"Ingestion Job {job_id} not found.")
            return

        document = db.query(Document).filter(Document.id == job.document_id).first()
        if not document:
            job.status = "FAILED"
            job.error_code = "DOCUMENT_NOT_FOUND"
            job.error_message = "Associated document was deleted or not found."
            db.commit()
            return

        # 1. EXTRACTING STEP
        job.status = "EXTRACTING"
        job.current_step = "EXTRACTING"
        job.progress = 15
        job.started_at = datetime.utcnow()
        db.commit()

        text_content = document.text_content
        if not text_content or not text_content.strip():
            job.status = "FAILED"
            job.error_code = "CORRUPT_OR_EMPTY_DOCUMENT"
            job.error_message = "Document contains no readable text content."
            db.commit()
            return

        # 2. CHUNKING STEP
        job.status = "CHUNKING"
        job.current_step = "CHUNKING"
        job.progress = 35
        db.commit()

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        chunks = text_splitter.split_text(text_content)
        if not chunks:
            job.status = "FAILED"
            job.error_code = "CHUNKING_FAILED"
            job.error_message = "Unable to split document content into indexable chunks."
            db.commit()
            return

        # 3. EMBEDDING STEP (Deterministic & Idempotent)
        job.status = "EMBEDDING"
        job.current_step = "EMBEDDING"
        job.progress = 65
        db.commit()

        vector_db = VectorDB()
        collection_name = document.vector_db_id or f"doc_{document.id}_{document.user_id}"
        
        # Deterministic IDs and comprehensive metadata for Gate 2 Provenance
        doc_version = getattr(document, "version", 1)
        chunk_ids = [f"doc_{document.id}_v{doc_version}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{
            "chunk_index": i,
            "document_id": document.id,
            "document_version": doc_version,
            "user_id": document.user_id,
            "chunk_id": chunk_ids[i],
            "page_number": (i // 3) + 1,
            "filename": document.filename
        } for i in range(len(chunks))]
        
        # Add documents idempotently and update BM25 index
        vector_db.add_documents(
            collection_name=collection_name,
            documents=chunks,
            metadatas=metadatas,
            ids=chunk_ids
        )


        # 4. GRAPH BUILDING STEP
        job.status = "GRAPH_BUILDING"
        job.current_step = "GRAPH_BUILDING"
        job.progress = 85
        db.commit()

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
        from services.graph_service import GraphService
        graph_service = GraphService()
        loop.run_until_complete(graph_service.extract_and_store_graph(document.id, text_content, job.user_id, db))

        # 5. INDEXED STEP
        job.status = "INDEXED"
        job.current_step = "COMPLETED"
        job.progress = 100
        job.completed_at = datetime.utcnow()
        job.error_code = None
        job.error_message = None
        db.commit()

        # Trigger downstream SkillPack asynchronously
        source = document.source_url or document.file_url or (f"https://www.youtube.com/watch?v={document.video_id}" if document.video_id else None)
        if source:
            generate_study_pack_task.delay(document.id, job.user_id, source)

    except Exception as e:
        logger.error(f"Ingestion Task Exception for Job {job_id}: {e}", exc_info=True)
        db.rollback()
        job = db.query(DocumentIngestionJob).filter(DocumentIngestionJob.id == job_id).first()
        if job:
            if job.attempt < job.max_attempts:
                job.attempt += 1
                job.status = "QUEUED"
                job.error_code = "TRANSIENT_FAILURE"
                job.error_message = "Temporary ingestion failure. Retrying with backoff..."
                db.commit()
                # Exponential backoff retry
                raise self.retry(exc=e, countdown=2 ** job.attempt)
            else:
                job.status = "FAILED"
                job.error_code = "MAX_RETRIES_EXCEEDED"
                job.error_message = "Document processing failed after multiple attempts."
                db.commit()
    finally:
        if own_session:
            db.close()


