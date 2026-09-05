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
import os
try:
    import fitz
except ImportError:
    fitz = None
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

    def _classify_intent(
        self,
        message: str,
        context_scope: str = "GLOBAL",
        document_ids: List[int] = [],
        active_document_id: Optional[int] = None,
        selected_text: Optional[str] = None,
        db: Optional[Session] = None,
        user_id: Optional[int] = None,
        is_ambiguous_doc: bool = False
    ) -> str:
        """
        Decoupled 10-Class Intent Classifier with fast deterministic paths:
        - "CASUAL": Greetings, small talk, pleasantries (hi, hello, thanks, bye)
        - "SIMPLE_FACTUAL": Direct factual queries (what is, define, meaning of)
        - "EXPLANATION": Conceptual learning (explain, how does, why does)
        - "DEEP_EXPLANATION": In-depth architectural/mechanic breakdowns
        - "DOCUMENT_QUESTION": Grounded question on a resolved document
        - "FIGURE_QUESTION": Analysis of diagrams, charts, visual flows
        - "TASK_ACTION": Direct item generation (give 5 questions, make flashcards)
        - "STUDY_COACHING": Active tutoring, step-by-step guidance, Socratic mode
        - "EXAM_PREPARATION": High-yield topics, exam questions, scoring criteria
        - "AMBIGUOUS": Ambiguous reference that needs single clarification
        - Specialized: "library_meta", "study_progress", "doc_profiling", "text_selection", "room_copilot"
        """
        msg_clean = message.lower().strip()

        # 1. Ambiguity flag passed from reference resolver
        if is_ambiguous_doc:
            return "AMBIGUOUS"

        # 2. Text Selection fast-path
        if selected_text and len(selected_text.strip()) > 3:
            return "text_selection"

        # 3. Casual Greeting, Pleasantries & Fatigue Fast-Path
        # e.g. "hi", "hello", "hey", "thanks", "thank you", "ok", "cool", "bye", "I'm tired"
        casual_pattern = r"^(hi|hello|hey|greetings|howdy|sup|thanks|thank\s+you|thx|ok|okay|cool|k|bye|goodbye|good\s+morning|good\s+afternoon|good\s+evening|i'?m\s+(tired|exhausted|sleepy|drained)|need\s+a\s+break)[\.!\s]*$"
        if re.match(casual_pattern, msg_clean) or (len(msg_clean.split()) <= 2 and any(w == msg_clean.split()[0] for w in ["hi", "hello", "hey", "thanks", "ok", "cool", "bye"])):
            return "CASUAL"

        # 4. Hypothetical Simulation & Task Action Fast-Path
        # e.g. "pretend I took 10 quizzes", "give me 5 questions", "make flashcards", "summarize in 3 bullet points"
        hypothetical_patterns = [
            r"\b(pretend|hypothetical(ly)?|simulate|what\s+if\s+i\s+(took|scored))\b"
        ]
        task_action_patterns = [
            r"\b(give\s+me|generate|create|make)\s+(\d+)?\s*([a-zA-Z0-9_\-]+\s+)*(questions|mcqs|problems|practice\s+questions)\b",
            r"\b(make|generate|create)\s+flashcards?\b",
            r"\b(summarize|summary)\s+in\s+(\d+)\s+(bullets?|points?)\b",
            r"\bgive\s+me\s+(\d+)\s+(points|takeaways|notes)\b"
        ]
        if any(re.search(p, msg_clean) for p in hypothetical_patterns) or any(re.search(p, msg_clean) for p in task_action_patterns):
            return "TASK_ACTION"

        # 5. Figure & Diagram Fast-Path
        figure_patterns = [
            r"\bexplain\s+(the\s+)?(diagrams?|figures?|charts?|flowcharts?|visuals?)\b",
            r"\bdiagrams?\s+in\s+(my|the)?\b",
            r"\bwhat\s+does\s+(the\s+)?(figure|fig\.?|diagram)\s*\d+\b",
            r"\b(figure|fig\.?|diagram)\s*\d+\b",
            r"\bexplain\s+the\s+diagram\b",
            r"\bdiagram\s+on\s+slide\b"
        ]
        if any(re.search(p, msg_clean) for p in figure_patterns):
            return "FIGURE_QUESTION"

        # 6. Study Coaching & Exam Preparation Fast-Path
        # e.g. "prepare for GATE", "study 3 hours on weekdays", "teach me normalization like a tutor"
        exam_patterns = [
            r"\bimportant\s+questions?\s+(for\s+exam|from|in)\b",
            r"\bhigh[- ]yield\b",
            r"\bexam\s+questions?\b",
            r"\bexam\s+patterns?\b",
            r"\bpyq\b",
            r"\bprevious\s+year\s+questions?\b",
            r"\bscoring\s+criteria\b",
            r"\bgate(\s+exam)?\b"
        ]
        coaching_patterns = [
            r"\bteach\s+me\b",
            r"\btutor\s+me\b",
            r"\bguide\s+me\s+through\b",
            r"\bfeynman\s+challenge\b",
            r"\bsocratic\b",
            r"\bhelp\s+me\s+learn\b",
            r"\bpractice\s+with\s+me\b",
            r"\b(i\s+can\s+study|study\s+\d+\s+hours|hours\s+on\s+(weekdays|weekends))\b",
            r"\bweak\s+in\s+.*\s+strong\s+in\b",
            r"\bmy\s+syllabus\b"
        ]
        if any(re.search(p, msg_clean) for p in coaching_patterns):
            return "STUDY_COACHING"
        if any(re.search(p, msg_clean) for p in exam_patterns):
            return "EXAM_PREPARATION"

        # 7. Deep Explanation Fast-Path
        deep_patterns = [
            r"\bdeep\s+dive\b",
            r"\bin[- ]depth\b",
            r"\bcomprehensive\s+analysis\b",
            r"\bdetailed\s+breakdown\b",
            r"\bmathematical\s+derivation\b"
        ]
        if any(re.search(p, msg_clean) for p in deep_patterns):
            return "DEEP_EXPLANATION"

        # 8. Library Metadata queries
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
        if any(re.search(p, msg_clean) for p in meta_patterns):
            return "library_meta"

        # 9. Study Progress queries
        progress_patterns = [
            r"\btoday'?s\s+mission\b",
            r"\bwhat should i study\b",
            r"\bwhat to study today\b",
            r"\bhow am i doing\b",
            r"\bmy progress\b",
            r"\bmy streak\b",
            r"\bmy\s+weakness(es)?\b",
            r"\bweak topics?\b",
            r"\bmy\s+(average\s+)?(quiz\s+)?score\b",
            r"\bmy\s+(current\s+)?mastery\b",
            r"\bwhat did i learn\b",
            r"\brecommend(ation)?s?\b"
        ]
        if any(re.search(p, msg_clean) for p in progress_patterns):
            return "study_progress"

        # 10. Document Profiling queries
        profiling_patterns = [
            r"\bhow (much )?time\b",
            r"\bhow long\b",
            r"\btime (to |will it )?take\b",
            r"\bstudy time\b",
            r"\bwhat is this (doc(ument)?|file|pdf) about\b",
            r"\bsummarize this (doc(ument)?|file|pdf)\b"
        ]
        if (context_scope == "DOCUMENT" or active_document_id) and any(re.search(p, msg_clean) for p in profiling_patterns):
            return "doc_profiling"

        # 11. Explicit Document Question Check
        doc_patterns = [
            r"\b(in|from|according to|based on)\s+(this|the|my)\s+(doc(ument)?|pdf|paper|file|notes)\b",
            r"\bin\s+page\s+\d+\b",
            r"\bpage\s+\d+\b",
            r"\bfigure\s+\d+\b"
        ]
        has_explicit_doc_ref = any(re.search(p, msg_clean) for p in doc_patterns)
        if has_explicit_doc_ref or (selected_text and len(selected_text.strip()) > 3):
            return "DOCUMENT_QUESTION"

        if context_scope == "LIBRARY" or any(w in msg_clean for w in ["in my notes", "from my documents", "in my pdfs", "in my library"]):
            return "cross_doc_rag"

        # 12. Simple Factual vs Conceptual Explanation
        factual_patterns = [
            r"^(what\s+is|who\s+is|define|definition\s+of|meaning\s+of|what\s+are\s+the|which\s+is|where\s+is|when\s+was|capital\s+of)\b",
            r"\bwhat\s+(is|are)\s+(a\s+)?(dbms|primary\s+key|foreign\s+key|normalization|indexing|deadlock|quantum\s+entanglement)\b"
        ]
        if any(re.search(p, msg_clean) for p in factual_patterns) and not any(w in msg_clean for w in ["explain", "how", "why", "deep", "compare"]):
            return "SIMPLE_FACTUAL"

        if any(w in msg_clean for w in ["explain simply", "simple", "intuitively", "analogy", "why does", "how does", "explain", "teach me", "now explain", "tell me about", "indexing"]):
            return "EXPLANATION"

        # Scope-dependent fallback
        if context_scope == "ROOM":
            return "room_copilot"

        # Default fallback
        if len(msg_clean.split()) <= 6 and msg_clean.startswith(("what", "who", "when", "where")):
            return "SIMPLE_FACTUAL"

        return "EXPLANATION"

    def _detect_intent(
        self,
        message: str,
        context_scope: str = "GLOBAL",
        document_ids: List[int] = [],
        active_document_id: Optional[int] = None,
        selected_text: Optional[str] = None
    ) -> str:
        """Backward-compatible wrapper mapping into decoupled intent classifier"""
        classified = self._classify_intent(
            message=message,
            context_scope=context_scope,
            document_ids=document_ids,
            active_document_id=active_document_id,
            selected_text=selected_text
        )
        if classified == "DOCUMENT_QUESTION":
            return "doc_rag"
        if classified in ["SIMPLE_FACTUAL", "EXPLANATION", "CASUAL", "STUDY_COACHING"]:
            return "general_tutor"
        return classified

    def _resolve_document_references(
        self,
        message: str,
        user_id: int,
        document_ids: List[int] = [],
        active_document_id: Optional[int] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Decoupled Document & Reference Resolver.
        Resolution chain:
        1. Active Document ID
        2. Query explicit attachments
        3. Mentioned filename/subject keywords in query
        4. Context history (document discussed in recent turns)
        5. Single library document fallback
        6. Ambiguity detection (if multiple candidate matches exist)
        """
        msg_lower = message.lower()

        # 0. Explicit Negation Check (e.g., "Ignore the document. What is quantum entanglement?")
        negation_patterns = [
            r"\b(ignore|without|forget|don't\s+use|dont\s+use)\s+(the\s+)?(doc|document|pdf|paper|notes)\b",
            r"\bgeneral\s+(knowledge|question|qa)\b",
            r"\bno\s+(doc|document|pdf)\b"
        ]
        if any(re.search(p, msg_lower) for p in negation_patterns):
            return {
                "resolved_document_ids": [],
                "is_ambiguous": False,
                "primary_doc": None,
                "candidates": []
            }

        if db:
            user_docs = db.query(Document).filter(Document.user_id == user_id).order_by(Document.upload_date.desc()).all()
        else:
            user_docs = []

        # 1. Active Document
        if active_document_id and user_docs:
            active_doc = next((d for d in user_docs if d.id == active_document_id), None)
            if active_doc:
                return {
                    "resolved_document_ids": [active_doc.id],
                    "is_ambiguous": False,
                    "primary_doc": active_doc,
                    "candidates": [active_doc]
                }

        # 2. Explicit attachments passed in query
        if document_ids and user_docs:
            matched_docs = [d for d in user_docs if d.id in document_ids]
            if len(matched_docs) >= 1:
                return {
                    "resolved_document_ids": [d.id for d in matched_docs],
                    "is_ambiguous": False,
                    "primary_doc": matched_docs[0],
                    "candidates": matched_docs
                }

        # 3. Match filename or subject keywords mentioned in query
        # e.g., "final year research paper", "final year paper", "deep learning.pdf"
        keyword_matches = []
        for d in user_docs:
            fn_clean = re.sub(r'[\._\-]', ' ', d.filename.lower())
            subj_clean = (d.subject or "").lower()
            words = [w for w in fn_clean.split() if len(w) > 3 and w not in ["file", "document", "assignment", "draft", "paper", "final"]]
            if any(w in msg_lower for w in words):
                keyword_matches.append(d)
            elif "final year" in msg_lower and any(k in fn_clean for k in ["final", "year", "paper", "research", "project"]):
                keyword_matches.append(d)
            elif subj_clean and subj_clean in msg_lower:
                keyword_matches.append(d)

        if keyword_matches:
            return {
                "resolved_document_ids": [keyword_matches[0].id],
                "is_ambiguous": False,
                "primary_doc": keyword_matches[0],
                "candidates": keyword_matches
            }

        # 4. Check conversation history ONLY if query explicitly contains a document follow-up pronoun
        followup_markers = ["this doc", "that doc", "the doc", "the paper", "this paper", "the pdf", "this pdf", "it say", "page ", "figure ", "diagram"]
        if any(m in msg_lower for m in followup_markers) and db:
            recent_turns = (
                db.query(ChatHistory)
                .filter(ChatHistory.user_id == user_id)
                .order_by(ChatHistory.timestamp.desc())
                .limit(5)
                .all()
            )
            for turn in recent_turns:
                turn_doc_ids = getattr(turn, "document_ids", None)
                if turn_doc_ids and isinstance(turn_doc_ids, list) and len(turn_doc_ids) > 0:
                    hist_doc = next((d for d in user_docs if d.id in turn_doc_ids), None)
                    if hist_doc:
                        return {
                            "resolved_document_ids": [hist_doc.id],
                            "is_ambiguous": False,
                            "primary_doc": hist_doc,
                            "candidates": [hist_doc]
                        }

        # 5. Ambiguity detection: only when user explicitly asks to inspect an unspecified document
        doc_action_patterns = [
            r"\b(explain|summarize|read|analyze|open|review|check)\s+(this|the|that)\s+(doc(ument)?|paper|pdf|file)\b",
            r"\bwhat\s+does\s+(this|the|that)\s+(doc(ument)?|paper|pdf|file)\s+say\b"
        ]
        if any(re.search(p, msg_lower) for p in doc_action_patterns) and len(user_docs) > 1:
            return {
                "resolved_document_ids": [],
                "is_ambiguous": True,
                "primary_doc": None,
                "candidates": user_docs[:4]
            }

        return {
            "resolved_document_ids": [],
            "is_ambiguous": False,
            "primary_doc": None,
            "candidates": user_docs
        }

    def _extract_document_figures(
        self,
        document_ids: List[int],
        query: str,
        user_id: int,
        db: Optional[Session] = None
    ) -> List[Dict[str, Any]]:
        """
        Extracts structured visual figure/diagram metadata from resolved documents.
        Supports:
        - PyMuPDF text & page structure
        - Figure/Diagram/Chart candidate regexes
        - Page tracking via '--- Page N ---' markers
        - Caption and surrounding context extraction
        """
        figures = []
        if not db or not document_ids:
            return figures

        docs = db.query(Document).filter(Document.id.in_(document_ids), Document.user_id == user_id).all()
        query_lower = query.lower()

        # Check if a specific figure number was requested (e.g. "Figure 3" or "Figure 4")
        fig_num_match = re.search(r'\b(?:figure|fig\.?|diagram)\s*(\d+)\b', query_lower)
        target_fig_num = int(fig_num_match.group(1)) if fig_num_match else None

        for doc in docs:
            text = doc.text_content or ""
            pages = text.split("--- Page ")
            current_page = 1

            for p_idx, page_chunk in enumerate(pages):
                if p_idx > 0:
                    page_header_match = re.match(r'^(\d+)\s*---', page_chunk)
                    if page_header_match:
                        current_page = int(page_header_match.group(1))
                    else:
                        current_page = p_idx

                # Find candidate figure blocks: "Figure X: Caption" or "Figure X - Title"
                fig_matches = re.finditer(
                    r'(?:Figure|Fig\.?|Diagram|Chart)\s*(\d+)[:\.\-\s]+([^\n\.\;]{4,120})',
                    page_chunk,
                    re.IGNORECASE
                )
                for m in fig_matches:
                    f_num = int(m.group(1))
                    caption = m.group(2).strip()
                    start_pos = max(0, m.start() - 100)
                    end_pos = min(len(page_chunk), m.end() + 250)
                    surrounding = page_chunk[start_pos:end_pos].replace("\n", " ").strip()

                    fig_entry = {
                        "figure_id": f"fig-{doc.id}-{f_num}",
                        "figure_number": f_num,
                        "caption": caption,
                        "page": current_page,
                        "surrounding_context": surrounding,
                        "document_id": doc.id,
                        "document_filename": doc.filename,
                        "visual_description": f"Diagram {f_num} illustrating {caption}"
                    }

                    if target_fig_num is None or f_num == target_fig_num:
                        figures.append(fig_entry)

            # Fallback if no numbered figures were found, but diagrams/architecture were asked
            if not figures and any(w in query_lower for w in ["diagram", "figure", "chart", "architecture", "flowchart"]):
                arch_matches = re.finditer(r'(?:Architecture|System Overview|Workflow|Dataflow|Pipeline|Flowchart)[:\.\-\s]+([^\n]{10,140})', text, re.IGNORECASE)
                for idx, m in enumerate(arch_matches, 1):
                    figures.append({
                        "figure_id": f"fig-{doc.id}-{idx}",
                        "figure_number": idx,
                        "caption": m.group(0).strip(),
                        "page": 1,
                        "surrounding_context": text[max(0, m.start()-50):min(len(text), m.end()+200)].replace("\n", " ").strip(),
                        "document_id": doc.id,
                        "document_filename": doc.filename,
                        "visual_description": f"Architectural diagram depicting {m.group(1).strip()}"
                    })
                    if len(figures) >= 4:
                        break

        return figures

    def _build_modular_prompt(
        self,
        intent: str,
        message: str,
        context_text: str,
        pedagogy_block: str,
        language: str = "en"
    ) -> str:
        """
        Constructs decoupled, intent-specific prompt without monolithic tutor pollution.
        """
        system_rules = (
            "You are Shiro, a grounded, precise, and human-centered academic AI system.\n\n"
            "CORE PRINCIPLES:\n"
            "1. Deliver direct, accurate, and proportional answers matching the user's intent.\n"
            "2. Never fabricate user progress, weak topics, quiz history, or deadlines.\n"
            "3. Output clean GitHub-flavored Markdown. Do NOT output conversational filler like 'Thinking...', 'Still working...', 'One moment...'.\n"
            f"4. Answer in {language}."
        )

        intent_directive = ""
        if intent == "CASUAL":
            intent_directive = (
                "USER INTENT: CASUAL GREETING.\n"
                "Respond naturally, warmly, and briefly in 1 to 2 sentences. "
                "Do NOT provide a study framework, long lesson, or diagnostic quiz."
            )
        elif intent == "SIMPLE_FACTUAL":
            intent_directive = (
                "USER INTENT: SIMPLE FACTUAL ANSWER.\n"
                "Provide a direct, accurate answer using established academic and general knowledge in 1 to 2 concise paragraphs. "
                "Do NOT demand a document or claim you cannot answer without a document. "
                "Do NOT add unrequested pedagogical essays or long preambles."
            )
        elif intent == "EXPLANATION":
            intent_directive = (
                "USER INTENT: CONCEPTUAL EXPLANATION.\n"
                "Explain clearly with appropriate depth, structured headings, and intuitive real-world examples using general academic knowledge. "
                "Do NOT demand a document or claim you cannot answer without a document."
            )
        elif intent == "DEEP_EXPLANATION":
            intent_directive = (
                "USER INTENT: DEEP TECHNICAL EXPLANATION.\n"
                "Provide a comprehensive, structured technical breakdown covering core mechanics, definitions, and trade-offs using general academic knowledge. "
                "Do NOT demand a document or claim you cannot answer without a document."
            )
        elif intent in ["DOCUMENT_QUESTION", "doc_rag", "cross_doc_rag"]:
            intent_directive = (
                "USER INTENT: DOCUMENT-GROUNDED QUESTION.\n"
                "Answer strictly using the verified context excerpts below. Cite source tags like [cit-1] with page numbers.\n"
                "GROUNDING DIRECTIVE: If the requested information is not found in the verified excerpts, state: \"I couldn't verify that from this document.\""
            )
        elif intent == "FIGURE_QUESTION":
            intent_directive = (
                "USER INTENT: FIGURE / DIAGRAM ANALYSIS.\n"
                "Ground your explanation strictly in the actual figures. Structure each figure as:\n"
                "### Figure X — [Caption / Title] (Page Y)\n"
                "**What it shows**:\n...\n"
                "**How the components interact**:\n...\n"
                "**Why it matters**:\n..."
            )
        elif intent == "TASK_ACTION":
            intent_directive = (
                "USER INTENT: DIRECT TASK EXECUTION.\n"
                "Execute the requested action directly without conversational preamble. If the user presents hypothetical data (e.g. 'pretend I scored...'), analyze their hypothetical numbers accurately and clearly state that it is an illustrative simulation."
            )
        elif intent == "STUDY_COACHING":
            intent_directive = (
                "USER INTENT: STUDY COACHING.\n"
                "Provide supportive, structured study guidance. If the student shares their study hours, schedule, or strengths/weaknesses, actively acknowledge those details and continue building their study plan. Do NOT reset or demand they upload a document."
            )
        elif intent == "EXAM_PREPARATION":
            intent_directive = (
                "USER INTENT: EXAM PREPARATION.\n"
                "Provide high-yield exam points, scoring criteria, and examiner insights. If the student provides details about their exam (e.g. GATE), hours, or strengths/weaknesses, actively acknowledge and incorporate them into a concrete plan. Do NOT demand a document."
            )

        context_block = f"\n\nCONTEXT & EVIDENCE:\n{context_text}" if context_text else ""
        pedagogy = f"\n\nPEDAGOGY SETTINGS:\n{pedagogy_block}" if pedagogy_block and intent in ["EXPLANATION", "DEEP_EXPLANATION", "STUDY_COACHING", "EXAM_PREPARATION"] else ""

        return f"{system_rules}\n\n{intent_directive}{context_block}{pedagogy}\n\nUSER MESSAGE: {message}"

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
            pedagogy_instructions.append("PEDAGOGICAL MODE: ACADEMIC TUTOR. Guide the student clearly with intuitive analogies.")

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
        if ask_followups and mode_clean in ["feynman", "socratic"]:
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
        context_scope: str = "GLOBAL",
        intent: str = "EXPLANATION"
    ) -> Optional[Dict[str, Any]]:
        """Infers structured action handoff only when contextually appropriate"""
        # Never emit action cards for casual greetings, ambiguity, or very short non-study text
        if intent in ["CASUAL", "AMBIGUOUS", "library_meta"] or len(response_text.strip()) < 80:
            return None

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
            if intent in ["SIMPLE_FACTUAL", "EXPLANATION", "DEEP_EXPLANATION", "DOCUMENT_QUESTION", "STUDY_COACHING", "EXAM_PREPARATION"]:
                if mode == "surgical":
                    tool = "quiz"
                    title = f"Verify Knowledge: {topic}"
                else:
                    tool = "flashcards"
                    title = f"Review Flashcards: {topic}"
            else:
                return None

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
        Decoupled stages:
        1. Reference Resolution
        2. Intent Classification
        3. Fast-Path Handling (Casual, Ambiguous, Progress)
        4. Multimodal Context & Figure Extraction
        5. Modular Prompt Assembly
        6. Token Streaming with Typed SSE & Monotonic Event IDs
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

        # 1. Resolve Document References
        ref_resolution = self._resolve_document_references(
            message=message,
            user_id=user_id,
            document_ids=document_ids,
            active_document_id=active_document_id,
            db=db
        )
        resolved_doc_ids = ref_resolution["resolved_document_ids"] or document_ids
        is_ambiguous = ref_resolution["is_ambiguous"]

        # 2. Classify Intent
        intent = self._classify_intent(
            message=message,
            context_scope=context_scope,
            document_ids=resolved_doc_ids,
            active_document_id=active_document_id,
            selected_text=selected_text,
            db=db,
            user_id=user_id,
            is_ambiguous_doc=is_ambiguous
        )

        # -------------------------------------------------------------
        # FAST-PATH A: Casual Greeting & Pleasantries (Zero Tutoring)
        # -------------------------------------------------------------
        if intent == "CASUAL":
            yield _format_sse("status", {"type": "status", "step": "Generating answer"})
            msg_clean = message.lower().strip()
            if any(w in msg_clean for w in ["thanks", "thank you", "thx"]):
                casual_reply = "You're welcome! Let me know if you need any help with your study materials."
            elif any(w in msg_clean for w in ["ok", "okay", "cool", "got it"]):
                casual_reply = "Sounds good! What topic or document should we tackle next?"
            elif any(w in msg_clean for w in ["bye", "goodbye"]):
                casual_reply = "Goodbye! Good luck with your study session today. 👋"
            elif any(w in msg_clean for w in ["tired", "exhausted", "sleepy", "drained", "break"]):
                casual_reply = "Sounds like you might need a break! Feel free to take a breather, or we can keep things light. Let me know whenever you're ready to pick back up. 🌱"
            else:
                casual_reply = "Hi! 👋 What are you working on today?"

            words = casual_reply.split(" ")
            for idx, w in enumerate(words):
                delta = w + (" " if idx < len(words) - 1 else "")
                yield _format_sse("token", {"type": "token", "delta": delta})
                await asyncio.sleep(0.01)

            total_latency_ms = int((time.time() - start_time) * 1000)
            yield _format_sse("done", {
                "type": "done",
                "status": "completed",
                "metrics": {
                    "retrieval_ms": 0,
                    "ttft_ms": int((time.time() - start_time) * 1000),
                    "total_latency_ms": total_latency_ms,
                    "sources_count": 0,
                    "context_scope": context_scope,
                    "intent": "CASUAL",
                    "debug": {
                        "intent": "CASUAL",
                        "document_context": False,
                        "document_required": False,
                        "pedagogy": False,
                        "study_coaching": False,
                        "conversation_state": "casual",
                        "refusal_policy": "general_knowledge"
                    }
                }
            })

            if db:
                try:
                    chat_entry = ChatHistory(
                        user_id=user_id,
                        message=message,
                        response=casual_reply,
                        document_ids=[],
                        language=language,
                        status="completed",
                        latency_ms=total_latency_ms
                    )
                    db.add(chat_entry)
                    db.commit()
                except Exception:
                    db.rollback()
            return

        # -------------------------------------------------------------
        # FAST-PATH B: Ambiguous Document Clarification (One Question)
        # -------------------------------------------------------------
        if intent == "AMBIGUOUS":
            yield _format_sse("status", {"type": "status", "step": "Clarifying reference"})
            candidates = ref_resolution.get("candidates", [])
            cand_names = [f"**{c.filename}**" for c in candidates]
            if cand_names:
                clarification = f"Which document are you referring to? In your library, you have: {', '.join(cand_names)}. Please let me know which one you'd like to explore!"
            else:
                clarification = "Which document are you referring to? Could you mention the title or select it from your library?"

            words = clarification.split(" ")
            for idx, w in enumerate(words):
                delta = w + (" " if idx < len(words) - 1 else "")
                yield _format_sse("token", {"type": "token", "delta": delta})
                await asyncio.sleep(0.01)

            total_latency_ms = int((time.time() - start_time) * 1000)
            yield _format_sse("done", {
                "type": "done",
                "status": "completed",
                "metrics": {
                    "retrieval_ms": 0,
                    "ttft_ms": int((time.time() - start_time) * 1000),
                    "total_latency_ms": total_latency_ms,
                    "sources_count": 0,
                    "context_scope": context_scope,
                    "intent": "AMBIGUOUS"
                }
            })

            if db:
                try:
                    chat_entry = ChatHistory(
                        user_id=user_id,
                        message=message,
                        response=clarification,
                        document_ids=[],
                        language=language,
                        status="completed",
                        latency_ms=total_latency_ms
                    )
                    db.add(chat_entry)
                    db.commit()
                except Exception:
                    db.rollback()
            return

        # -------------------------------------------------------------
        # FAST-PATH C: Study Progress & Truth-Grounding (No Hallucination)
        # -------------------------------------------------------------
        if intent == "study_progress":
            yield _format_sse("status", {"type": "status", "step": "Reviewing your study progress & streak..."})
            recent_results = db.query(QuizResult).filter(QuizResult.user_id == user_id).all() if db else []
            user_obj = db.query(User).filter(User.id == user_id).first() if db else None
            streak = getattr(user_obj, "streak", 0) or 0
            xp = getattr(user_obj, "xp", 0) or 0

            if len(recent_results) == 0 and xp == 0:
                progress_reply = (
                    "You don't have any recorded study progress or quiz history yet. "
                    "Once you complete a quiz or review flashcards, your mastery data will appear here. "
                    "What topic would you like to start with today?"
                )
                words = progress_reply.split(" ")
                for idx, w in enumerate(words):
                    delta = w + (" " if idx < len(words) - 1 else "")
                    yield _format_sse("token", {"type": "token", "delta": delta})
                    await asyncio.sleep(0.01)

                total_latency_ms = int((time.time() - start_time) * 1000)
                yield _format_sse("done", {
                    "type": "done",
                    "status": "completed",
                    "metrics": {
                        "retrieval_ms": 0,
                        "ttft_ms": int((time.time() - start_time) * 1000),
                        "total_latency_ms": total_latency_ms,
                        "sources_count": 0,
                        "context_scope": context_scope,
                        "intent": "study_progress"
                    }
                })
                return

        # -------------------------------------------------------------
        # 3. Status Transitions (Meaningful, Never Conversational Filler)
        # -------------------------------------------------------------
        if intent == "FIGURE_QUESTION":
            yield _format_sse("status", {"type": "status", "step": "Searching sources"})
            yield _format_sse("status", {"type": "status", "step": "Analyzing figure"})
        elif intent in ["DOCUMENT_QUESTION", "doc_rag", "cross_doc_rag"]:
            yield _format_sse("status", {"type": "status", "step": "Searching sources"})
            yield _format_sse("status", {"type": "status", "step": "Reading document"})
        elif intent == "library_meta":
            yield _format_sse("status", {"type": "status", "step": "Scanning your library inventory..."})
        elif intent == "TASK_ACTION":
            yield _format_sse("status", {"type": "status", "step": "Executing study task..."})
        else:
            yield _format_sse("status", {"type": "status", "step": "Generating answer"})

        # -------------------------------------------------------------
        # 4. Context & Source Assembly
        # -------------------------------------------------------------
        retrieval_start = time.time()
        sources = []
        context_text = ""

        if intent == "FIGURE_QUESTION":
            extracted_figures = self._extract_document_figures(
                document_ids=resolved_doc_ids,
                query=message,
                user_id=user_id,
                db=db
            )
            if extracted_figures:
                fig_text_parts = []
                for idx, f in enumerate(extracted_figures, 1):
                    cit_id = f"cit-{idx}"
                    sources.append({
                        "id": cit_id,
                        "document_id": f["document_id"],
                        "filename": f["document_filename"],
                        "page_number": f["page"],
                        "content": f["surrounding_context"]
                    })
                    fig_text_parts.append(
                        f"[{cit_id} Figure {f['figure_number']} from {f['document_filename']}, Page {f['page']}]:\n"
                        f"Caption: {f['caption']}\n"
                        f"Visual: {f['visual_description']}\n"
                        f"Context: {f['surrounding_context']}\n"
                    )
                context_text = "\n".join(fig_text_parts)
            else:
                context_text = "NO_FIGURES_FOUND"
        else:
            context_data = self._build_dynamic_context(
                user_id=user_id,
                message=message,
                context_scope=context_scope,
                document_ids=resolved_doc_ids,
                active_document_id=active_document_id,
                room_id=room_id,
                selected_text=selected_text,
                intent=intent,
                db=db
            )
            sources = context_data["sources"]
            context_text = context_data["context_text"]

        retrieval_ms = int((time.time() - retrieval_start) * 1000)

        # -------------------------------------------------------------
        # 5. Emit Citations (if any retrieved)
        # -------------------------------------------------------------
        if sources:
            for src in sources:
                yield _format_sse("citation", {"type": "citation", "citation": src})

        # -------------------------------------------------------------
        # 6. Prompt Assembly & Execution
        # -------------------------------------------------------------
        pedagogy_block = self._build_pedagogy_block(
            mode=mode,
            response_style=response_style,
            use_examples=use_examples,
            explain_terms=explain_terms,
            ask_followups=ask_followups,
            learning_goal=learning_goal,
            current_level=current_level
        )

        full_llm_prompt = self._build_modular_prompt(
            intent=intent,
            message=message,
            context_text=context_text,
            pedagogy_block=pedagogy_block,
            language=language
        )

        feature_tag = "rag_document" if intent in ["DOCUMENT_QUESTION", "doc_rag"] else ("figure_analysis" if intent == "FIGURE_QUESTION" else ("task_execution" if intent == "TASK_ACTION" else "tutor"))

        accumulated_tokens = []
        ttft_ms = 0
        stream_status = "completed"

        try:
            async for chunk in llm_client.stream_with_governance(
                prompt=full_llm_prompt,
                feature=feature_tag,
                prompt_version="v1.0",
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
            stream_status = "stopped"
        except Exception as ex:
            logger.error(f"Streaming error occurred: {ex}")
            stream_status = "failed"
            yield _format_sse("error", {"type": "error", "code": "STREAM_ERROR", "message": str(ex)})

        # -------------------------------------------------------------
        # 7. Action Handoff (Contextual Only!)
        # -------------------------------------------------------------
        final_response = "".join(accumulated_tokens).strip()
        total_latency_ms = int((time.time() - start_time) * 1000)

        if stream_status == "completed" and final_response:
            action_handoff = self._infer_study_action(
                message=message,
                response_text=final_response,
                sources=sources,
                document_ids=resolved_doc_ids,
                mode=mode,
                context_scope=context_scope,
                intent=intent
            )
            if action_handoff:
                yield _format_sse("action", {"type": "action", "handoff": action_handoff})

        # -------------------------------------------------------------
        # 8. Emit Done Event with Transparent Routing Debug Metadata
        # -------------------------------------------------------------
        # Determine refusal policy & conversation state
        if intent in ["DOCUMENT_QUESTION", "doc_rag", "cross_doc_rag"]:
            refusal_policy = "document_refusal" if sources else "document_missing"
        elif intent in ["study_progress", "zero_history"]:
            refusal_policy = "zero_fabrication"
        else:
            refusal_policy = "general_knowledge"

        if intent in ["STUDY_COACHING", "EXAM_PREPARATION"]:
            conversation_state = "exam_coaching" if "gate" in message.lower() or intent == "EXAM_PREPARATION" else "study_coaching"
        elif mode in ["feynman", "socratic"]:
            conversation_state = mode
        else:
            conversation_state = "normal"

        debug_metadata = {
            "intent": intent,
            "document_context": bool(sources),
            "document_required": intent in ["DOCUMENT_QUESTION", "doc_rag", "cross_doc_rag"],
            "pedagogy": bool(mode in ["feynman", "socratic", "surgical", "exam"]),
            "study_coaching": intent in ["STUDY_COACHING", "EXAM_PREPARATION"],
            "conversation_state": conversation_state,
            "refusal_policy": refusal_policy
        }
        logger.info(
            f"\n--- CHAT ROUTING DEBUG ---\n"
            f"INTENT: {debug_metadata['intent']}\n"
            f"DOCUMENT_CONTEXT: {debug_metadata['document_context']}\n"
            f"DOCUMENT_REQUIRED: {debug_metadata['document_required']}\n"
            f"PEDAGOGY: {debug_metadata['pedagogy']}\n"
            f"STUDY_COACHING: {debug_metadata['study_coaching']}\n"
            f"CONVERSATION_STATE: {debug_metadata['conversation_state']}\n"
            f"REFUSAL_POLICY: {debug_metadata['refusal_policy']}\n"
            f"--------------------------"
        )

        yield _format_sse("done", {
            "type": "done",
            "status": stream_status,
            "metrics": {
                "retrieval_ms": retrieval_ms,
                "ttft_ms": ttft_ms,
                "total_latency_ms": total_latency_ms,
                "sources_count": len(sources),
                "context_scope": context_scope,
                "intent": intent,
                "debug": debug_metadata
            }
        })

        # -------------------------------------------------------------
        # 9. Persist History
        # -------------------------------------------------------------
        if db:
            try:
                chat_entry = ChatHistory(
                    user_id=user_id,
                    message=message,
                    response=final_response or "(stream aborted)",
                    document_ids=resolved_doc_ids,
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
        ref_resolution = self._resolve_document_references(
            message=message,
            user_id=user_id,
            document_ids=document_ids,
            active_document_id=active_document_id,
            db=db
        )
        resolved_doc_ids = ref_resolution["resolved_document_ids"] or document_ids

        intent = self._classify_intent(
            message=message,
            context_scope=context_scope,
            document_ids=resolved_doc_ids,
            active_document_id=active_document_id,
            selected_text=selected_text,
            db=db,
            user_id=user_id,
            is_ambiguous_doc=ref_resolution["is_ambiguous"]
        )

        context_data = self._build_dynamic_context(
            user_id=user_id,
            message=message,
            context_scope=context_scope,
            document_ids=resolved_doc_ids,
            active_document_id=active_document_id,
            room_id=room_id,
            selected_text=selected_text,
            intent=intent,
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

        full_llm_prompt = self._build_modular_prompt(
            intent=intent,
            message=message,
            context_text=context_text,
            pedagogy_block=pedagogy_block,
            language=language
        )

        feature_tag = "rag_document" if intent in ["DOCUMENT_QUESTION", "doc_rag"] else "tutor"

        start_time = time.time()
        ai_result = await llm_client.execute_with_governance(
            prompt=full_llm_prompt,
            feature=feature_tag,
            prompt_version="v1.0",
            user_id=user_id,
            db=db
        )
        total_latency_ms = int((time.time() - start_time) * 1000)
        final_response = ai_result.content

        action_handoff = self._infer_study_action(
            message=message,
            response_text=final_response,
            sources=sources,
            document_ids=resolved_doc_ids,
            mode=mode,
            context_scope=context_scope,
            intent=intent
        )

        if db:
            try:
                chat_entry = ChatHistory(
                    user_id=user_id,
                    message=message,
                    response=final_response,
                    document_ids=resolved_doc_ids,
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
            "suggested_action": action_handoff.get("tool") if action_handoff else None,
            "action_handoff": action_handoff,
            "language": language,
            "context_scope": context_scope
        }


