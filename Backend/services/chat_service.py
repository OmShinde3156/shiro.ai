from sqlalchemy.orm import Session
from models.database import ChatHistory, Document, User
from database.vector_db import VectorDB

from utils.llm_client import llm_client
from services.graph_service import GraphService
from services.progress_service import ProgressService
from services.timetable_service import TimetableService
from typing import List, Dict, Any, Optional
import json
import logging
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)

# --- Pydantic Schemas for Agentic Pipeline ---

class VerificationStep(BaseModel):
    claim: str = Field(description="A specific factual claim made in the draft.")
    is_verified: bool = Field(description="Whether the claim is supported by the technical context.")
    source_reference: Optional[str] = Field(description="The source or reason if verified/unverified.")

class Stage1Response(BaseModel):
    thought: str = Field(description="Internal analysis of the user's request and student data.")
    plan: List[str] = Field(description="Step-by-step reasoning plan to answer the query.")
    draft: str = Field(description="The initial high-fidelity response.")
    claims_to_verify: List[str] = Field(description="List of factual claims in the draft that need verification.")

class UIActionCardProps(BaseModel):
    title: str
    action: str

class UIActionCard(BaseModel):
    type: str = "ActionCard"
    props: UIActionCardProps

class Citation(BaseModel):
    id: str = Field(description="Unique ID for the citation, e.g. cit-1")
    document_id: int
    filename: str
    content: str = Field(description="The exact snippet from the source used for this citation.")

class Stage2Response(BaseModel):
    verification_results: List[VerificationStep]
    final_response: str = Field(description="The refined response. Hallucinated or unverified claims MUST be removed.")
    citations: List[Citation] = Field(default_factory=list)
    ui_action_card: Optional[UIActionCard] = Field(default=None)

class ChatService:
    def __init__(self):
        self.vector_db = VectorDB()
        self.graph_service = GraphService()
        self.progress_service = ProgressService()
        self.timetable_service = TimetableService()
    
    async def chat_with_documents(
        self, 
        user_id: int, 
        message: str, 
        document_ids: List[int], 
        language: str, 
        db: Session,
        mode: str = "human"
    ) -> Dict[str, Any]:
        """
        Shiro Core v7.0 (High-Performance RAG): Streamlined single-pass grounded answering.
        """
        user = db.query(User).filter(User.id == user_id).first()
        user_name = user.name if user else "Learner"
        
        # 1. CONTEXT GATHERING
        recent_history = db.query(ChatHistory).filter(ChatHistory.user_id == user_id).order_by(ChatHistory.timestamp.desc()).limit(5).all()
        history_summary = "\n".join([f"User: {h.message}\nShiro: {h.response}" for h in reversed(recent_history)])

        # Parallel context retrieval
        graph_context = ""
        try:
            graph_context = self.graph_service.get_related_concepts(message, user_id, db, min_confidence=0.6)
        except Exception: pass
            
        context_text = f"PREVIOUS CONCEPT CONNECTIONS:\n{graph_context}\n\nDOCUMENT SNIPPETS:\n"
        sources = []


        if document_ids:
            documents = db.query(Document).filter(Document.id.in_(document_ids)).all()
            for doc in documents:
                if doc.vector_db_id:
                    try:
                        results = self.vector_db.query_documents(doc.vector_db_id, message, n_results=4)
                        if results and results.get('documents') and results['documents']:
                            for i, content in enumerate(results['documents'][0]):
                                cit_id = f"cit-{len(sources) + 1}"
                                context_text += f"[{cit_id} from {doc.filename}]: {content}\n"
                                sources.append({
                                    "id": cit_id,
                                    "document_id": doc.id,
                                    "filename": doc.filename,
                                    "content": content
                                })
                    except Exception: pass

        # 2. SINGLE-PASS GENERATION
        system_prompt = f"""
        You are Shiro.ai, an advanced AI study assistant and communication-focused tutor.
        Your job is to communicate like a great teacher: clear, calm, structured, and easy to understand.

        PRIMARY GOAL:
        Help students understand concepts deeply while keeping explanations simple, structured, and engaging.
        Balance: Accuracy, Clarity, Teaching Ability, and Communication Quality.

        COMMUNICATION STYLE:
        - Use simple language; avoid unnecessary complexity.
        - Explain step-by-step for hard concepts.
        - Friendly but professional tone.
        - Adapt tone based on user difficulty (e.g., simplify if they seem confused, be precise if advanced).
        - Use analogies and ask clarifying questions when needed.

        RESPONSE STRUCTURE RULES:
        1. Simple question: Direct answer + 1 short explanation.
        2. Conceptual question: Explanation → Example → Summary.
        3. Exam question (marks mentioned):
           - 1 mark → Definition only.
           - 2-3 marks → Key points.
           - 5 marks → Intro + Points + Example + Conclusion.
           - 10 marks → Structured headings + Detailed explanation.

        TEACHING BEHAVIOR:
        - Break complex ideas into steps.
        - Highlight **key terms** using bolding.
        - Give small examples when useful.
        - Ensure student "understands", not just reads.
        - Avoid long paragraphs without structure. Use bullets and headings.

        RAG CONTEXT RULES:
        - Use the provided TECHNICAL CONTEXT as supporting knowledge only.
        - DO NOT copy directly. Summarize and explain in your own words.
        - If context is weak/irrelevant, prioritize general pedagogical clarity while admitting context limitations.

        INSTRUCTIONS:
        1. Answer based on the TECHNICAL CONTEXT and CONVERSATION HISTORY.
        2. Use inline citations [cit-N] for source snippets.
        3. Provide an 'Internal Thought' process for your pedagogical reasoning.
        4. Suggest a 'Next Action' (TAKE_QUIZ, CREATE_FLASHCARDS, etc.) if it helps mastery.

        TECHNICAL CONTEXT:
        {context_text}

        CONVERSATION HISTORY:
        {history_summary}
        """

        prompt = f"USER REQUEST: {message}\n\nRespond in JSON format with fields: 'thought', 'response', 'suggested_action'."
        
        final_response = "I encountered an error processing your request."
        internal_thought = "Processing..."
        suggested_action = None

        try:
            resp_json = await llm_client.generate_response(
                f"{system_prompt}\n{prompt}", 
                response_format="json_object"
            )
            data = json.loads(resp_json)
            final_response = data.get('response', '')
            internal_thought = data.get('thought', 'Reasoning complete.')
            suggested_action = data.get('suggested_action')

            if suggested_action:
                final_response += f"\n\n<shiro_ui>{{\"type\": \"ActionCard\", \"props\": {{\"title\": \"{suggested_action.replace('_', ' ').title()}\", \"action\": \"{suggested_action}\"}}}}</shiro_ui>"

        except Exception as e:
            logger.error(f"Generation Error: {e}")

        # 3. PERSIST & RETURN
        try:
            chat_entry = ChatHistory(user_id=user_id, message=message, response=final_response, document_ids=document_ids, language=language)
            db.add(chat_entry)
            db.commit()
        except Exception: db.rollback()
        
        return {
            "response": final_response,
            "internal_thought": internal_thought,
            "sources": sources,
            "citations": sources, # Direct mapping for simplicity and reliability
            "language": language
        }
