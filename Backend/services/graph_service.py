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
        
        # Shiro v4.5: Semantic Alias Mapping
        aliases = {
            "Ai": "Artificial Intelligence",
            "Artificial Intelligence": "Artificial Intelligence",
            "Ml": "Machine Learning",
            "Machine Learning": "Machine Learning",
            "Nlp": "Natural Language Processing",
            "Cv": "Computer Vision"
        }
        canonical_label = aliases.get(label, label)

        node = db.query(KnowledgeNode).filter(
            KnowledgeNode.label == canonical_label,
            KnowledgeNode.user_id == user_id
        ).first()
        
        if not node:
            node = KnowledgeNode(
                label=canonical_label,
                document_id=document_id,
                user_id=user_id,
                importance_score=0.1
            )
            db.add(node)
            db.flush() 
        else:
            # Multi-document reinforcement: Node grows as it appears in more files
            if node.document_id != document_id:
                node.importance_score = min(1.0, (node.importance_score or 0.1) + 0.15)
                
        return node

    def get_related_concepts(self, query: str, user_id: int, db: Session, depth: int = 2) -> str:
        """Search the graph for concepts related to the query and return as multi-hop context"""
        all_nodes = db.query(KnowledgeNode).filter(KnowledgeNode.user_id == user_id).all()
        
        # 1. Identity seed nodes in the query
        seed_nodes = [n for n in all_nodes if n.label.lower() in query.lower()]
        if not seed_nodes:
            return ""
        
        visited_ids = set()
        graph_context = "### MULTI-HOP KNOWLEDGE GRAPH CONTEXT:\n"
        
        # 2. Multi-hop traversal (Recursive/Iterative)
        queue = [(node, 0) for node in seed_nodes]
        while queue:
            current_node, current_depth = queue.pop(0)
            if current_node.id in visited_ids or current_depth >= depth:
                continue
                
            visited_ids.add(current_node.id)
            
            # Find relationships
            edges = db.query(KnowledgeEdge).filter(
                (KnowledgeEdge.source_node_id == current_node.id) | 
                (KnowledgeEdge.target_node_id == current_node.id)
            ).all()
            
            for edge in edges:
                is_source = edge.source_node_id == current_node.id
                other_id = edge.target_node_id if is_source else edge.source_node_id
                other_node = db.query(KnowledgeNode).filter(KnowledgeNode.id == other_id).first()
                
                if other_node:
                    rel_str = f"- {current_node.label} [{edge.relation}] -> {other_node.label}" if is_source \
                              else f"- {other_node.label} [{edge.relation}] -> {current_node.label}"
                    
                    if rel_str not in graph_context:
                        graph_context += rel_str + "\n"
                        queue.append((other_node, current_depth + 1))
        
        return graph_context

    def get_global_graph(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Retrieve the entire cross-document knowledge graph for a user."""
        nodes = db.query(KnowledgeNode).filter(KnowledgeNode.user_id == user_id).all()
        edges = db.query(KnowledgeEdge).join(KnowledgeNode, KnowledgeEdge.source_node_id == KnowledgeNode.id)\
                                     .filter(KnowledgeNode.user_id == user_id).all()

        nodes_data = []
        for node in nodes:
            # Optionally count how many edges this node has to determine its importance/size
            edge_count = sum(1 for e in edges if e.source_node_id == node.id or e.target_node_id == node.id)
            nodes_data.append({
                "id": str(node.id),
                "label": node.label,
                "document_id": node.document_id,
                "importance_score": node.importance_score,
                "size": max(10, 5 + (edge_count * 2)) # Dynamic size based on connections
            })

        edges_data = []
        for edge in edges:
            edges_data.append({
                "id": str(edge.id),
                "source": str(edge.source_node_id),
                "target": str(edge.target_node_id),
                "relation": edge.relation,
                "document_id": edge.document_id
            })

        return {
            "nodes": nodes_data,
            "edges": edges_data
        }

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
