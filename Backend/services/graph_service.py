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
        """Extract triplets using the Shiro Knowledge Architect prompt"""
        sample_text = text_content[:15000] 
        
        VALID_RELATIONS = ["is_a", "part_of", "causes", "depends_on", "example_of", "derived_from", "opposite_of", "process_of", "measured_by"]

        prompt = f"""
        You are the Shiro Knowledge Architect. Extract structured knowledge triplets for building a reasoning-ready Knowledge Graph.
        
        RULES:
        1. Extract triplets in the form [Concept A] -> [RELATION] -> [Concept B].
        2. Allowed relations (STRICT): {json.dumps(VALID_RELATIONS)}.
        3. Do not create new relations; choose the closest valid one or skip.
        4. Assign a confidence_score (0.0-1.0) based on how explicitly the relation appears.
        5. Entities should be concise (1-4 words).
        6. Focus on structural, causal, and conceptual knowledge.

        Output ONLY a JSON list of objects:
        [
          {{"source": "A", "relation": "is_a", "target": "B", "confidence": 0.95}},
          ...
        ]
        
        TEXT:
        {sample_text}
        """
        
        try:
            resp = await llm_client.generate_response(prompt)
            triplets = self._extract_json(resp)
            
            for t in triplets:
                # Schema Validation
                rel = str(t.get('relation', '')).lower().replace(' ', '_')
                if rel not in VALID_RELATIONS:
                    # Basic mapping attempt
                    if 'is a' in rel or 'type of' in rel: rel = 'is_a'
                    elif 'part' in rel: rel = 'part_of'
                    elif 'cause' in rel: rel = 'causes'
                    else: continue 

                # 1. Get or Create Source Node
                source_node = self._get_or_create_node(t['source'], document_id, user_id, db)
                # 2. Get or Create Target Node
                target_node = self._get_or_create_node(t['target'], document_id, user_id, db)
                
                # 3. Create Edge
                edge = KnowledgeEdge(
                    document_id=document_id,
                    source_node_id=source_node.id,
                    target_node_id=target_node.id,
                    relation=rel,
                    confidence_score=t.get('confidence', 1.0)
                )
                db.add(edge)
            
            db.commit()
            return True
        except Exception as e:
            print(f"DEBUG: Graph extraction failed for doc {document_id}: {e}")
            return False

    def _get_or_create_node(self, label: str, document_id: int, user_id: int, db: Session):
        label = label.strip().title()
        
        # 1. Exact Match Check
        node = db.query(KnowledgeNode).filter(
            KnowledgeNode.label == label,
            KnowledgeNode.user_id == user_id
        ).first()

        if node:
            if node.document_id != document_id:
                node.importance_score = min(1.0, (node.importance_score or 0.1) + 0.15)
            return node

        # 2. Semantic Normalization (Entity Merging)
        # Search for semantically similar nodes to prevent duplicates (e.g., "AI" vs "Artificial Intelligence")
        # We use a simple label-based search here; in a production system, we'd use node embeddings.
        existing_nodes = db.query(KnowledgeNode).filter(KnowledgeNode.user_id == user_id).all()
        for existing in existing_nodes:
            # Basic normalization: if one contains the other and they are long enough, or exact normalized match
            norm_existing = existing.label.lower()
            norm_new = label.lower()
            if norm_existing == norm_new or (len(norm_new) > 3 and norm_new in norm_existing) or (len(norm_existing) > 3 and norm_existing in norm_new):
                print(f"DEBUG: Normalizing entity '{label}' to existing '{existing.label}'")
                return existing

        # 3. Create New Node
        node = KnowledgeNode(
            label=label,
            document_id=document_id,
            user_id=user_id,
            importance_score=0.1
        )
        db.add(node)
        db.flush() 
        return node

    def get_related_concepts(self, query: str, user_id: int, db: Session, depth: int = 2, min_confidence: float = 0.6) -> str:
        """
        Confidence-Weighted Path Retrieval with Decay.
        Calculates the logical strength of reasoning chains.
        """
        all_nodes = db.query(KnowledgeNode).filter(KnowledgeNode.user_id == user_id).all()
        seed_nodes = [n for n in all_nodes if n.label.lower() in query.lower()]
        
        if not seed_nodes:
            return ""
        
        visited_nodes = {} # node_id -> best_path_confidence
        reasoning_chains = []
        
        # Queue: (node, current_depth, path_confidence)
        queue = [(node, 0, 1.0) for node in seed_nodes]
        
        while queue:
            current_node, current_depth, current_conf = queue.pop(0)
            
            if current_depth >= depth:
                continue
                
            # Find relationships
            edges = db.query(KnowledgeEdge).filter(
                (KnowledgeEdge.source_node_id == current_node.id) | 
                (KnowledgeEdge.target_node_id == current_node.id)
            ).all()
            
            for edge in edges:
                # Filter low-confidence edges
                edge_conf = getattr(edge, 'confidence_score', 1.0)
                if edge_conf < min_confidence:
                    continue

                is_source = edge.source_node_id == current_node.id
                other_id = edge.target_node_id if is_source else edge.source_node_id
                
                # Multi-hop Decay: Path confidence = current_conf * edge_conf * decay_factor
                decay_factor = 0.8 # Confidence drops as we move further from the seed
                new_conf = current_conf * edge_conf * decay_factor
                
                if other_id in visited_nodes and visited_nodes[other_id] >= new_conf:
                    continue # Already found a stronger path to this node
                
                other_node = db.query(KnowledgeNode).filter(KnowledgeNode.id == other_id).first()
                if other_node:
                    visited_nodes[other_id] = new_conf
                    rel_str = f"{current_node.label} --[{edge.relation} (conf: {new_conf:.2f})]--> {other_node.label}" if is_source \
                              else f"{other_node.label} --[{edge.relation} (conf: {new_conf:.2f})]--> {current_node.label}"
                    
                    reasoning_chains.append(rel_str)
                    queue.append((other_node, current_depth + 1, new_conf))
        
        if not reasoning_chains:
            return ""

        context = "### TRUTH-AWARE KNOWLEDGE GRAPH CONTEXT (Confidence-Weighted):\n"
        context += "\n".join(list(set(reasoning_chains))[:15]) # Limit to top 15 chains
        return context

    def _check_contradictions(self, source_id: int, target_id: int, relation: str, confidence: float, db: Session):
        """Detect and handle contradictions between triplets using confidence comparison."""
        existing_edge = db.query(KnowledgeEdge).filter(
            KnowledgeEdge.source_node_id == source_id,
            KnowledgeEdge.target_node_id == target_id
        ).first()

        if existing_edge:
            if existing_edge.relation != relation:
                # CONTRADICTION DETECTED
                existing_conf = getattr(existing_edge, 'confidence_score', 1.0)
                if confidence > existing_conf:
                    print(f"DEBUG: Contradiction found. Overwriting {existing_edge.relation} with {relation} (Higher confidence: {confidence} > {existing_conf})")
                    existing_edge.relation = relation
                    existing_edge.confidence_score = confidence
                else:
                    print(f"DEBUG: Contradiction found. Keeping {existing_edge.relation} (Lower confidence: {confidence} <= {existing_conf})")
                return True
        return False

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
