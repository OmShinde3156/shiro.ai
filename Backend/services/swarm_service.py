from sqlalchemy.orm import Session
from models.database import Document, LibraryInsight, KnowledgeNode
from utils.llm_client import llm_client
import json
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class SwarmService:
    async def run_library_analysis(self, user_id: int, db: Session):
        """Analyze all user documents for contradictions or synergies"""
        
        # 1. Get all documents for the user
        documents = db.query(Document).filter(Document.user_id == user_id).all()
        if len(documents) < 2:
            return # Need at least 2 docs to find cross-doc insights
        
        # 2. Extract summaries/key concepts for comparison to save tokens
        doc_summaries = []
        for doc in documents:
            content_sample = doc.text_content[:2000] if doc.text_content else ""
            doc_summaries.append({
                "id": doc.id,
                "filename": doc.filename,
                "content": content_sample
            })
            
        # 3. Prompt LLM to find synergies or contradictions
        prompt = f"""
        You are Shiro's Autonomous Swarm Intelligence. 
        Your task is to analyze the following document snippets from a student's library and identify:
        1. CONTRADICTIONS: Any conflicting information between documents.
        2. SYNERGIES: How a concept in one document explains or relates to a concept in another.
        3. SUGGESTIONS: A proactive study suggestion based on these links.

        DOCUMENTS:
        {json.dumps(doc_summaries, indent=2)}

        Respond ONLY with a JSON list of insights:
        [
          {{
            "type": "contradiction" | "synergy" | "suggestion",
            "title": "Short descriptive title",
            "content": "Detailed explanation of your discovery",
            "source_doc_ids": [id1, id2]
          }},
          ...
        ]
        """
        
        try:
            resp = await llm_client.generate_response(prompt, response_format="json_object")
            # The generate_response with json_object expects a single object usually, 
            # let's adapt or just parse manually if it returns a list wrapped in an object
            
            # Simple parsing for now (assuming LLM follows instructions)
            try:
                if isinstance(resp, str):
                    data = json.loads(resp)
                    # If LLM wrapped it in a key like "insights": [...]
                    insights = data.get("insights", data) if isinstance(data, dict) else data
                else:
                    insights = resp
            except:
                # Manual extraction fallback
                import re
                match = re.search(r'\[.*\]', resp, re.DOTALL)
                insights = json.loads(match.group(0)) if match else []

            if not isinstance(insights, list):
                insights = []

            # 4. Store new insights
            new_count = 0
            for ins in insights:
                # Check for duplicates (basic title check)
                exists = db.query(LibraryInsight).filter(
                    LibraryInsight.user_id == user_id,
                    LibraryInsight.title == ins['title']
                ).first()
                
                if not exists:
                    new_insight = LibraryInsight(
                        user_id=user_id,
                        type=ins['type'],
                        title=ins['title'],
                        content=ins['content'],
                        source_doc_ids=ins.get('source_doc_ids', [])
                    )
                    db.add(new_insight)
                    new_count += 1
            
            db.commit()
            logger.info(f"Swarm analysis complete for user {user_id}: {new_count} new insights found.")
            return new_count

        except Exception as e:
            logger.error(f"Swarm analysis failed: {e}")
            db.rollback()
            return 0

    def get_user_insights(self, user_id: int, db: Session, limit: int = 10):
        return db.query(LibraryInsight).filter(
            LibraryInsight.user_id == user_id
        ).order_by(LibraryInsight.created_at.desc()).limit(limit).all()

    def mark_insight_read(self, insight_id: int, db: Session):
        insight = db.query(LibraryInsight).filter(LibraryInsight.id == insight_id).first()
        if insight:
            insight.is_read = True
            db.commit()
            return True
        return False
