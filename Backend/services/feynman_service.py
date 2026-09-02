import json
import random
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models.database import KnowledgeNode, KnowledgeEdge, Document
from utils.llm_client import llm_client

logger = logging.getLogger(__name__)

CHALLENGE_TYPES = {
    "explain": "Explain the foundational mechanism from first principles.",
    "why": "Explain why this concept matters and what consequences arise if it is ignored.",
    "how": "Explain how this process operates step-by-step without skipping causal links.",
    "compare": "Explain the crucial distinction between this concept and an easily confused counterpart.",
    "apply": "Apply this concept to a real-world scenario or thought experiment.",
    "teach": "Teach this idea to a 12-year-old using a vivid everyday analogy.",
    "misconception": "Dissect a common misconception or flawed intuition about this concept."
}

class FeynmanService:
    def __init__(self):
        pass

    async def get_available_concepts(self, user_id: int, document_id: int, db: Session) -> List[Dict[str, Any]]:
        """Fetch or synthesize available concepts from the document for the student to select from."""
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.user_id == user_id
        ).first()

        if not document:
            return []

        # 1. Check if Knowledge Graph nodes already exist for this document
        nodes = db.query(KnowledgeNode).filter(
            KnowledgeNode.document_id == document_id,
            KnowledgeNode.user_id == user_id
        ).all()

        if nodes and len(nodes) >= 3:
            return [
                {
                    "id": str(n.id),
                    "name": n.label,
                    "description": n.description or f"Core concept in {document.filename}"
                }
                for n in nodes[:15]
            ]

        # 2. Extract key conceptual topics directly from the document text
        sample_text = (document.text_content or "")[:4000]
        if not sample_text.strip():
            return []

        prompt = f"""
Analyze the following study material and identify 6 to 8 core conceptual topics that are ideal for the Feynman Technique (testing deep understanding, mental models, and causal reasoning).
Avoid generic labels like "Introduction", "Summary", or single non-descriptive words. Formulate meaningful conceptual topics (e.g. "Author's Purpose & Reader Influence", "First Impressions & Cognitive Bias", "Rate of Reaction Constraints").

Document Title: {document.filename}
Document Text Sample:
{sample_text}

Return strictly a JSON array of objects with "name" and "description":
[
  {{"name": "Concept Name", "description": "Brief one-sentence explanation of what this concept covers."}}
]
"""
        try:
            raw = await llm_client.generate_response(prompt)
            cleaned = raw.strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0]
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0]
            concepts = json.loads(cleaned)
            return [
                {
                    "id": f"doc_{i}",
                    "name": c.get("name", "Key Topic"),
                    "description": c.get("description", "")
                }
                for i, c in enumerate(concepts)
            ]
        except Exception as e:
            logger.warning(f"Error extracting concepts from document: {e}")
            return [
                {"id": "doc_1", "name": f"Core Thesis of {document.filename}", "description": "The central premise and arguments."}
            ]

    async def get_challenge_concept(
        self, 
        user_id: int, 
        document_ids: List[int], 
        concept_name: Optional[str] = None,
        challenge_type: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Generate a pedagogically rich Feynman Challenge.
        Instead of a single word ('Author'), creates a thought-provoking teaching challenge.
        """
        if not document_ids:
            return {"error": "Please select at least one document to generate a challenge."}

        # Fetch primary document
        document = db.query(Document).filter(
            Document.id.in_(document_ids),
            Document.user_id == user_id
        ).first()

        if not document:
            return {"error": "Selected document not found or unauthorized."}

        # 1. Determine target concept
        target_concept = concept_name.strip() if concept_name and concept_name.strip() and concept_name != "ai_pick" else None

        # Related graph context
        graph_context = ""
        if target_concept:
            node = db.query(KnowledgeNode).filter(
                KnowledgeNode.label.ilike(f"%{target_concept}%"),
                KnowledgeNode.user_id == user_id
            ).first()
            if node:
                edges = db.query(KnowledgeEdge).filter(
                    (KnowledgeEdge.source_node_id == node.id) | (KnowledgeEdge.target_node_id == node.id)
                ).all()
                if edges:
                    graph_context = f"Concept relations: {len(edges)} connected topics."
        else:
            # Pick from KnowledgeNode or synthesize from document
            nodes = db.query(KnowledgeNode).filter(
                KnowledgeNode.document_id == document.id,
                KnowledgeNode.user_id == user_id
            ).all()
            if nodes:
                chosen = random.choice(nodes)
                target_concept = chosen.label
            else:
                # Extract on the fly
                concepts = await self.get_available_concepts(user_id, document.id, db)
                if concepts:
                    target_concept = random.choice(concepts)["name"]
                else:
                    target_concept = f"The Core Principles of {document.filename}"

        # 2. Pick challenge type
        if not challenge_type or challenge_type not in CHALLENGE_TYPES:
            challenge_type = random.choice(["why", "how", "teach", "apply", "explain", "compare"])

        challenge_guideline = CHALLENGE_TYPES.get(challenge_type, CHALLENGE_TYPES["explain"])

        # 3. Grounded LLM Prompt to create the challenge
        sample_text = (document.text_content or "")[:3500]

        prompt = f"""
You are the Shiro Socratic Feynman Challenge Architect.
Your mission is to formulate an inspiring, intellectually engaging Feynman Challenge testing whether a student truly UNDERSTANDS and can TEACH a concept without memorizing jargon.

Target Concept: {target_concept}
Document: {document.filename}
Challenge Archetype: {challenge_type.upper()} ({challenge_guideline})
Context excerpt:
{sample_text}

CRITICAL RULES:
1. Do NOT reveal the full answer or lecture notes in the prompt or hint. The student must do the cognitive work.
2. The challenge title MUST be a specific, provocative question or teaching scenario (e.g. "Why does the author matter in a book?", "How would you explain the difference between speed and velocity to someone who has never studied physics?", "Imagine writing a guide to convince students to build habits—how would your intention shape what you write?").
3. Include an encouraging, clear teaching instruction ("Explain it to someone who has never studied this before. Don't memorize definitions—teach it from first principles using everyday analogies.").
4. Provide a subtle, encouraging hint that guides intuition without giving away the solution.

Return strictly a JSON object:
{{
  "concept_name": "{target_concept}",
  "challenge_title": "Provocative question / scenario title",
  "challenge_type": "{challenge_type}",
  "challenge_prompt": "Clear teaching instructions for the student",
  "hint": "A subtle intuition hint without giving the answer away"
}}
"""
        try:
            resp = await llm_client.generate_response(prompt)
            cleaned = resp.strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0]
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0]
            data = json.loads(cleaned)

            return {
                "concept_name": data.get("concept_name", target_concept),
                "challenge_title": data.get("challenge_title", f"How would you explain {target_concept} simply?"),
                "challenge_type": data.get("challenge_type", challenge_type),
                "challenge_prompt": data.get("challenge_prompt", "Explain it in your own words as if teaching someone with zero background."),
                "hint": data.get("hint", "Try using a simple real-life analogy from everyday experience."),
                "document_id": document.id,
                "document_name": document.filename
            }
        except Exception as e:
            logger.error(f"Failed to generate custom Feynman challenge: {e}")
            return {
                "concept_name": target_concept,
                "challenge_title": f"Why does '{target_concept}' matter, and how would you teach it?",
                "challenge_type": challenge_type,
                "challenge_prompt": "Explain it in your own words as if you were teaching a friend who knows nothing about this subject. Avoid unexplained textbook jargon.",
                "hint": "Focus on the 'why' and give an intuitive real-world example.",
                "document_id": document.id,
                "document_name": document.filename
            }

    async def evaluate_explanation(
        self, 
        user_id: int, 
        concept_name: str, 
        explanation: str, 
        challenge_title: Optional[str] = None,
        challenge_prompt: Optional[str] = None,
        previous_gaps: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Multi-metric educational diagnostic evaluation for the Feynman Technique.
        Measures Understanding, Clarity, Completeness, Simplicity (Jargon-free), and Reasoning.
        Generates targeted follow-up question to complete the learning loop.
        """
        # Ground truth context
        node = db.query(KnowledgeNode).filter(
            KnowledgeNode.label.ilike(f"%{concept_name}%"),
            KnowledgeNode.user_id == user_id
        ).first()
        
        ground_truth = ""
        if node and node.description:
            ground_truth += f"Ground Truth Concept: {node.label}. Summary: {node.description}\n"

        prompt = f"""
You are Shiro, the empathetic, insightful Socratic AI Tutor evaluating a student's explanation using the Feynman Technique.

The student was given this challenge:
Title: {challenge_title or f"Explain {concept_name}"}
Prompt: {challenge_prompt or "Teach it simply in your own words without jargon."}
Concept: {concept_name}

STUDENT'S TEACHING EXPLANATION:
\"\"\"{explanation}\"\"\"

{f"PREVIOUS GAPS BEING RE-ADDRESSED: {previous_gaps}" if previous_gaps else ""}
{ground_truth}

Evaluate the student's teaching across 5 educational dimensions (0 to 100):
1. understanding_score: Did they grasp the true underlying concept and mental model?
2. clarity_score: Is the explanation lucid, coherent, and easy for a beginner to follow?
3. completeness_score: Did they address the core 'why' and causal mechanism, or did they stop at surface description?
4. jargon_free_score: 100 means pure intuitive language or every technical term was defined simply; lower if they dropped raw buzzwords.
5. reasoning_score: Is their logical progression solid without hand-waving or false conclusions?

Also analyze:
- strengths: Array of 2-3 specific things they explained well (e.g. "Clear central thesis", "Relatable real-world metaphor").
- missing_links: Array of 1-2 crucial missing steps, unaddressed consequences, or logical gaps.
- jargon_detected: Array of technical terms used without explanation (if any).
- misconceptions: Array of any factually inaccurate or confused claims (empty if none).
- feedback: 2-3 sentences of warm, incisive teacher feedback.
- follow_up_question: A targeted, provocative Socratic follow-up question that pushes them to resolve their biggest detected gap! (e.g. "If X causes Y, what happens when Z changes?").
- is_mastered: true if overall understanding is >= 85 and completeness >= 80, else false.

Return strictly JSON:
{{
  "overall_score": 75,
  "understanding_score": 78,
  "clarity_score": 85,
  "completeness_score": 65,
  "jargon_free_score": 90,
  "reasoning_score": 72,
  "verdict": "Strong foundation with one important gap",
  "strengths": ["Clear central idea", "Great everyday analogy"],
  "missing_links": ["Did not explain how author's purpose changes how message is framed"],
  "jargon_detected": [],
  "misconceptions": [],
  "feedback": "...",
  "follow_up_question": "Why might two authors explain the exact same event completely differently?",
  "is_mastered": false
}}
"""
        try:
            resp = await llm_client.generate_response(prompt)
            cleaned = resp.strip()
            if "```json" in cleaned:
                cleaned = cleaned.split("```json")[1].split("```")[0]
            elif "```" in cleaned:
                cleaned = cleaned.split("```")[1].split("```")[0]
            result = json.loads(cleaned)

            # Ensure safe fallbacks for scores
            overall = int(result.get("overall_score") or 70)
            result["score"] = overall
            return result
        except Exception as e:
            logger.error(f"Feynman evaluation parsing failed: {e}")
            return {
                "score": 70,
                "overall_score": 70,
                "understanding_score": 72,
                "clarity_score": 80,
                "completeness_score": 65,
                "jargon_free_score": 85,
                "reasoning_score": 70,
                "verdict": "Good initial explanation with room for deeper depth",
                "strengths": ["Good conversational tone", "Attempted first-principles reasoning"],
                "missing_links": ["Address the core 'why' more explicitly."],
                "jargon_detected": [],
                "misconceptions": [],
                "feedback": "You have a solid intuitive start. Now push deeper into the underlying mechanism.",
                "follow_up_question": f"How would you explain the practical difference this makes in real life?",
                "is_mastered": False
            }

feynman_service = FeynmanService()
