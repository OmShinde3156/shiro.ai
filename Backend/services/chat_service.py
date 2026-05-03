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

class Stage2Response(BaseModel):
    final_response: str = Field(description="The refined, final response to the user.")
    ui_action_card: Optional[UIActionCard] = Field(default=None, description="Provide an ActionCard ONLY if the user seems stuck or needs a specific next action. Null otherwise.")

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
        Optimized Shiro Core v4.0: Structured Agentic Pipeline
        """
        user = db.query(User).filter(User.id == user_id).first()
        user_name = user.name if user else "Learner"
        
        # 1. PARALLEL CONTEXT GATHERING
        recent_history = db.query(ChatHistory).filter(ChatHistory.user_id == user_id).order_by(ChatHistory.timestamp.desc()).limit(5).all()
        history_summary = "\n".join([f"User: {h.message}\nShiro: {h.response}" for h in reversed(recent_history)])

        # Gather Progress & Timetable Context
        try:
            progress_data = await self.progress_service.get_user_progress(user_id, db)
            timetable_data = self.timetable_service.get_user_timetable(user_id, db)
        except Exception as e:
            logger.warning(f"Failed to fetch master-brain context: {e}")
            progress_data = {}
            timetable_data = {}
        
        agent_master_context = f"""
        ### USER KNOWLEDGE STATE:
        - Weak Subjects: {', '.join(progress_data.get('weak_subjects', [])) or 'None identified'}
        - Strong Subjects: {', '.join(progress_data.get('strong_subjects', [])) or 'None identified'}
        - Average Score: {progress_data.get('average_score', 0)}%
        - Study Streak: {progress_data.get('study_streak', 0)} days
        
        ### CURRENT STUDY PLAN:
        - Exam Date: {timetable_data.get('exam_date', 'Not set')}
        - Days Remaining: {timetable_data.get('days_remaining', 'N/A')}
        - Today's Tasks: {json.dumps(timetable_data.get('today_schedule', []))}
        """

        graph_context = ""
        try:
            graph_context = self.graph_service.get_related_concepts(message, user_id, db)
        except Exception as e:
            logger.warning(f"Graph service failed: {e}")
            
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
                                sources.append({"document_id": doc.id, "filename": doc.filename, "snippet": content[:200]})
                    except Exception as e:
                        logger.warning(f"Vector DB query failed for doc {doc.id}: {e}")

        # 2. STAGE 1: JOINT PLAN & DRAFT (Structured JSON)
        mode_instruction = ""
        if mode == "human":
            mode_instruction = f"BEHAVIOR: You are a warm, empathetic human companion. Use {user_name}'s name, show interest, and be conversational. Use the KNOWLEDGE STATE to nudge {user_name} if they are struggling or congratulate their streak."
        else:
            mode_instruction = f"BEHAVIOR: You are a RIGID SURGICAL TUTOR. No pleasantries. Focus on TECHNICAL CONTEXT. Use the KNOWLEDGE STATE to provide high-density facts specifically targeting {user_name}'s weak areas."

        plan_gen_prompt = f"""As Shiro, analyze and respond to {user_name} in {mode.upper()} mode.
        {mode_instruction}
        
        STUDENT DATA: {agent_master_context}
        USER REQUEST: {message}
        HISTORY: {history_summary}
        TECHNICAL CONTEXT: {context_docs}
        
        Respond EXACTLY with a JSON object.
        Schema:
        {{
            "thought": "string (1-sentence internal analysis)",
            "intent": "string (GENERAL or RESEARCH)",
            "draft": "string (High-fidelity response in {language})"
        }}
        """
        
        stage1_draft = ""
        internal_thought = "Analyzing request..."
        intent = "RESEARCH"
        
        try:
            stage1_resp = await llm_client.generate_response(plan_gen_prompt, response_format="json_object")
            stage1_data = Stage1Response.model_validate_json(stage1_resp)
            stage1_draft = stage1_data.draft
            internal_thought = stage1_data.thought
            intent = stage1_data.intent
        except Exception as e:
            logger.error(f"Stage 1 Pipeline Failed: {e}")
            stage1_draft = "I encountered an internal error analyzing your request. Let me try answering directly: " + message

        # 3. STAGE 2: JOINT CRITIQUE, REFINE & UI (Structured JSON)
        refine_ui_prompt = f"""Review and finalize this response for Shiro.ai.
        MODE: {mode.upper()}
        DRAFT: {stage1_draft}
        SOURCE CONTEXT: {context_docs if "RESEARCH" in intent.upper() else "N/A"}
        STUDENT DATA: {agent_master_context}
        
        Task: 
        1. If mode is SURGICAL, strip all 'human' filler. Ensure cold, precise technicality.
        2. If mode is HUMAN, ensure natural, friendly, and supportive tone.
        3. MANDATORY: Based on STUDENT DATA, provide a UI ActionCard ONLY if the user seems stuck or needs a specific next action. Otherwise, return null for the action card.
        
        Respond EXACTLY with a JSON object.
        Schema:
        {{
            "final_response": "string (Refined Response)",
            "ui_action_card": {{
                "type": "ActionCard",
                "props": {{
                    "title": "string",
                    "action": "string"
                }}
            }} // Or null if not needed
        }}
        """
        
        final_response = stage1_draft
        ui_json_str = ""
        
        try:
            stage2_resp = await llm_client.generate_response(refine_ui_prompt, response_format="json_object")
            stage2_data = Stage2Response.model_validate_json(stage2_resp)
            final_response = stage2_data.final_response
            
            if stage2_data.ui_action_card:
                ui_json_str = f"\n\n<shiro_ui>{stage2_data.ui_action_card.model_dump_json()}</shiro_ui>"
                final_response += ui_json_str
        except Exception as e:
            logger.error(f"Stage 2 Pipeline Failed: {e}")

        # 4. ASYNC PERSISTENCE
        try:
            chat_entry = ChatHistory(user_id=user_id, message=message, response=final_response, document_ids=document_ids, language=language)
            db.add(chat_entry)
            db.commit()
        except Exception as e:
            logger.error(f"Database commit failed in ChatService: {e}")
            db.rollback()
        
        return {
            "response": final_response,
            "internal_thought": internal_thought,
            "sources": sources,
            "language": language
        }
