# Debug version of mindmap_service.py
from sqlalchemy.orm import Session
from models.database import Document, MindMap
from utils.llm_client import LLMClient
from typing import Dict, Any, List, Tuple, Set, Optional
from collections import defaultdict, Counter
from dataclasses import dataclass
import uuid
import math
import json
import re
import numpy as np

from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
import networkx as nx
import community as community_louvain


@dataclass
class Node:
    id: str
    label: str
    level: int
    score: float
    x: float = 0.0
    y: float = 0.0


@dataclass
class Edge:
    source: str
    target: str
    weight: float


class MindMapService:
    def __init__(self):
        self.llm_client = LLMClient()

    async def generate_mindmap(self, document_id: int, topic: str, depth: int, db: Session):
        """Generate a hierarchical mind map with controllable depth."""
        print(f" DEBUG: Starting mindmap generation for document {document_id}")
        
        # 1) Load document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise Exception("Document not found")

        raw_text = (document.text_content or "").strip()
        if not raw_text:
            raise Exception("Document is empty")

        if not topic:
            topic = f"Summary of {document.filename or 'Document'}"

        print(f" Document loaded: {len(raw_text)} characters")

        # 2) Preprocess + chunk
        chunks = self._chunk_text(self._clean_text(raw_text), target_chunk_size=1500, overlap=150)
        print(f" Created {len(chunks)} chunks")

        # 3) Extract salient terms (TF-IDF)
        top_terms = self._score_terms(chunks, top_k=80)
        all_salient_terms = set([t for t, _ in top_terms])
        
        # Build co-occurrence graph for base scoring
        G = self._build_cooccurrence_graph(chunks, terms=all_salient_terms)
        pr = nx.pagerank(G, weight="weight") if len(G) > 1 else {}
        term_score = self._calculate_normalized_scores_debug(top_terms, pr, [])

        # 4) Use LLM to extract hierarchical topics
        hierarchy = await self._extract_hierarchical_topics_with_llm(raw_text)
        
        if not hierarchy or "children" not in hierarchy:
            print("  LLM hierarchy failed, falling back to root-only")
            mindmap_data = {
                "nodes": [{"id": "root", "label": topic, "level": 0, "score": 1.0}],
                "edges": [],
            }
            return self._persist_and_return(document, topic, mindmap_data, db)

        # 5) Build nodes and edges recursively
        max_depth = max(1, int(depth or 3))
        nodes = []
        edges = []
        
        root_label = hierarchy.get("topic", topic)
        root = Node(id="root", label=root_label, level=0, score=1.0, x=0.0, y=0.0)
        nodes.append(root)

        def get_phrase_score(phrase: str) -> float:
            # Simple heuristic: average score of salient words in the phrase
            words = re.findall(r"\b[a-zA-Z][a-zA-Z0-9\-]+\b", phrase.lower())
            scores = [term_score.get(w, 0.2) for w in words if w in term_score]
            if not scores:
                return 0.5
            return sum(scores) / len(scores)

        def build_tree(parent_id: str, children: List[Dict], current_level: int, center_x: float, center_y: float, base_angle: float, radius_step: float = 200.0):
            if current_level > max_depth or not children:
                return
                
            count = len(children)
            for i, child in enumerate(children):
                child_topic = child.get("topic", "Unknown")
                node_id = f"{parent_id}_{i}"
                
                if current_level == 1:
                    # Level 1: 5 arms of the starfish
                    angle = (2 * math.pi * i / max(1, count)) - (math.pi / 2)
                    radius = radius_step * 1.5
                    x = center_x + radius * math.cos(angle)
                    y = center_y + radius * math.sin(angle)
                    node_angle = angle
                else:
                    # Higher levels: Fan out from the base_angle extending outward
                    spread = math.pi / (1.5 * current_level) 
                    start_angle = base_angle - (spread / 2)
                    step_angle = spread / max(1, count - 1) if count > 1 else 0
                    
                    angle = start_angle + (i * step_angle) if count > 1 else base_angle
                    radius = radius_step * 0.8
                    x = center_x + radius * math.cos(angle)
                    y = center_y + radius * math.sin(angle)
                    node_angle = angle
                
                raw_score = get_phrase_score(child_topic)
                # Boost score slightly for higher levels
                level_boost = max(0, (3 - current_level) * 0.1)
                final_score = max(0.3, min(0.9, raw_score + level_boost))
                
                n = Node(id=node_id, label=child_topic, level=current_level, score=final_score, x=x, y=y)
                nodes.append(n)
                edges.append(Edge(source=parent_id, target=node_id, weight=1.0))
                
                subchildren = child.get("children", [])
                if subchildren:
                    # Continue extending outward along the node_angle
                    build_tree(node_id, subchildren, current_level + 1, x, y, node_angle, radius_step * 0.85)

        build_tree("root", hierarchy.get("children", []), 1, 0.0, 0.0, 0.0, 220.0)

        print(f" Created {len(nodes)} nodes total")

        # Build mind map data
        mindmap_data = {
            "nodes": [self._node_to_dict(n) for n in nodes],
            "edges": [e.__dict__ for e in edges],
        }

        return self._persist_and_return(document, topic, mindmap_data, db)

    def _node_to_dict(self, node: Node) -> Dict[str, Any]:
        """Convert Node to dict ensuring score is a proper float"""
        return {
            "id": node.id,
            "label": node.label,
            "level": node.level,
            "score": float(node.score),
            "x": float(node.x),
            "y": float(node.y)
        }

    def _calculate_normalized_scores_debug(self, top_terms: List[Tuple[str, float]], 
                                         pagerank: Dict[str, float], 
                                         main_topics: List[str]) -> Dict[str, float]:
        """Calculate and normalize scores with detailed debugging."""
        term_score = {}
        for term, score in top_terms:
            term_score[term] = float(score)
        
        if pagerank:
            max_pr = max(pagerank.values())
            for term in term_score:
                old_score = term_score[term]
                pr_score = pagerank.get(term, 0.0) / max_pr if max_pr > 0 else 0.0
                term_score[term] = 0.7 * old_score + 0.3 * pr_score
                
        for topic in main_topics:
            old_score = term_score.get(topic, 0.5)
            term_score[topic] = min(1.0, old_score + 0.2)
            
        return term_score

    # Simplified helper methods for debugging
    def _clean_text(self, text: str) -> str:
        return re.sub(r"\s+", " ", text)

    def _chunk_text(self, text: str, target_chunk_size=1500, overlap=150) -> List[str]:
        sents = re.split(r"(?<=[.!?])\s+", text)
        chunks, cur, cur_len = [], [], 0
        for s in sents:
            if cur_len + len(s) > target_chunk_size and cur:
                chunks.append(" ".join(cur))
                tail = cur[-1][-overlap:] if cur else ""
                cur, cur_len = ([tail] if tail else []), len(tail)
            cur.append(s)
            cur_len += len(s)
        if cur:
            chunks.append(" ".join(cur))
        return chunks

    async def _extract_hierarchical_topics_with_llm(self, text: str) -> Dict[str, Any]:
        prompt = f"""Analyze the following text and generate a hierarchical mind map structure designed to trigger quick "flashback" memory recall for students.
        The structure should have a root topic, main topics (level 1), subtopics (level 2), and highly detailed concepts/facts (level 3).
        
        Important Guidelines:
        - Do not use single words. Use context-rich, descriptive sentences or phrases.
        - Level 3 (detailed concepts) should contain 10-15 word factual summaries that act as memory hooks (e.g., instead of "Powerhouse", use "Mitochondria acts as the cell's powerhouse by generating ATP energy through cellular respiration").
        
        Return ONLY a JSON object representing the hierarchy, structured like this:
        {{
            "topic": "Main concept of the text",
            "children": [
                {{
                    "topic": "Descriptive main topic 1",
                    "children": [
                        {{
                            "topic": "Context-rich subtopic phrase",
                            "children": [
                                {{"topic": "Detailed, highly factual concept sentence for quick memory recall"}}
                            ]
                        }}
                    ]
                }}
            ]
        }}
        
        Ensure there are exactly 5 main topics (representing the 5 arms of a starfish), and they branch out meaningfully up to 3 levels deep with rich content.
        Return ONLY valid JSON. Do not use markdown backticks.

        Text:
        {text[:8000]} 
        """
        try:
            response = await self.llm_client.generate_response(prompt)
            start_idx = response.find('{')
            end_idx = response.rfind('}')
            if start_idx != -1 and end_idx != -1:
                json_str = response[start_idx:end_idx+1]
                data = json.loads(json_str)
                print(f" LLM hierarchical topics extracted successfully.")
                return data
            return {}
        except Exception as e:
            print(f" LLM hierarchical topic extraction failed: {e}")
            return {}

    def _score_terms(self, chunks: List[str], top_k=80) -> List[Tuple[str, float]]:
        print(" Scoring terms with CountVectorizer...")
        try:
            vectorizer = CountVectorizer(
                ngram_range=(1, 3),
                max_df=0.85,
                min_df=2,
                stop_words="english",
                max_features=1200,
            )
            X = vectorizer.fit_transform(chunks)
            scores = np.asarray(X.sum(axis=0)).ravel()
            terms = vectorizer.get_feature_names_out()
            
            print(f"  Vectorizer found {len(terms)} terms")
            print(f"  Score range: {scores.min():.3f} - {scores.max():.3f}")
            
            scored = sorted(zip(terms, scores), key=lambda x: x[1], reverse=True)
            max_score = scored[0][1] if scored else 1.0
            scored = [(term, float(score) / max_score) for term, score in scored]
            
            print(f"  After normalization, top 3: {scored[:3]}")
            return scored[:top_k]
            
        except Exception as e:
            print(f" Error in _score_terms: {e}")
            return self._fallback_term_scoring(chunks, top_k)

    def _fallback_term_scoring(self, chunks: List[str], top_k=50) -> List[Tuple[str, float]]:
        print(" Using fallback term scoring...")
        word_counts = Counter()
        stop_words = set(TfidfVectorizer(stop_words="english").get_stop_words())
        
        for chunk in chunks:
            words = re.findall(r"\b[a-zA-Z][a-zA-Z0-9\-]+\b", chunk.lower())
            for word in words:
                if len(word) > 3 and word not in stop_words:
                    word_counts[word] += 1
        
        if not word_counts:
            return []
        
        max_count = word_counts.most_common(1)[0][1]
        scored = [(w, c / max_count) for w, c in word_counts.most_common(top_k)]
        print(f"  Fallback scoring found {len(scored)} terms")
        return scored

    def _build_cooccurrence_graph(self, chunks: List[str], terms: Set[str]) -> nx.Graph:
        G = nx.Graph()
        G.add_nodes_from(list(terms))
        window = 8
        
        edge_count = 0
        for chunk in chunks:
            tokens = [t for t in re.findall(r"[a-zA-Z][a-zA-Z0-9\-]+", chunk.lower()) if t in terms]
            for i, t1 in enumerate(tokens):
                for j in range(i + 1, min(i + window, len(tokens))):
                    t2 = tokens[j]
                    if t1 != t2:
                        current_weight = G.get_edge_data(t1, t2, {}).get("weight", 0)
                        G.add_edge(t1, t2, weight=current_weight + 1)
                        edge_count += 1
        
        print(f"  Built graph with {len(G.nodes)} nodes, {len(G.edges)} edges ({edge_count} total connections)")
        return G

    def _calculate_circular_positions(self, count: int, radius: float, center_x=0, center_y=0) -> List[Tuple[float, float]]:
        if count == 0:
            return []
        if count == 1:
            return [(center_x, center_y)]
        positions = []
        for i in range(count):
            angle = 2 * math.pi * i / count - (math.pi / 2)
            x = center_x + radius * math.cos(angle)
            y = center_y + radius * math.sin(angle)
            positions.append((x, y))
        return positions

    def _persist_and_return(self, document, topic: str, mindmap_data: Dict[str, Any], db: Session):
        print(" Persisting mindmap to database...")
        mindmap_id = str(uuid.uuid4())
        m = MindMap(
            id=mindmap_id,
            document_id=document.id,
            user_id=document.user_id,
            topic=topic,
            nodes=mindmap_data.get("nodes", []),
            edges=mindmap_data.get("edges", []),
        )
        db.add(m)
        db.commit()
        
        result = {
            "mindmap_id": mindmap_id,
            "document_id": document.id,
            "nodes": mindmap_data.get("nodes", []),
            "edges": mindmap_data.get("edges", []),
            "topic": topic,
            "created_at": m.created_at,
        }
        
        print(f" Mindmap saved with ID: {mindmap_id}")
        print(f" Returning data with {len(result['nodes'])} nodes")
        return result

    def get_user_mindmaps(self, user_id: int, db: Session) -> List[Dict[str, Any]]:
        """List mind maps overview for a user."""
        mindmaps = db.query(MindMap).filter(MindMap.user_id == user_id).all()
        return [
            {
                "mindmap_id": m.id,
                "document_id": m.document_id,
                "topic": m.topic,
                "node_count": len(m.nodes) if m.nodes else 0,
                "created_at": m.created_at,
            }
            for m in mindmaps
        ]

    def get_latest_mindmap_for_document(self, document_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """Get latest mindmap for a specific document"""
        mindmap = db.query(MindMap).filter(MindMap.document_id == document_id).order_by(MindMap.created_at.desc()).first()
        if not mindmap:
            return None
        return {
            "mindmap_id": mindmap.id,
            "document_id": mindmap.document_id,
            "topic": mindmap.topic,
            "nodes": mindmap.nodes,
            "edges": mindmap.edges,
            "created_at": mindmap.created_at
        }