from sqlalchemy.orm import Session
from models.database import KnowledgeNode, KnowledgeEdge, Document
from utils.llm_client import llm_client
import json
import re
from typing import List, Dict, Any, Tuple

class GraphService:
    def __init__(self):
        pass

    async def extract_and_store_graph(self, document_id: int, text_content: str, user_id: int, db: Session):
        """Extract triplets from text and store in relational graph"""
        # Take a representative sample if text is too long for extraction
        sample_text = text_content[:15000] 
        
        prompt = f"""
        Extract the most important conceptual entities and their logical relationships from the following text.
        Focus on high-level architecture, causal links, and definitions.
        
        Format the output as a JSON list of triplets:
        [
          {{"source": "Entity A", "relation": "relationship type", "target": "Entity B"}},
          ...
        ]
        
        TEXT:
        {sample_text}
        """
        
        try:
            resp = await llm_client.generate_response(prompt)
            # Basic JSON extraction from LLM response
            triplets = self._extract_json(resp)
            
            for t in triplets:
                # 1. Get or Create Source Node
                source_node = self._get_or_create_node(t['source'], document_id, user_id, db)
                # 2. Get or Create Target Node
                target_node = self._get_or_create_node(t['target'], document_id, user_id, db)
                
                # 3. Create Edge
                edge = KnowledgeEdge(
                    document_id=document_id,
                    source_node_id=source_node.id,
                    target_node_id=target_node.id,
                    relation=t['relation']
                )
                db.add(edge)
            
            db.commit()
            return True
        except Exception as e:
            print(f"DEBUG: Graph extraction failed for doc {document_id}: {e}")
            return False

    def _get_or_create_node(self, label: str, document_id: int, user_id: int, db: Session):
        label = label.strip().title()
        node = db.query(KnowledgeNode).filter(
            KnowledgeNode.label == label,
            KnowledgeNode.user_id == user_id
        ).first()
        
        if not node:
            node = KnowledgeNode(
                label=label,
                document_id=document_id,
                user_id=user_id
            )
            db.add(node)
            db.flush() # Get ID before commit
        return node

    def get_related_concepts(self, query: str, user_id: int, db: Session, depth: int = 1) -> str:
        """Search the graph for concepts related to the query and return as context"""
        # 1. Simple keyword match for nodes in the query
        all_nodes = db.query(KnowledgeNode).filter(KnowledgeNode.user_id == user_id).all()
        found_nodes = []
        for node in all_nodes:
            if node.label.lower() in query.lower():
                found_nodes.append(node)
        
        if not found_nodes:
            return ""
        
        graph_context = "### CONCEPTUAL RELATIONSHIPS (Graph Context):\n"
        for node in found_nodes:
            # Find outgoing edges
            edges = db.query(KnowledgeEdge).filter(KnowledgeEdge.source_node_id == node.id).all()
            for edge in edges:
                target = db.query(KnowledgeNode).filter(KnowledgeNode.id == edge.target_node_id).first()
                if target:
                    graph_context += f"- {node.label} [{edge.relation}] -> {target.label}\n"
        
        return graph_context

    def _extract_json(self, text: str) -> List[Dict[str, Any]]:
        try:
            # 1. Standard Extraction
            text = text.strip()
            if "```json" in text: text = text.split("```json")[1].split("```")[0]
            elif "```" in text: text = text.split("```")[1].split("```")[0]
            
            # Use regex to find everything between the first [ and last ]
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return json.loads(text.strip())
        except Exception:
            # 2. Heuristic Extraction (Fallback)
            # Match { "source": "...", "relation": "...", "target": "..." }
            triplets = []
            pattern = r'\{\s*"source":\s*"(.*?)",\s*"relation":\s*"(.*?)",\s*"target":\s*"(.*?)"\s*\}'
            matches = re.findall(pattern, text)
            for m in matches:
                triplets.append({"source": m[0], "relation": m[1], "target": m[2]})
            return triplets
