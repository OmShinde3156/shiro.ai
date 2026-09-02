from sqlalchemy.orm import Session
from models.database import ChatHistory, Document, User, StudyRoom, RoomMessage, QuizResult
from database.vector_db import VectorDB
from utils.llm_client import llm_client
from services.graph_service import GraphService
from services.progress_service import ProgressService
from services.timetable_service import TimetableService
from prompts.prompt_registry import prompt_registry
from typing import List, Dict, Any, Optional, AsyncGenerator
import asyncio
import json
import time
import math
import datetime
import logging
import re
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# --- Pydantic Schemas for Citations & Provenance (RAG-01) ---

class Citation(BaseModel):
    id: str = Field(description="Unique identifier, e.g. cit-1")
    chunk_id: Optional[str] = None
    document_id: int
    document_version: int = 1
    page_number: int = 1
    filename: str
    content: str
    rrf_score: float = 0.0


class ChatService:
    def __init__(self):
        self.vector_db = VectorDB()
        self.graph_service = GraphService()
        self.progress_service = ProgressService()
        self.timetable_service = TimetableService()

    def get_chat_history(self, user_id: int, limit: int, db: Session) -> List[Dict[str, Any]]:
        """Retrieve recent chat history for the authenticated user"""
        history = (
            db.query(ChatHistory)
            .filter(ChatHistory.user_id == user_id)
            .order_by(ChatHistory.timestamp.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": h.id,
                "message": h.message,
                "response": h.response,
                "document_ids": h.document_ids or [],
                "language": h.language,
                "status": getattr(h, "status", "completed"),
                "latency_ms": getattr(h, "latency_ms", 0),
                "timestamp": h.timestamp.isoformat() if h.timestamp else None
            }
            for h in reversed(history)
        ]

    def _estimate_tokens(self, text: str) -> int:
        """Lightweight token estimator (~4 chars per token)"""
        return max(1, len(text) // 4)

    def get_document_profile(self, document_id: int, user_id: int, db: Session) -> Dict[str, Any]:
        """
        Calculates reading time, deep study time, word count, key topics, and difficulty
        for a document to power instant learning analysis.
        """
        doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()
        if not doc:
            return {
                "document_id": document_id,
                "filename": "Unknown",
                "word_count": 0,
                "reading_time_mins": 0,
                "deep_study_time_mins": 0,
                "difficulty": "Medium",
                "key_topics": [],
                "summary_preview": "Document not found."
            }

        text = doc.text_content or ""
        words = text.split()
        word_count = len(words)
        reading_time = max(1, math.ceil(word_count / 200)) # ~200 WPM
        deep_study_time = max(2, math.ceil(word_count / 80)) # ~80 WPM with comprehension

        # Extract headings or structured phrases as key topics
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        candidate_topics = []
        for line in lines[:80]:
            if line.startswith(("#", "Chapter", "Section", "Topic", "Unit", "1.", "2.", "3.", "4.", "5.")):
                clean_line = re.sub(r'^[#0-9\.\-\:\*]+\s*', '', line).strip()
                if 3 < len(clean_line) < 60:
                    candidate_topics.append(clean_line)

        # Fallback topics from frequent capitalized keywords
        if len(candidate_topics) < 3:
            cap_words = re.findall(r'\b[A-Z][a-zA-Z]{3,}\b', text[:3000])
            freq = {}
            for w in cap_words:
                if w.lower() not in {"this", "that", "there", "these", "which", "where", "what", "with", "from", "chapter", "page", "section"}:
                    freq[w] = freq.get(w, 0) + 1
            sorted_kw = sorted(freq.items(), key=lambda x: x[1], reverse=True)
            for kw, _ in sorted_kw[:6]:
                if kw not in candidate_topics:
                    candidate_topics.append(kw)

        key_topics = candidate_topics[:6] if candidate_topics else ["Core Concepts", "Definitions", "Applied Examples"]

        # Difficulty heuristic based on average word length
        avg_word_len = sum(len(w) for w in words[:500]) / max(1, len(words[:500])) if words else 5.0
        if avg_word_len > 6.2:
            difficulty = "Advanced"
        elif avg_word_len > 5.2:
            difficulty = "Intermediate"
        else:
            difficulty = "Beginner"

        preview = text[:350].replace("\n", " ").strip() + "..." if text else "No content preview available."

        return {
            "document_id": doc.id,
            "filename": doc.filename,
            "word_count": word_count,
            "reading_time_mins": reading_time,
            "deep_study_time_mins": deep_study_time,
            "difficulty": difficulty,
            "key_topics": key_topics,
            "summary_preview": preview
        }

    def _detect_intent(
        self,
        message: str,
        context_scope: str,
        document_ids: List[int],
        active_document_id: Optional[int],
        selected_text: Optional[str]
    ) -> str:
        """
        Infers query category:
        - "library_meta": Inquiring about uploaded documents/stats
        - "study_progress": Asking for learning recommendations / weakness analysis
        - "doc_profiling": Asking for study time, difficulty, or high-yield topics
        - "text_selection": Explicit focus on highlighted text
        - "doc_rag": Grounded retrieval on specific document(s)
        - "cross_doc_rag": Grounded retrieval across full user library
        - "general_tutor": Open-domain pedagogical guidance
        """
        msg_lower = message.lower().strip()

        if selected_text and len(selected_text.strip()) > 3:
            return "text_selection"

        # 1. Library Meta queries
        meta_patterns = [
            r"\bwhich doc(ument)?s?\b",
            r"\bwhat doc(ument)?s?\b",
            r"\bhow many doc(ument)?s?\b",
            r"\blist (my )?doc(ument)?s?\b",
            r"\bshow (my )?doc(ument)?s?\b",
            r"\bwhat (is|do I have) in my library\b",
            r"\bmy files\b",
            r"\bmy uploaded\b",
            r"\bwhich pdfs?\b"
        ]
        if any(re.search(p, msg_lower) for p in meta_patterns):
            return "library_meta"

        # 2. Progress / Study Recommendation queries
        progress_patterns = [
            r"\bwhat should i study\b",
            r"\bwhat to study today\b",
            r"\bhow am i doing\b",
            r"\bmy progress\b",
            r"\bmy streak\b",
            r"\bweak topics?\b",
            r"\bwhat did i learn\b",
            r"\brecommend(ation)?s?\b"
        ]
        if any(re.search(p, msg_lower) for p in progress_patterns):
            return "study_progress"

        # 3. Document Profiling queries
        profiling_patterns = [
            r"\bhow (much )?time\b",
            r"\bhow long\b",
            r"\btime (to |will it )?take\b",
            r"\bstudy time\b",
            r"\bimportant (topic|question|point)s?\b",
            r"\bhigh[- ]yield\b",
            r"\bkey topics?\b",
            r"\bexam topics?\b",
            r"\bwhat is this (doc(ument)?|file|pdf) about\b",
            r"\bsummarize this (doc(ument)?|file|pdf)\b"
        ]
        if (context_scope == "DOCUMENT" or active_document_id) and any(re.search(p, msg_lower) for p in profiling_patterns):
            return "doc_profiling"

        # 4. Scope-dependent intent
        if context_scope == "DOCUMENT" or active_document_id or len(document_ids) == 1:
            return "doc_rag"

        if context_scope == "LIBRARY" or any(w in msg_lower for w in ["in my notes", "from my documents", "in my pdfs", "in my library"]):
            return "cross_doc_rag"

        if context_scope == "ROOM":
            return "room_copilot"

        # Default for dashboard is general tutor
        return "general_tutor"

    def _build_pedagogy_block(
        self,
        mode: str,
        response_style: str,
        use_examples: bool,
        explain_terms: bool,
        ask_followups: bool,
        learning_goal: Optional[str],
        current_level: Optional[str]
    ) -> str:
        """Construct structured pedagogical prompt instructions (Budget ~400 tokens)"""
        pedagogy_instructions = []
        mode_clean = (mode or "").lower()
        if mode_clean in ["surgical", "exam"]:
            pedagogy_instructions.append("PEDAGOGICAL MODE: SURGICAL EXAM MODE. Provide crisp, high-yield bullet points, strict definitions, and exact scoring criteria.")
        elif mode_clean == "feynman":
            pedagogy_instructions.append("PEDAGOGICAL MODE: FEYNMAN CHALLENGE. Use plain English metaphors, zero jargon, and evaluate understanding intuitively.")
        else:
            pedagogy_instructions.append("PEDAGOGICAL MODE: SOCRATIC TUTOR. Guide the student step-by-step with intuitive analogies and conceptual questions.")

        if response_style == "concise":
            pedagogy_instructions.append("RESPONSE DEPTH: Concise, direct, and tightly summarized.")
        elif response_style == "detailed":
            pedagogy_instructions.append("RESPONSE DEPTH: Comprehensive, deep-dive academic explanation.")
        else:
            pedagogy_instructions.append("RESPONSE DEPTH: Balanced depth and readability.")

        if use_examples:
            pedagogy_instructions.append("STYLE: Include real-world intuitive examples.")
        if explain_terms:
            pedagogy_instructions.append("STYLE: Clearly explain any difficult academic terminology.")
        if ask_followups:
            pedagogy_instructions.append("STYLE: Conclude with a thought-provoking follow-up question to verify comprehension.")
        if learning_goal:
            pedagogy_instructions.append(f"STUDENT LEARNING GOAL: {learning_goal}")
        if current_level:
            pedagogy_instructions.append(f"STUDENT ACADEMIC LEVEL: {current_level}")

        return "\n".join(pedagogy_instructions)

    def _build_dynamic_context(
        self,
        user_id: int,
        message: str,
        context_scope: str,
        document_ids: List[int],
        active_document_id: Optional[int],
        room_id: Optional[str],
        selected_text: Optional[str],
        intent: str,
        db: Optional[Session],
        max_evidence_tokens: int = 1400,
        max_history_tokens: int = 1000,
        max_summary_tokens: int = 600
    ) -> Dict[str, Any]:
        """
        Builds dynamic context based on the resolved intent and context scope:
        - Meta-data injection for Library queries
        - Study progress summary for Progress queries
        - Document profiling / selected excerpt injection for Document queries
        - Room shared notes & chat for Room queries
        - Vector RAG evidence chunks for document retrieval
        """
        sources: List[Dict[str, Any]] = []
        evidence_text_parts = []
        evidence_tokens = 0
        context_meta_parts = []

        if db:
            # 1. Handle Library Metadata Intent
            if intent == "library_meta" or context_scope == "LIBRARY":
                user_docs = db.query(Document).filter(Document.user_id == user_id).order_by(Document.upload_date.desc()).all()
                if user_docs:
                    doc_lines = []
                    for d in user_docs:
                        subject = d.subject or "General"
                        date_str = d.upload_date.strftime("%Y-%m-%d") if d.upload_date else "Recent"
                        words = len((d.text_content or "").split())
                        doc_lines.append(f"- **{d.filename}** (ID: {d.id}, Subject: {subject}, ~{words} words, Uploaded: {date_str})")
                    context_meta_parts.append("USER'S CURRENT LIBRARY INVENTORY:\n" + "\n".join(doc_lines))
                else:
                    context_meta_parts.append("USER'S LIBRARY: The user currently has 0 uploaded documents in their library.")

            # 2. Handle Student Progress / Recommendation Intent
            if intent == "study_progress":
                try:
                    user = db.query(User).filter(User.id == user_id).first()
                    recent_results = db.query(QuizResult).filter(QuizResult.user_id == user_id).order_by(QuizResult.taken_at.desc()).limit(5).all()
                    streak = getattr(user, "streak", 1) if user else 1
                    xp = getattr(user, "xp", 0) if user else 0
                    avg_score = round(sum(r.score for r in recent_results) / len(recent_results), 1) if recent_results else 75.0
                    context_meta_parts.append(
                        f"STUDENT PROGRESS PROFILE:\n- Current Streak: {streak} days\n- Total XP: {xp}\n- Recent Average Quiz Score: {avg_score}%\n- Total Quizzes Taken: {len(recent_results)}"
                    )
                except Exception as e:
                    logger.warning(f"Error gathering progress profile: {e}")

            # 3. Handle Document Profiling & Selected Text
            target_doc_id = active_document_id or (document_ids[0] if len(document_ids) == 1 else None)
            if target_doc_id:
                profile = self.get_document_profile(target_doc_id, user_id, db)
                context_meta_parts.append(
                    f"ACTIVE DOCUMENT PROFILE:\n- Filename: {profile['filename']}\n- Length: ~{profile['word_count']} words\n- Estimated Reading Time: {profile['reading_time_mins']} mins\n- Deep Study Time: {profile['deep_study_time_mins']} mins\n- Difficulty: {profile['difficulty']}\n- Key Topics Identified: {', '.join(profile['key_topics'])}\n- Document Excerpt Preview: {profile['summary_preview']}"
                )

            if selected_text and len(selected_text.strip()) > 3:
                context_meta_parts.append(f"USER HIGHLIGHTED TEXT EXCERPT:\n\"\"\"\n{selected_text.strip()}\n\"\"\"")

            # 4. Handle Study Room Context
            if context_scope == "ROOM" and room_id:
                room = db.query(StudyRoom).filter(StudyRoom.id == room_id).first()
                if room:
                    room_msgs = db.query(RoomMessage).filter(RoomMessage.room_id == room_id).order_by(RoomMessage.created_at.desc()).limit(10).all()
                    msg_history = [f"{('Shiro' if m.is_ai else (m.user.name if m.user else 'Student'))}: {m.content}" for m in reversed(room_msgs)]
                    context_meta_parts.append(
                        f"STUDY ROOM INFO:\n- Room: {room.name} (Subject: {room.subject})\n- Recent Room Discussion:\n" + "\n".join(msg_history)
                    )

            # 5. Hybrid RAG Retrieval (for doc_rag or cross_doc_rag)
            effective_doc_ids = []
            if intent in ["doc_rag", "text_selection"] and target_doc_id:
                effective_doc_ids = [target_doc_id]
            elif document_ids:
                effective_doc_ids = document_ids
            elif intent == "cross_doc_rag":
                all_user_docs = db.query(Document).filter(Document.user_id == user_id).all()
                effective_doc_ids = [d.id for d in all_user_docs]

            if effective_doc_ids:
                docs = db.query(Document).filter(Document.id.in_(effective_doc_ids), Document.user_id == user_id).all()
                for doc in docs:
                    if doc.vector_db_id:
                        try:
                            hybrid_chunks = self.vector_db.hybrid_search_with_rerank(
                                collection_name=doc.vector_db_id,
                                query=message if not selected_text else f"{message} {selected_text[:100]}",
                                user_id=user_id,
                                document_id=doc.id,
                                document_version=getattr(doc, "version", 1),
                                n_results=4
                            )
                            for chunk in hybrid_chunks:
                                cit_id = f"cit-{len(sources) + 1}"
                                page_num = chunk.get("page_number", 1)
                                content = chunk.get("content", "")
                                chunk_tokens = self._estimate_tokens(content)

                                if evidence_tokens + chunk_tokens > max_evidence_tokens:
                                    remaining_chars = (max_evidence_tokens - evidence_tokens) * 4
                                    if remaining_chars > 80:
                                        content = content[:remaining_chars] + "..."
                                    else:
                                        break

                                chunk_entry = f"[{cit_id} from {doc.filename}, Page {page_num}]: {content}\n"
                                evidence_text_parts.append(chunk_entry)
                                evidence_tokens += self._estimate_tokens(chunk_entry)

                                sources.append({
                                    "id": cit_id,
                                    "chunk_id": chunk.get("chunk_id"),
                                    "document_id": doc.id,
                                    "document_version": getattr(doc, "version", 1),
                                    "page_number": page_num,
                                    "filename": doc.filename,
                                    "content": content,
                                    "rrf_score": chunk.get("rrf_score", 0.0)
                                })
                        except Exception as e:
                            logger.warning(f"Retrieval failed for doc {doc.id}: {e}")

            # 6. Multi-Turn Conversation Budgeting & Summarization (Deterministic Token Control)
            all_recent = (
                db.query(ChatHistory)
                .filter(ChatHistory.user_id == user_id)
                .order_by(ChatHistory.timestamp.desc())
                .limit(20)
                .all()
            )

            recent_history_parts = []
            older_turns = []
            recent_tokens = 0

            # Iterate from newest to oldest to fit most recent turns first
            for h in all_recent:
                turn_str = f"User: {h.message}\nShiro: {h.response}\n"
                t_count = self._estimate_tokens(turn_str)
                if recent_tokens + t_count <= max_history_tokens:
                    recent_history_parts.insert(0, turn_str)
                    recent_tokens += t_count
                else:
                    older_turns.insert(0, h)

            recent_history_text = "\n".join(recent_history_parts)

            # Summarize older overflow turns into a compact topic summary
            summary_text = ""
            if older_turns:
                topic_bullets = []
                summary_tokens = 0
                for h in older_turns[-6:]:
                    short_q = (h.message[:60] + "...") if len(h.message) > 60 else h.message
                    bullet = f"- Discussed: {short_q}"
                    b_toks = self._estimate_tokens(bullet)
                    if summary_tokens + b_toks <= max_summary_tokens:
                        topic_bullets.append(bullet)
                        summary_tokens += b_toks
                if topic_bullets:
                    summary_text = "\n".join(topic_bullets)

            # 7. Knowledge Graph Context
            graph_context = ""
            try:
                graph_context = self.graph_service.get_related_concepts(message, user_id, db, min_confidence=0.6)
            except Exception:
                pass
        else:
            recent_history_text = ""
            summary_text = ""
            graph_context = ""

        # Assemble unified dynamic context
        full_context_blocks = []
        if context_meta_parts:
            full_context_blocks.append("\n\n".join(context_meta_parts))
        if summary_text:
            full_context_blocks.append(f"PREVIOUS SESSION TOPIC SUMMARY:\n{summary_text}")
        if recent_history_text:
            full_context_blocks.append(f"RECENT CONVERSATION TURNS:\n{recent_history_text}")
        if graph_context:
            full_context_blocks.append(f"CONCEPT CONNECTIONS:\n{graph_context}")
        if evidence_text_parts:
            full_context_blocks.append(f"VERIFIED EVIDENCE CHUNKS:\n{''.join(evidence_text_parts)}")

        return {
            "context_text": "\n\n".join(full_context_blocks),
            "sources": sources,
            "evidence_count": len(sources),
            "intent": intent
        }

    def _build_deterministic_context(
        self,
        user_id: int,
        message: str,
        document_ids: List[int] = None,
        db: Optional[Session] = None,
        max_evidence_tokens: int = 1400,
        max_history_tokens: int = 1000,
        max_summary_tokens: int = 600
    ) -> Dict[str, Any]:
        """Deterministic context builder conforming to test contract"""
        return self._build_dynamic_context(
            user_id=user_id,
            message=message,
            context_scope="GLOBAL" if not document_ids else "DOCUMENT",
            document_ids=document_ids or [],
            active_document_id=document_ids[0] if document_ids and len(document_ids) == 1 else None,
            room_id=None,
            selected_text=None,
            intent="doc_rag" if document_ids else "general_tutor",
            db=db,
            max_evidence_tokens=max_evidence_tokens,
            max_history_tokens=max_history_tokens,
            max_summary_tokens=max_summary_tokens
        )

    def _infer_study_action(
        self,
        message: str,
        response_text: str,
        sources: List[Dict[str, Any]],
        document_ids: List[int],
        mode: str,
        context_scope: str = "GLOBAL"
    ) -> Dict[str, Any]:
        """Infers structured action handoff based on user intent, pedagogy mode, and content"""
        msg_lower = message.lower()
        topic = message.strip().strip("?.!")[:60]
        summary_excerpt = response_text[:180].replace("\n", " ").strip() + "..." if response_text else ""
        source_cit_ids = [s["id"] for s in sources]

        if any(w in msg_lower for w in ["quiz", "test", "exam", "mcq", "practice question"]):
            tool = "quiz"
            title = f"Practice Quiz: {topic}"
        elif any(w in msg_lower for w in ["flashcard", "card", "definition", "formula", "remember", "memorize"]):
            tool = "flashcards"
            title = f"Flashcard Deck: {topic}"
        elif any(w in msg_lower for w in ["feynman", "explain to a child", "intuitive", "analogy", "why does"]):
            tool = "feynman"
            title = f"Feynman Challenge: {topic}"
        elif any(w in msg_lower for w in ["mind map", "mindmap", "graph", "hierarchy", "structure"]):
            tool = "mindmap"
            title = f"Concept Mind Map: {topic}"
        elif any(w in msg_lower for w in ["note", "summary", "takeaway", "bullet"]):
            tool = "summary"
            title = f"Study Notes: {topic}"
        else:
            if mode == "surgical":
                tool = "quiz"
                title = f"Verify Knowledge: {topic}"
            else:
                tool = "flashcards"
                title = f"Review Flashcards: {topic}"

        return {
            "tool": tool,
            "title": title,
            "topic": topic,
            "document_ids": document_ids,
            "source_citations": source_cit_ids,
            "summary": summary_excerpt,
            "difficulty": "medium",
            "mode": mode,
            "context_scope": context_scope
        }

    async def stream_chat_with_documents(
        self,
        user_id: int,
        message: str,
        document_ids: List[int] = [],
        active_document_id: Optional[int] = None,
        context_scope: str = "GLOBAL",
        room_id: Optional[str] = None,
        selected_text: Optional[str] = None,
        language: str = "en",
        db: Optional[Session] = None,
        mode: str = "human",
        response_style: str = "balanced",
        use_examples: bool = True,
        explain_terms: bool = True,
        ask_followups: bool = True,
        learning_goal: Optional[str] = None,
        current_level: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Unified Real-Time Server-Sent Events (SSE) Streaming Pipeline across all Context Scopes:
        - GLOBAL: General Tutor & Library Assistant
        - LIBRARY: Knowledge Librarian & Metadata Navigator
        - DOCUMENT: Deep Document Copilot with Citations & Profiling
        - ROOM: Collaborative Study Room Facilitator
        """
        start_time = time.time()
        event_id = 1

        def _format_sse(event_type: str, payload: Dict[str, Any]) -> str:
            nonlocal event_id
            payload["event_id"] = event_id
            payload["timestamp"] = datetime.datetime.utcnow().isoformat() + "Z"
            frame = f"id: {event_id}\nevent: {event_type}\ndata: {json.dumps(payload)}\n\n"
            event_id += 1
            return frame

        # 1. Resolve Intent
        intent = self._detect_intent(
            message=message,
            context_scope=context_scope,
            document_ids=document_ids,
            active_document_id=active_document_id,
            selected_text=selected_text
        )

        status_msg = "Consulting Shiro Tutor..."
        if intent == "library_meta":
            status_msg = "Scanning your library inventory..."
        elif intent == "study_progress":
            status_msg = "Reviewing your study progress & streak..."
        elif intent == "doc_profiling":
            status_msg = "Analyzing document structure & study time..."
        elif intent in ["doc_rag", "cross_doc_rag"]:
            status_msg = "Searching verified document passages..."
        elif intent == "text_selection":
            status_msg = "Analyzing highlighted excerpt..."
        elif context_scope == "ROOM":
            status_msg = "Connecting with room discussion & materials..."

        yield _format_sse("status", {"type": "status", "step": status_msg})

        # 2. Build Dynamic Context
        retrieval_start = time.time()
        context_data = self._build_dynamic_context(
            user_id=user_id,
            message=message,
            context_scope=context_scope,
            document_ids=document_ids,
            active_document_id=active_document_id,
            room_id=room_id,
            selected_text=selected_text,
            intent=intent,
            db=db
        )
        retrieval_ms = int((time.time() - retrieval_start) * 1000)
        sources = context_data["sources"]
        context_text = context_data["context_text"]

        # 3. Emit Citations (if any retrieved)
        if sources:
            yield _format_sse("status", {"type": "status", "step": f"Verified {len(sources)} citations from study materials."})
            for src in sources:
                yield _format_sse("citation", {"type": "citation", "citation": src})

        # 4. Select Matching Prompt Definition
        if intent == "library_meta" or context_scope == "LIBRARY":
            prompt_def = prompt_registry.get("library_navigator", "v1.0")
            feature_tag = "library_navigator"
        elif context_scope == "DOCUMENT" or intent in ["doc_rag", "doc_profiling", "text_selection"]:
            prompt_def = prompt_registry.get("rag_document", "v1.0")
            feature_tag = "rag_document"
        elif context_scope == "ROOM":
            prompt_def = prompt_registry.get("room_copilot", "v1.0")
            feature_tag = "room_copilot"
        else:
            prompt_def = prompt_registry.get("tutor", "v1.0")
            feature_tag = "tutor"

        # 5. Build Pedagogy & Full LLM Prompt
        pedagogy_block = self._build_pedagogy_block(
            mode=mode,
            response_style=response_style,
            use_examples=use_examples,
            explain_terms=explain_terms,
            ask_followups=ask_followups,
            learning_goal=learning_goal,
            current_level=current_level
        )

        system_prompt = prompt_def.template.format(question=message, context=context_text)
        full_llm_prompt = f"{system_prompt}\n\n{pedagogy_block}\n\nUSER QUESTION: {message}\n\nProvide a direct, well-formatted markdown response in {language}."

        accumulated_tokens = []
        ttft_ms = 0
        stream_status = "completed"

        try:
            # 6. Stream LLM Tokens
            async for chunk in llm_client.stream_with_governance(
                prompt=full_llm_prompt,
                feature=feature_tag,
                prompt_version=prompt_def.version,
                user_id=user_id,
                db=db
            ):
                chunk_type = chunk.get("type")
                if chunk_type == "token":
                    delta = chunk.get("delta", "")
                    if delta:
                        if not ttft_ms and chunk.get("ttft_ms"):
                            ttft_ms = chunk.get("ttft_ms")
                        accumulated_tokens.append(delta)
                        yield _format_sse("token", {"type": "token", "delta": delta})
                elif chunk_type == "done":
                    ai_metrics = chunk.get("metrics", {})
                    if not ttft_ms:
                        ttft_ms = ai_metrics.get("ttft_ms", 0)

        except (asyncio.CancelledError, GeneratorExit):
            logger.info("Client cancelled active chat stream.")
            stream_status = "stopped"
        except Exception as ex:
            logger.error(f"Streaming error occurred: {ex}")
            stream_status = "failed"
            yield _format_sse("error", {"type": "error", "code": "STREAM_ERROR", "message": str(ex)})

        # 7. Final Response & Action Handoff
        final_response = "".join(accumulated_tokens).strip()
        if not final_response and stream_status == "failed":
            final_response = "I encountered an issue generating a response. Please try asking again."

        total_latency_ms = int((time.time() - start_time) * 1000)

        effective_ids = [active_document_id] if active_document_id else document_ids
        if stream_status == "completed" and final_response:
            action_handoff = self._infer_study_action(
                message=message,
                response_text=final_response,
                sources=sources,
                document_ids=effective_ids,
                mode=mode,
                context_scope=context_scope
            )
            yield _format_sse("action", {"type": "action", "handoff": action_handoff})

        # 8. Emit Done Event
        yield _format_sse("done", {
            "type": "done",
            "status": stream_status,
            "metrics": {
                "retrieval_ms": retrieval_ms,
                "ttft_ms": ttft_ms,
                "total_latency_ms": total_latency_ms,
                "sources_count": len(sources),
                "context_scope": context_scope,
                "intent": intent
            }
        })

        # 9. Persist History
        if db:
            try:
                chat_entry = ChatHistory(
                    user_id=user_id,
                    message=message,
                    response=final_response or "(stream aborted)",
                    document_ids=effective_ids,
                    language=language,
                    status=stream_status,
                    latency_ms=total_latency_ms
                )
                db.add(chat_entry)
                db.commit()
            except Exception as db_err:
                logger.error(f"Failed to persist chat history: {db_err}")
                db.rollback()

    async def chat_with_documents(
        self,
        user_id: int,
        message: str,
        document_ids: List[int] = [],
        active_document_id: Optional[int] = None,
        context_scope: str = "GLOBAL",
        room_id: Optional[str] = None,
        selected_text: Optional[str] = None,
        language: str = "en",
        db: Optional[Session] = None,
        mode: str = "human",
        response_style: str = "balanced",
        use_examples: bool = True,
        explain_terms: bool = True,
        ask_followups: bool = True,
        learning_goal: Optional[str] = None,
        current_level: Optional[str] = None
    ) -> Dict[str, Any]:
        """Synchronous wrapper for unified chat engine"""
        intent = self._detect_intent(
            message=message,
            context_scope=context_scope,
            document_ids=document_ids,
            active_document_id=active_document_id,
            selected_text=selected_text
        )

        context_data = self._build_dynamic_context(
            user_id=user_id,
            message=message,
            context_scope=context_scope,
            document_ids=document_ids,
            active_document_id=active_document_id,
            room_id=room_id,
            selected_text=selected_text,
            intent=intent,
            db=db
        )
        sources = context_data["sources"]
        context_text = context_data["context_text"]

        if intent == "library_meta" or context_scope == "LIBRARY":
            prompt_def = prompt_registry.get("library_navigator", "v1.0")
            feature_tag = "library_navigator"
        elif context_scope == "DOCUMENT" or intent in ["doc_rag", "doc_profiling", "text_selection"]:
            prompt_def = prompt_registry.get("rag_document", "v1.0")
            feature_tag = "rag_document"
        elif context_scope == "ROOM":
            prompt_def = prompt_registry.get("room_copilot", "v1.0")
            feature_tag = "room_copilot"
        else:
            prompt_def = prompt_registry.get("tutor", "v1.0")
            feature_tag = "tutor"

        pedagogy_block = self._build_pedagogy_block(
            mode=mode,
            response_style=response_style,
            use_examples=use_examples,
            explain_terms=explain_terms,
            ask_followups=ask_followups,
            learning_goal=learning_goal,
            current_level=current_level
        )

        system_prompt = prompt_def.template.format(question=message, context=context_text)
        full_llm_prompt = f"{system_prompt}\n\n{pedagogy_block}\n\nUSER QUESTION: {message}\n\nProvide a direct, well-formatted markdown response in {language}."

        start_time = time.time()
        ai_result = await llm_client.execute_with_governance(
            prompt=full_llm_prompt,
            feature=feature_tag,
            prompt_version=prompt_def.version,
            user_id=user_id,
            db=db
        )
        total_latency_ms = int((time.time() - start_time) * 1000)
        final_response = ai_result.content

        effective_ids = [active_document_id] if active_document_id else document_ids
        action_handoff = self._infer_study_action(
            message=message,
            response_text=final_response,
            sources=sources,
            document_ids=effective_ids,
            mode=mode,
            context_scope=context_scope
        )

        if db:
            try:
                chat_entry = ChatHistory(
                    user_id=user_id,
                    message=message,
                    response=final_response,
                    document_ids=effective_ids,
                    language=language,
                    status="completed",
                    latency_ms=total_latency_ms
                )
                db.add(chat_entry)
                db.commit()
            except Exception:
                db.rollback()

        return {
            "response": final_response,
            "sources": sources,
            "citations": sources,
            "suggested_action": action_handoff.get("tool"),
            "action_handoff": action_handoff,
            "language": language,
            "context_scope": context_scope
        }


