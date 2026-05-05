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

class Stage1Response(BaseModel):
    thought: str = Field(description="Internal analysis of the user's request and student data.")
    intent: str = Field(description="Either 'GENERAL' or 'RESEARCH'")
    draft: str = Field(description="The initial high-fidelity response in the requested language.")

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
    final_response: str = Field(description="The refined response. Use [cit-N] notation inline to cite sources.")
    citations: List[Citation] = Field(default_factory=list, description="List of source snippets linked to the inline citations.")
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
        Shiro Core v4.0 (InsightsLM Merge): Enhanced RAG with Citations
        """
        user = db.query(User).filter(User.id == user_id).first()
        user_name = user.name if user else "Learner"
        
        # 1. PARALLEL CONTEXT GATHERING
        recent_history = db.query(ChatHistory).filter(ChatHistory.user_id == user_id).order_by(ChatHistory.timestamp.desc()).limit(5).all()
        history_summary = "\n".join([f"User: {h.message}\nShiro: {h.response}" for h in reversed(recent_history)])

        try:
            progress_data = await self.progress_service.get_user_progress(user_id, db)
            timetable_data = self.timetable_service.get_user_timetable(user_id, db)
        except Exception:
            progress_data = {}
            timetable_data = {}
        
        agent_master_context = f"""
        ### USER KNOWLEDGE STATE:
        - Weak Subjects: {', '.join(progress_data.get('weak_subjects', []))}
        - Study Streak: {progress_data.get('study_streak', 0)} days
        ### CURRENT STUDY PLAN:
        - Today's Tasks: {json.dumps(timetable_data.get('today_schedule', []))}
        """

        graph_context = ""
        try:
            graph_context = self.graph_service.get_related_concepts(message, user_id, db)
        except Exception: pass
            
        context_docs = graph_context + "\n"
        sources = []
        
        if document_ids:
            documents = db.query(Document).filter(Document.id.in_(document_ids)).all()
            for doc in documents:
                if doc.vector_db_id:
                    try:
                        results = self.vector_db.query_documents(doc.vector_db_id, message, n_results=5)
                        if results and results.get('documents') and results['documents']:
                            for content in results['documents'][0]:
                                context_docs += f"[SOURCE: {doc.filename}] {content}\n"
                                sources.append({"document_id": doc.id, "filename": doc.filename, "snippet": content})
                    except Exception: pass

        # 2. STAGE 1: PLAN & DRAFT
        mode_instruction = f"BEHAVIOR: {'WARM HUMAN' if mode=='human' else 'RIGID SURGICAL'}. Use context appropriately."

        plan_gen_prompt = f"""As Shiro, respond to {user_name}.
        {mode_instruction}
        STUDENT DATA: {agent_master_context}
        USER REQUEST: {message}
        TECHNICAL CONTEXT: {context_docs}
        Respond EXACTLY with JSON: {{ "thought": "...", "intent": "...", "draft": "..." }}
        """
        
        stage1_draft = ""
        internal_thought = "Analyzing..."
        
        try:
            stage1_resp = await llm_client.generate_response(plan_gen_prompt, response_format="json_object")
            stage1_data = Stage1Response.model_validate_json(stage1_resp)
            stage1_draft = stage1_data.draft
            internal_thought = stage1_data.thought
        except Exception:
            stage1_draft = "I encountered an error. How can I help?"

        # 3. STAGE 2: REFINE & CITE (InsightsLM logic)
        source_mapping = [{"id": f"cit-{i+1}", "document_id": s['document_id'], "filename": s['filename'], "content": s['snippet'][:500]} for i, s in enumerate(sources)]

        refine_ui_prompt = f"""Review this response.
        MODE: {mode.upper()}
        DRAFT: {stage1_draft}
        SOURCE MAPPING: {json.dumps(source_mapping)}
        STUDENT DATA: {agent_master_context}
        
        Task: 
        1. Refine the tone.
        2. MANDATORY: Cite sources from MAPPING using [cit-N] inline.
        3. Match every [cit-N] to the 'citations' field.
        
        Respond EXACTLY with JSON:
        {{ "final_response": "...", "citations": [...], "ui_action_card": null }}
        """
        
        final_response = stage1_draft
        found_citations = []
        
        try:
            stage2_resp = await llm_client.generate_response(refine_ui_prompt, response_format="json_object")
            stage2_data = Stage2Response.model_validate_json(stage2_resp)
            final_response = stage2_data.final_response
            found_citations = [c.model_dump() for c in stage2_data.citations]
            
            if stage2_data.ui_action_card:
                final_response += f"\n\n<shiro_ui>{stage2_data.ui_action_card.model_dump_json()}</shiro_ui>"
        except Exception: pass

        # 4. PERSIST
        try:
            chat_entry = ChatHistory(user_id=user_id, message=message, response=final_response, document_ids=document_ids, language=language)
            db.add(chat_entry)
            db.commit()
        except Exception: db.rollback()
        
        return {
            "response": final_response,
            "internal_thought": internal_thought,
            "sources": sources,
            "citations": found_citations,
            "language": language
        }
