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

def normalize_subject(raw_subject: str = None) -> str:
    """Normalizes raw subject/category names into clean, canonical Subject Folders."""
    if not raw_subject:
        return "General"
    s = raw_subject.strip().lower()
    mapping = {
        "cs": "Computer Science",
        "cse": "Computer Science",
        "computer science": "Computer Science",
        "comp sci": "Computer Science",
        "software engineering": "Computer Science",
        "coding": "Computer Science",
        "programming": "Computer Science",
        "ai": "Artificial Intelligence",
        "ml": "Machine Learning",
        "physics": "Physics",
        "quantum": "Physics",
        "thermodynamics": "Physics",
        "math": "Mathematics",
        "maths": "Mathematics",
        "mathematics": "Mathematics",
        "calculus": "Mathematics",
        "linear algebra": "Mathematics",
        "chemistry": "Chemistry",
        "biology": "Biology",
        "biotech": "Biology",
        "medicine": "Medicine",
        "history": "History",
        "literature": "Literature",
        "economics": "Economics",
        "business": "Business",
        "philosophy": "Philosophy",
        "psychology": "Psychology",
    }
    for key, val in mapping.items():
        if key == s or key in s:
            return val
    return raw_subject.strip().title()

DURATION_CONFIG = {
    "quick": {
        "label": "3–5 min",
        "min_words": 450,
        "max_words": 650,
        "description": "High-yield, fast-paced overview focused on core definitions and primary intuition."
    },
    "standard": {
        "label": "8–12 min",
        "min_words": 1100,
        "max_words": 1450,
        "description": "Balanced, deep conceptual exploration with relatable analogies, probing questions, and nuanced breakdowns."
    },
    "masterclass": {
        "label": "15–20 min",
        "min_words": 2000,
        "max_words": 2500,
        "description": "Comprehensive academic masterclass examining historical context, technical rigor, edge cases, and practical real-world impact."
    }
}

@celery_app.task(name="tasks.generate_podcast")
def generate_podcast_task(
    podcast_id: str,
    document_id: int,
    episodes: int,
    topic: str,
    mode: str = "dialogue",
    narrator_voice: str = None,
    duration: str = "standard",
    custom_title: str = None,
    subject: str = None
):
    import json
    import re
    import soundfile as sf
    db = SessionLocal()
    try:
        podcast = db.query(Podcast).filter(Podcast.id == podcast_id).first()
        document = db.query(Document).filter(Document.id == document_id).first()
        if not podcast or not document:
            return

        backend_dir = os.path.dirname(os.path.abspath(__file__))
        static_dir = os.path.join(backend_dir, "static")
        base_url = "http://localhost:8000/static"

        duration_tier = duration if duration in DURATION_CONFIG else "standard"
        d_config = DURATION_CONFIG[duration_tier]

        # Use an event loop to run the async LLM calls
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # -------------------------------------------------------------
        # PHASE 1: SERIES BLUEPRINT PLANNING (With Continuity Contract)
        # -------------------------------------------------------------
        content_sample = document.text_content[:7500]
        topic_focus = f"Focus on this topic/theme: {topic}." if topic else ""

        planner_prompt = f"""You are the Executive Audio Director for Shiro.ai.
Plan an engaging, bingeable {episodes}-episode educational audio series based on this source material.
Language: {podcast.language}
Target Duration: {d_config['label']} per episode ({d_config['description']})
{topic_focus}

You must return a valid JSON object strictly matching this schema:
{{
  "series_title": "Memorable, Engaging Series Title",
  "subject": "Broad subject (e.g. Physics, Computer Science, Biology, History, Mathematics)",
  "episodes": [
    {{
      "ep_number": 1,
      "title": "Compelling Episode Title",
      "opening_hook": "How this episode hooks the listener from second 1",
      "previous_recap": "N/A for episode 1, otherwise recap the core breakthrough of the previous episode",
      "core_focus": "The 2-3 specific sub-concepts explored in this episode",
      "ending_takeaway": "The unforgettable insight listeners walk away with",
      "next_episode_hook": "Cliffhanger or preview connecting into the next episode (or series conclusion for last episode)"
    }}
  ]
}}

Source Content Outline:
{content_sample}
"""
        raw_plan = loop.run_until_complete(llm_client.generate_response(planner_prompt, response_format="json_object", feature="podcast_plan"))
        clean_plan_str = raw_plan.strip()
        if clean_plan_str.startswith("```"):
            clean_plan_str = re.sub(r'^```(?:json)?\s*', '', clean_plan_str)
            clean_plan_str = re.sub(r'\s*```$', '', clean_plan_str)

        try:
            blueprint = json.loads(clean_plan_str)
        except Exception:
            blueprint = {
                "series_title": custom_title or f"Study Series: {document.filename}",
                "subject": subject or getattr(document, "subject", None) or "General",
                "episodes": [
                    {
                        "ep_number": i,
                        "title": f"Episode {i}: Deep Dive",
                        "opening_hook": "Welcome to today's deep dive.",
                        "previous_recap": "Continuing from our previous discussion." if i > 1 else "",
                        "core_focus": f"Part {i} core principles",
                        "ending_takeaway": "Key concepts mastered today.",
                        "next_episode_hook": "In our next session..." if i < episodes else "Thank you for listening."
                    }
                    for i in range(1, episodes + 1)
                ]
            }

        # Normalize subject & title
        series_title = custom_title or blueprint.get("series_title") or f"Study Series: {document.filename}"
        final_subject = normalize_subject(subject or blueprint.get("subject") or getattr(document, "subject", None))
        podcast.title = series_title
        podcast.subject = final_subject

        episode_plans = blueprint.get("episodes", [])
        while len(episode_plans) < episodes:
            curr_idx = len(episode_plans) + 1
            episode_plans.append({
                "ep_number": curr_idx,
                "title": f"Episode {curr_idx}: Conceptual Mastery",
                "opening_hook": "Let's explore the next frontier.",
                "previous_recap": "Building on what we discussed earlier.",
                "core_focus": "Deep theoretical and practical insights.",
                "ending_takeaway": "Clear conceptual takeaway.",
                "next_episode_hook": "Next episode preview." if curr_idx < episodes else "Final series conclusion."
            })

        # -------------------------------------------------------------
        # PHASE 2 & 3: SCRIPT GENERATION & AUDIO SYNTHESIS
        # -------------------------------------------------------------
        all_scripts = []
        episode_records = []

        text_len = len(document.text_content)
        chunk_size = max(1500, text_len // episodes)
        max_ep_chars = 7000  # Strict cap to prevent Groq 400 message length and Gemini 429 TPM errors

        for i, ep_plan in enumerate(episode_plans[:episodes], start=1):
            start_pos = (i - 1) * chunk_size
            end_pos = min(text_len, start_pos + min(chunk_size, max_ep_chars))
            ep_content = document.text_content[start_pos:end_pos]
            if len(ep_content) > max_ep_chars:
                ep_content = ep_content[:max_ep_chars]

            mp3_filename = f"{podcast.id}_ep{i}.mp3"
            mp3_path = os.path.join(static_dir, mp3_filename)

            is_first = (i == 1)
            is_last = (i == episodes)

            continuity_context = f"""Series: "{series_title}" (Episode {i} of {episodes})
Episode Title: "{ep_plan.get('title')}"
Opening Hook: {ep_plan.get('opening_hook')}
Previous Episode Bridge: {ep_plan.get('previous_recap') if not is_first else 'This is the opening episode. Welcome the listener into the world of this subject.'}
Core Focus: {ep_plan.get('core_focus')}
Ending Takeaway: {ep_plan.get('ending_takeaway')}
Closing Hook: {ep_plan.get('next_episode_hook') if not is_last else 'This is the grand series finale. Synthesize the key learnings into an inspiring takeaway.'}
Target Word Count: Between {d_config['min_words']} and {d_config['max_words']} words. (Crucial: Keep strictly within this word count range for natural pacing)."""

            if mode == "narrator":
                # Solo Narrator / Audiobook Mode (GIGL / Kuku FM style)
                prompt = f"""Write an immersive, educational audiobook chapter for this episode (Language: {podcast.language}).
{continuity_context}

Strict Narrative Guidelines:
1. Do NOT write any speaker markers (never write 'Narrator:', 'Speaker:', 'Host:').
2. Seamless Narrative Arc: Start with the opening hook, bridge from previous insights, explore the core focus deeply, and end with the scheduled ending takeaway and hook.
3. Write pure, spoken prose that speaks directly to the curious listener in a warm, patient educational tone.
4. Word Count: Must be between {d_config['min_words']} and {d_config['max_words']} words.

Source Material for this Episode:
{ep_content}"""

                script_resp = loop.run_until_complete(llm_client.generate_response(prompt, feature="podcast_script"))
                all_scripts.append(f"### {ep_plan.get('title')}\n\n{script_resp}")
                chosen_voice = narrator_voice or "en-US-AndrewNeural"
                tts_client.text_to_speech(script_resp, mp3_path, lang=podcast.language, voice=chosen_voice)

            else:
                # Multi-Speaker Dual-Host Podcast (Pocket FM / NPR style)
                prompt = f"""Generate a vibrant two-speaker conversational podcast script for this episode (Language: {podcast.language}).
The two speakers are:
- "host" (Andrew): Articulate, confident professor guiding the academic inquiry.
- "cohost" (Ava): Curious, thoughtful student/educator asking intuitive questions and sharing relatable analogies.

{continuity_context}

Target format: Return a JSON object with alternating dialogue turns:
{{
  "mode": "dual",
  "segments": [
    {{"speaker": "host", "text": "..."}},
    {{"speaker": "cohost", "text": "..."}}
  ]
}}

Strict Guidelines:
1. Return ONLY valid JSON.
2. The speaker field must be strictly "host" or "cohost".
3. Dialogue must start with the opening hook, transition naturally from previous insights, explore the core focus, and close with the scheduled wrap-up.
4. Total dialogue word count must be between {d_config['min_words']} and {d_config['max_words']} words.

Source Material for this Episode:
{ep_content}"""

                script_resp = loop.run_until_complete(llm_client.generate_response(prompt, response_format="json_object", feature="podcast_script"))
                all_scripts.append(f"### {ep_plan.get('title')}\n\n{script_resp}")

                # Parse JSON segments with fallback
                segments = None
                try:
                    clean_json = script_resp.strip()
                    if clean_json.startswith("```"):
                        clean_json = re.sub(r'^```(?:json)?\s*', '', clean_json)
                        clean_json = re.sub(r'\s*```$', '', clean_json)
                    parsed = json.loads(clean_json)
                    if isinstance(parsed, dict) and "segments" in parsed:
                        segments = parsed["segments"]
                except Exception:
                    segments = None

                if segments and isinstance(segments, list) and len(segments) > 0:
                    tts_client.text_to_speech_segments(segments, mp3_path, lang=podcast.language)
                else:
                    tts_client.text_to_speech(script_resp, mp3_path, lang=podcast.language)

            # -------------------------------------------------------------
            # PHASE 4: MEASURE ACTUAL AUDIO DURATION
            # -------------------------------------------------------------
            dur_secs = 0
            dur_formatted = d_config["label"]
            try:
                if os.path.exists(mp3_path):
                    sf_info = sf.info(mp3_path)
                    dur_secs = int(sf_info.duration)
                    mins = dur_secs // 60
                    secs = dur_secs % 60
                    dur_formatted = f"{mins:02d}:{secs:02d}"
            except Exception as ex:
                logger.warning(f"Could not read audio duration via soundfile: {ex}")

            episode_records.append({
                "ep_number": i,
                "title": ep_plan.get("title", f"Episode {i}: Deep Dive"),
                "audio_url": f"{base_url}/{mp3_filename}",
                "duration_seconds": dur_secs,
                "duration_formatted": dur_formatted,
                "duration_tier": duration_tier,
                "summary": ep_plan.get("core_focus", ""),
                "voice_mode": mode
            })

        final_script = "\n\n".join(all_scripts)
        podcast.script_content = final_script[:20000]
        podcast.episodes = episode_records
        podcast.status = "completed"
        db.commit()

    except Exception as e:
        logger.error(f"Podcast Task Failed: {e}", exc_info=True)
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


