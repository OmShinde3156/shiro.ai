# Debug version of mindmap_service.py
from sqlalchemy.orm import Session
from models.database import Document, MindMap
from utils.llm_client import LLMClient
from typing import Dict, Any, List, Tuple, Set
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
        print(f"🔍 DEBUG: Starting mindmap generation for document {document_id}")
        
        # 1) Load document
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise Exception("Document not found")

        raw_text = (document.text_content or "").strip()
        if not raw_text:
            raise Exception("Document is empty")

        if not topic:
            topic = f"Summary of {document.filename or 'Document'}"

        print(f"📄 Document loaded: {len(raw_text)} characters")

        # 2) Preprocess + chunk
        chunks = self._chunk_text(self._clean_text(raw_text), target_chunk_size=1500, overlap=150)
        print(f"📝 Created {len(chunks)} chunks")

        # 3) Extract salient terms (TF-IDF) - with detailed logging
        top_terms = self._score_terms(chunks, top_k=80)
        print(f"📊 Extracted {len(top_terms)} terms with scores:")
        for i, (term, score) in enumerate(top_terms[:10]):  # Show top 10
            print(f"  {i+1}. '{term}': {score:.3f}")

        if not top_terms:
            print("⚠️  No terms extracted, falling back to root-only")
            mindmap_data = {
                "nodes": [{"id": "root", "label": topic, "level": 0, "score": 1.0}],
                "edges": [],
            }
            return self._persist_and_return(document, topic, mindmap_data, db)

        # 4) Use LLM to extract main topics
        main_topics = await self._extract_main_topics_with_llm(raw_text, max_topics=8)
        print(f"🤖 LLM extracted topics: {main_topics}")

        # 5) Build co-occurrence graph & PageRank
        all_salient_terms = set([t for t, _ in top_terms] + main_topics)
        G = self._build_cooccurrence_graph(chunks, terms=all_salient_terms)
        pr = nx.pagerank(G, weight="weight") if len(G) > 1 else {}
        print(f"🕸️  Graph has {len(G.nodes)} nodes, {len(G.edges)} edges")
        print(f"📈 PageRank scores (top 5): {dict(list(sorted(pr.items(), key=lambda x: x[1], reverse=True)[:5]))}")

        # 6) Calculate normalized scores with debugging
        term_score = self._calculate_normalized_scores_debug(top_terms, pr, main_topics)
        
        # 7) Create level-1 nodes manually with explicit scoring
        max_depth = max(1, int(depth or 2))
        root = Node(id="root", label=topic, level=0, score=1.0, x=0.0, y=0.0)
        nodes, edges = [root], []

        # Use main topics or top terms for level 1
        level1_terms = main_topics if main_topics else [t for t, _ in top_terms[:8]]
        print(f"🌟 Level 1 terms: {level1_terms}")

        # Calculate positions and create nodes with explicit scoring
        level1_positions = self._calculate_circular_positions(len(level1_terms), radius=250)
        
        for i, term in enumerate(level1_terms):
            nid = f"n1_{i}"
            x, y = level1_positions[i]
            
            # Get score directly from term_score dict
            raw_score = term_score.get(term, 0.3)
            print(f"  📍 Node '{term}': raw_score={raw_score:.3f}")
            
            # Apply level normalization
            final_score = max(0.4, min(0.9, raw_score))  # Clamp to reasonable range
            print(f"      Final score: {final_score:.3f}")
            
            n = Node(id=nid, label=term, level=1, score=final_score, x=x, y=y)
            nodes.append(n)
            edges.append(Edge(source="root", target=nid, weight=1.0))

        print(f"✅ Created {len(nodes)} nodes total")
        for node in nodes:
            print(f"  📌 {node.label} (level {node.level}): {node.score:.3f}")

        # Build mind map data
        mindmap_data = {
            "nodes": [self._node_to_dict(n) for n in nodes],
            "edges": [e.__dict__ for e in edges],
        }

        print(f"📦 Final mindmap data:")
        print(f"  Nodes: {len(mindmap_data['nodes'])}")
        for node_data in mindmap_data['nodes']:
            print(f"    {node_data['label']}: {node_data['score']} ({type(node_data['score'])})")

        return self._persist_and_return(document, topic, mindmap_data, db)

    def _node_to_dict(self, node: Node) -> Dict[str, Any]:
        """Convert Node to dict ensuring score is a proper float"""
        return {
            "id": node.id,
            "label": node.label,
            "level": node.level,
            "score": float(node.score),  # Ensure it's a Python float
            "x": float(node.x),
            "y": float(node.y)
        }

    def _calculate_normalized_scores_debug(self, top_terms: List[Tuple[str, float]], 
                                         pagerank: Dict[str, float], 
                                         main_topics: List[str]) -> Dict[str, float]:
        """Calculate and normalize scores with detailed debugging."""
        print("🧮 Calculating normalized scores...")
        term_score = {}
        
        # Base TF-IDF scores
        print("  📊 TF-IDF base scores:")
        for term, score in top_terms[:5]:
            term_score[term] = float(score)
            print(f"    '{term}': {score:.3f}")
        
        # Add remaining terms
        for term, score in top_terms:
            term_score[term] = float(score)
        
        # Add PageRank boost
        if pagerank:
            max_pr = max(pagerank.values())
            print(f"  📈 Adding PageRank boost (max={max_pr:.3f}):")
            for term in list(term_score.keys())[:5]:  # Show first 5
                old_score = term_score[term]
                pr_score = pagerank.get(term, 0.0) / max_pr if max_pr > 0 else 0.0
                term_score[term] = 0.7 * old_score + 0.3 * pr_score
                print(f"    '{term}': {old_score:.3f} + {pr_score:.3f} = {term_score[term]:.3f}")
        
        # Boost LLM topics
        print(f"  🤖 Boosting LLM topics: {main_topics}")
        for topic in main_topics:
            old_score = term_score.get(topic, 0.5)
            term_score[topic] = min(1.0, old_score + 0.2)
            print(f"    '{topic}': {old_score:.3f} -> {term_score[topic]:.3f}")
        
        print(f"  ✅ Final term scores (showing top 8):")
        sorted_scores = sorted(term_score.items(), key=lambda x: x[1], reverse=True)
        for term, score in sorted_scores[:8]:
            print(f"    '{term}': {score:.3f}")
        
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

    async def _extract_main_topics_with_llm(self, text: str, max_topics=8) -> List[str]:
        prompt = f"""Analyze the following text and identify the {max_topics} most important, high-level topics or themes.
        Each topic should be a short, concise phrase (2-4 words).
        Return a simple JSON list of strings.

        Text:
        {text[:8000]} 
        """
        try:
            response = await self.llm_client.generate_response(prompt)
            match = re.search(r"\[(.*?)\]", response)
            if match:
                topics = json.loads(match.group(0))
                print(f"🤖 LLM response topics: {topics}")
                return topics
            return []
        except Exception as e:
            print(f"❌ LLM topic extraction failed: {e}")
            return []

    def _score_terms(self, chunks: List[str], top_k=80) -> List[Tuple[str, float]]:
        print("📊 Scoring terms with CountVectorizer...")
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
            print(f"❌ Error in _score_terms: {e}")
            return self._fallback_term_scoring(chunks, top_k)

    def _fallback_term_scoring(self, chunks: List[str], top_k=50) -> List[Tuple[str, float]]:
        print("📊 Using fallback term scoring...")
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
        
        print(f"🕸️  Built graph with {len(G.nodes)} nodes, {len(G.edges)} edges ({edge_count} total connections)")
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
        print("💾 Persisting mindmap to database...")
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
        
        print(f"✅ Mindmap saved with ID: {mindmap_id}")
        print(f"📦 Returning data with {len(result['nodes'])} nodes")
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