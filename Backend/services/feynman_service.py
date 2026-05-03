from sqlalchemy.orm import Session
from models.database import KnowledgeNode, KnowledgeEdge, Document
from utils.llm_client import llm_client
import json
import random
from typing import List, Dict, Any, Optional

class FeynmanService:
    def __init__(self):
        pass

    async def get_challenge_concept(self, user_id: int, document_ids: List[int], db: Session) -> Dict[str, Any]:
        """Select a concept from the knowledge graph for the user to explain"""
        query = db.query(KnowledgeNode).filter(KnowledgeNode.user_id == user_id)
        if document_ids:
            query = query.filter(KnowledgeNode.document_id.in_(document_ids))
        
        nodes = query.all()
        if not nodes:
            return {"error": "No concepts found in your library yet. Upload documents to generate a knowledge graph!"}
        
        # Pick a random node with some importance
        target_node = random.choice(nodes)
        
        # Find related concepts to help Shiro ask better questions
        edges = db.query(KnowledgeEdge).filter(
            (KnowledgeEdge.source_node_id == target_node.id) | 
            (KnowledgeEdge.target_node_id == target_node.id)
        ).all()
        
        return {
            "concept_id": target_node.id,
            "concept_name": target_node.label,
            "document_id": target_node.document_id,
            "related_count": len(edges)
        }

    async def evaluate_explanation(self, user_id: int, concept_name: str, explanation: str, db: Session) -> Dict[str, Any]:
        """Evaluate the user's explanation using LLM and Knowledge Graph context"""
        
        # 1. Fetch "True" context from Graph and Documents
        node = db.query(KnowledgeNode).filter(
            KnowledgeNode.label == concept_name,
            KnowledgeNode.user_id == user_id
        ).first()
        
        ground_truth = ""
        if node:
            ground_truth += f"Concept: {node.label}. Description: {node.description or 'N/A'}\n"
            # Get neighbors
            edges = db.query(KnowledgeEdge).filter(KnowledgeEdge.source_node_id == node.id).all()
            for edge in edges:
                target = db.query(KnowledgeNode).filter(KnowledgeNode.id == edge.target_node_id).first()
                if target:
                    ground_truth += f"- Relates to {target.label} via '{edge.relation}'\n"

        prompt = f"""
        You are Shiro, acting as a curious and slightly skeptical student. 
        The user is trying to explain the concept of '{concept_name}' to you using the Feynman Technique.
        
        GROUND TRUTH CONTEXT:
        {ground_truth}
        
        USER'S EXPLANATION:
        {explanation}
        
        Your task:
        1. Analyze for Jargon: Did they use complex words without explaining them?
        2. Analyze for Gaps: Did they miss key relationships or the core "why"?
        3. Accuracy Score: 0-100.
        4. Response: Give encouraging but critical feedback. Ask ONE follow-up question to test their depth.
        
        Return JSON:
        {{
          "score": 85,
          "feedback": "...",
          "jargon_found": ["word1", "word2"],
          "missing_links": ["link1"],
          "shiro_response": "..."
        }}
        """
        
        resp = await llm_client.generate_response(prompt)
        try:
            # Basic JSON extraction
            if "```json" in resp: resp = resp.split("```json")[1].split("```")[0]
            elif "```" in resp: resp = resp.split("```")[1].split("```")[0]
            return json.loads(resp.strip())
        except:
            return {
                "score": 50,
                "feedback": "I had trouble analyzing that. Can you try explaining it in a different way?",
                "shiro_response": resp
            }

feynman_service = FeynmanService()
