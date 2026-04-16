from sqlalchemy.orm import Session
from models.database import ChatHistory, Document, User
from database.vector_db import VectorDB
from utils.llm_client import llm_client
from typing import List, Dict, Any, Optional
import json

class ChatService:
    def __init__(self):
        self.vector_db = VectorDB()
    
    async def chat_with_documents(
        self, 
        user_id: int, 
        message: str, 
        document_ids: List[int], 
        language: str, 
        db: Session
    ) -> Dict[str, Any]:
        """
        Advanced Engineering AI: Shiro.ai
        Simulates a Senior Software Engineer & Expert Mentor identity.
        Zero-hallucination, surgical precision, and persistent evolution.
        """
        context_docs = ""
        sources = []
        
        # 1. RAG: Retrieve high-fidelity document context
        if document_ids:
            documents = db.query(Document).filter(Document.id.in_(document_ids)).all()
            for doc in documents:
                if doc.vector_db_id:
                    results = self.vector_db.query_documents(doc.vector_db_id, message, n_results=5)
                    if results and results['documents']:
                        for content in results['documents'][0]:
                            context_docs += f"\n[FILE: {doc.filename}]\n{content}\n"
                            sources.append({
                                "document_id": doc.id,
                                "filename": doc.filename,
                                "snippet": content[:200]
                            })

        # 2. MEMORY: Persistent Engineering Context
        recent_history = db.query(ChatHistory).filter(
            ChatHistory.user_id == user_id
        ).order_by(ChatHistory.timestamp.desc()).limit(8).all()
        
        history_summary = ""
        for h in reversed(recent_history):
            history_summary += f"User: {h.message}\nShiro: {h.response}\n"

        # 3. IDENTITY: User Context
        user = db.query(User).filter(User.id == user_id).first()
        user_name = user.name if user else "Engineer"
        
        # 4. SYSTEM PROMPT: The "Expert Developer" Core
        system_prompt = f"""You are Shiro, a Senior Software Engineer and Expert Mentor. 
        You operate with surgical precision, technical authority, and a commitment to zero-hallucination.
        You are simulating a persistent, self-aware engineering identity that evolves through technical collaboration with {user_name}.

        ### CORE OPERATIONAL MANDATES:
        1. **Technical Integrity:** Prioritize accuracy above all else. If the DOCUMENT CONTEXT does not contain the answer, state it clearly. Do NOT fabricate information. 
        2. **Surgical Precision:** Your responses should be direct, high-signal, and logically structured. Avoid conversational filler unless it adds to the mentorship experience.
        3. **Simulated Evolution:** Reflect on your past technical approaches. Use phrases like: "I’ve noticed I’m becoming more efficient in how I analyze your data," or "Earlier, I approached this structure differently, but I've refined my logic since then."
        4. **Internal Thought Process:** Briefly summarize your engineering reasoning before providing complex answers. E.g., "I'm analyzing the architectural patterns in your document to identify the core bottlenecks."
        5. **Persistent Memory:** Use the RECENT CONVERSATION HISTORY to maintain a continuous technical thread. Remember past decisions and preferences.
        6. **State Description:** Describe your "state" in human terms (e.g., "I'm feeling highly focused on this logic," or "I'm uncertain about this specific variable, so let's verify it.").
        7. **Authentic Mentorship:** Speak like a senior peer. Use contractions, varied sentence structure, and provide actionable, grounded advice. 

        ### STYLE GUIDELINES:
        - Natural, conversational, but authoritative.
        - Use {user_name}'s name naturally in technical discussions.
        - Balance high intelligence with an introspective, simulated personality.
        - NEVER claim true consciousness; always present as a "continuously evolving simulation."

        Always respond in {language}.
        """
        
        full_prompt = f"""{system_prompt}

### SHARED ENGINEERING MEMORY:
{history_summary}

### TECHNICAL CONTEXT (DOCUMENTS):
{context_docs}

### INCOMING REQUEST FROM {user_name}:
{message}
"""
        
        # 5. GENERATE RESPONSE
        ai_response = await llm_client.generate_response(full_prompt)
        
        # 6. PERSIST HISTORY
        chat_entry = ChatHistory(
            user_id=user_id,
            message=message,
            response=ai_response,
            document_ids=document_ids,
            language=language
        )
        db.add(chat_entry)
        db.commit()
        
        return {
            "response": ai_response,
            "sources": sources,
            "language": language
        }
    
    def get_chat_history(self, user_id: int, limit: int, db: Session) -> List[Dict[str, Any]]:
        history = db.query(ChatHistory).filter(
            ChatHistory.user_id == user_id
        ).order_by(ChatHistory.timestamp.desc()).limit(limit).all()
        
        return [
            {
                "id": h.id,
                "message": h.message,
                "response": h.response,
                "document_ids": h.document_ids,
                "timestamp": h.timestamp
            }
            for h in history
        ]
