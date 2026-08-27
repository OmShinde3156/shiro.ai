from sqlalchemy.orm import Session
from models.database import ChatHistory, Document, User
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

    def _build_deterministic_context(
        self,
        user_id: int,
        message: str,
        document_ids: List[int],
        db: Session,
        max_evidence_tokens: int = 1400,
        max_history_tokens: int = 1000,
        max_summary_tokens: int = 600
    ) -> Dict[str, Any]:
        """
        Builds a multi-tier token-budgeted context:
        - RAG Evidence Chunks (up to max_evidence_tokens)
        - Recent Conversation turns (up to max_history_tokens)
        - Rolling Summary of older turns (up to max_summary_tokens)
        - Knowledge Graph connections (up to 400 tokens)
        """
        sources: List[Dict[str, Any]] = []
        evidence_text_parts = []
        evidence_tokens = 0

        # 1. RAG Retrieval with Token Slicing
        if document_ids:
            documents = (
                db.query(Document)
                .filter(Document.id.in_(document_ids), Document.user_id == user_id)
                .all()
            )
            for doc in documents:
                if doc.vector_db_id:
                    try:
                        hybrid_chunks = self.vector_db.hybrid_search_with_rerank(
                            collection_name=doc.vector_db_id,
                            query=message,
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
                                # Truncate chunk to fit remaining budget
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

        # 2. Multi-Turn Conversation Budgeting
        all_recent = (
            db.query(ChatHistory)
            .filter(ChatHistory.user_id == user_id)
            .order_by(ChatHistory.timestamp.desc())
            .limit(10)
            .all()
        )
        all_recent_reversed = list(reversed(all_recent))

        recent_turns = []
        older_turns = []
        if len(all_recent_reversed) > 4:
            older_turns = all_recent_reversed[:-4]
            recent_turns = all_recent_reversed[-4:]
        else:
            recent_turns = all_recent_reversed

        # Build recent turns within token budget
        recent_history_parts = []
        recent_tokens = 0
        for h in recent_turns:
            turn_str = f"User: {h.message}\nShiro: {h.response}\n"
            t_count = self._estimate_tokens(turn_str)
            if recent_tokens + t_count <= max_history_tokens:
                recent_history_parts.append(turn_str)
                recent_tokens += t_count

        recent_history_text = "\n".join(recent_history_parts)

        # Build rolling summary of older turns
        rolling_summary_text = ""
        if older_turns:
            summary_snippets = [f"- Topic: {h.message[:60]}... -> Answered: {h.response[:80]}..." for h in older_turns]
            combined_older = "\n".join(summary_snippets)
            if self._estimate_tokens(combined_older) > max_summary_tokens:
                combined_older = combined_older[: max_summary_tokens * 4] + "..."
            rolling_summary_text = f"PREVIOUS SESSION TOPIC SUMMARY:\n{combined_older}\n"

        # 3. Knowledge Graph Connections
        graph_context = ""
        try:
            graph_context = self.graph_service.get_related_concepts(message, user_id, db, min_confidence=0.6)
        except Exception:
            pass

        full_context = ""
        if rolling_summary_text:
            full_context += f"{rolling_summary_text}\n"
        if recent_history_text:
            full_context += f"RECENT CONVERSATION TURNS:\n{recent_history_text}\n\n"
        if graph_context:
            full_context += f"PREVIOUS CONCEPT CONNECTIONS:\n{graph_context}\n\n"
        if evidence_text_parts:
            full_context += f"VERIFIED EVIDENCE CHUNKS:\n{''.join(evidence_text_parts)}"

        return {
            "context_text": full_context,
            "sources": sources,
            "evidence_count": len(sources)
        }

    def _infer_study_action(
        self,
        message: str,
        response_text: str,
        sources: List[Dict[str, Any]],
        document_ids: List[int],
        mode: str
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
        else:
            # Socratic default: recommend next learning drill
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
            "mode": mode
        }

    async def stream_chat_with_documents(
        self,
        user_id: int,
        message: str,
        document_ids: List[int],
        language: str,
        db: Session,
        mode: str = "human",
        response_style: str = "balanced",
        use_examples: bool = True,
        explain_terms: bool = True,
        ask_followups: bool = True,
        learning_goal: Optional[str] = None,
        current_level: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Real-Time Server-Sent Events (SSE) Streaming Pipeline:
        Emits typed events conforming to the Frozen Contract:
        status -> citation -> token -> action -> done
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

        # 1. Step: Status -> Gathering Context
        yield _format_sse("status", {"type": "status", "step": "Searching your knowledge base & notes..."})

        retrieval_start = time.time()
        context_data = self._build_deterministic_context(
            user_id=user_id,
            message=message,
            document_ids=document_ids,
            db=db
        )
        retrieval_ms = int((time.time() - retrieval_start) * 1000)
        sources = context_data["sources"]
        context_text = context_data["context_text"]

        # 2. Step: Emit Citations
        if sources:
            yield _format_sse("status", {"type": "status", "step": f"Verified {len(sources)} citations from documents."})
            for src in sources:
                yield _format_sse("citation", {"type": "citation", "citation": src})
        else:
            yield _format_sse("status", {"type": "status", "step": "Synthesizing answer from general knowledge..."})

        # 3. Build Pedagogy Prompt
        pedagogy_block = self._build_pedagogy_block(
            mode=mode,
            response_style=response_style,
            use_examples=use_examples,
            explain_terms=explain_terms,
            ask_followups=ask_followups,
            learning_goal=learning_goal,
            current_level=current_level
        )

        prompt_def = prompt_registry.get("rag", "v1.0")
        system_prompt = prompt_def.template.format(question=message, context=context_text)
        full_llm_prompt = f"{system_prompt}\n\n{pedagogy_block}\n\nUSER QUESTION: {message}\n\nProvide a direct, well-formatted markdown response."

        accumulated_tokens = []
        ttft_ms = 0
        stream_status = "completed"

        try:
            # 4. Stream LLM Tokens
            async for chunk in llm_client.stream_with_governance(
                prompt=full_llm_prompt,
                feature="chat",
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
                    # Capture metrics from AI gateway
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

        # 5. Build Final Response & Infer Action Handoff
        final_response = "".join(accumulated_tokens).strip()
        if not final_response and stream_status == "failed":
            final_response = "I encountered an error while processing your request. Please try again."

        total_latency_ms = int((time.time() - start_time) * 1000)

        # 6. Emit Action Handoff (if stream completed normally)
        if stream_status == "completed" and final_response:
            action_handoff = self._infer_study_action(
                message=message,
                response_text=final_response,
                sources=sources,
                document_ids=document_ids,
                mode=mode
            )
            yield _format_sse("action", {"type": "action", "handoff": action_handoff})

        # 7. Emit Done Event
        yield _format_sse("done", {
            "type": "done",
            "status": stream_status,
            "metrics": {
                "retrieval_ms": retrieval_ms,
                "ttft_ms": ttft_ms,
                "total_latency_ms": total_latency_ms,
                "sources_count": len(sources)
            }
        })

        # 8. Persist History to Database
        try:
            chat_entry = ChatHistory(
                user_id=user_id,
                message=message,
                response=final_response or "(stream aborted)",
                document_ids=document_ids,
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
        document_ids: List[int],
        language: str,
        db: Session,
        mode: str = "human",
        response_style: str = "balanced",
        use_examples: bool = True,
        explain_terms: bool = True,
        ask_followups: bool = True,
        learning_goal: Optional[str] = None,
        current_level: Optional[str] = None
    ) -> Dict[str, Any]:
        """Synchronous legacy wrapper for compatibility"""
        context_data = self._build_deterministic_context(
            user_id=user_id,
            message=message,
            document_ids=document_ids,
            db=db
        )
        sources = context_data["sources"]
        context_text = context_data["context_text"]

        pedagogy_block = self._build_pedagogy_block(
            mode=mode,
            response_style=response_style,
            use_examples=use_examples,
            explain_terms=explain_terms,
            ask_followups=ask_followups,
            learning_goal=learning_goal,
            current_level=current_level
        )

        prompt_def = prompt_registry.get("rag", "v1.0")
        system_prompt = prompt_def.template.format(question=message, context=context_text)
        full_llm_prompt = f"{system_prompt}\n\n{pedagogy_block}\n\nUSER QUESTION: {message}\n\nProvide a direct, well-formatted markdown response."

        start_time = time.time()
        ai_result = await llm_client.execute_with_governance(
            prompt=full_llm_prompt,
            feature="chat",
            prompt_version=prompt_def.version,
            user_id=user_id,
            db=db
        )
        total_latency_ms = int((time.time() - start_time) * 1000)

        final_response = ai_result.content
        action_handoff = self._infer_study_action(
            message=message,
            response_text=final_response,
            sources=sources,
            document_ids=document_ids,
            mode=mode
        )

        # Persist
        try:
            chat_entry = ChatHistory(
                user_id=user_id,
                message=message,
                response=final_response,
                document_ids=document_ids,
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
            "language": language
        }

