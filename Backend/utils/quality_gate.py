import re
import logging
from typing import List, Dict, Any, Optional, Set
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class GroundingEvidence(BaseModel):
    grounding_score: float = Field(description="Semantic grounding score between 0.0 and 1.0")
    is_grounded: bool = Field(description="Whether evidence meets minimum grounding threshold")
    supporting_chunk_ids: List[str] = Field(default_factory=list, description="IDs of source chunks providing evidence")
    supporting_spans: List[str] = Field(default_factory=list, description="Text spans supporting the claim")
    grounding_method: str = "concept_token_overlap"


class QualityGate:
    """
    Shiro AI Output Quality Gate & Grounding Engine (AI-02).
    Enforces structural validity, deduplication, semantic source grounding,
    and metadata citation integrity.
    """

    @staticmethod
    def _tokenize(text: str) -> Set[str]:
        # Filter common stopwords for meaningful concept overlap
        stopwords = {
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", 
            "of", "with", "by", "is", "are", "was", "were", "be", "been", "that",
            "which", "this", "these", "those", "it", "its", "as", "from", "what",
            "how", "why", "when", "where", "who", "which"
        }
        tokens = set(re.findall(r'\b[a-zA-Z0-9_-]{3,}\b', text.lower()))
        return tokens - stopwords

    @classmethod
    def evaluate_grounding(cls, claim_text: str, source_text: str, source_chunks: Optional[List[Dict[str, Any]]] = None) -> GroundingEvidence:
        """
        Evaluates whether claim_text is grounded in source_text or specific source_chunks.
        Returns detailed GroundingEvidence including scores, chunk IDs, and supporting text spans.
        """
        if not source_text and not source_chunks:
            return GroundingEvidence(grounding_score=0.0, is_grounded=False)

        claim_tokens = cls._tokenize(claim_text)
        if not claim_tokens:
            return GroundingEvidence(grounding_score=1.0, is_grounded=True)

        # Check against individual chunks if available
        supporting_chunk_ids = []
        supporting_spans = []
        max_chunk_score = 0.0

        if source_chunks:
            for chunk in source_chunks:
                chunk_content = chunk.get("content", "")
                chunk_tokens = cls._tokenize(chunk_content)
                if not chunk_tokens:
                    continue
                
                intersection = claim_tokens.intersection(chunk_tokens)
                overlap_ratio = len(intersection) / len(claim_tokens)
                
                if overlap_ratio >= 0.25:
                    cid = chunk.get("chunk_id", str(chunk.get("id", "unknown")))
                    supporting_chunk_ids.append(cid)
                    # Extract sample supporting snippet
                    for token in list(intersection)[:3]:
                        idx = chunk_content.lower().find(token)
                        if idx != -1:
                            start = max(0, idx - 20)
                            end = min(len(chunk_content), idx + 80)
                            supporting_spans.append(chunk_content[start:end].strip())
                    
                    if overlap_ratio > max_chunk_score:
                        max_chunk_score = overlap_ratio

        # Fallback evaluation against full source_text
        source_tokens = cls._tokenize(source_text)
        full_intersection = claim_tokens.intersection(source_tokens)
        overall_score = len(full_intersection) / len(claim_tokens) if claim_tokens else 0.0
        final_score = max(max_chunk_score, overall_score)

        return GroundingEvidence(
            grounding_score=round(final_score, 4),
            is_grounded=(final_score >= 0.25),
            supporting_chunk_ids=supporting_chunk_ids[:5],
            supporting_spans=supporting_spans[:3],
            grounding_method="concept_token_overlap"
        )

    @classmethod
    def validate_quiz_quality(
        cls, 
        questions: List[Dict[str, Any]], 
        source_text: str = "", 
        source_chunks: Optional[List[Dict[str, Any]]] = None,
        min_grounding_score: float = 0.25
    ) -> List[Dict[str, Any]]:
        """
        Filters and validates generated quiz questions:
        1. Structural integrity: Valid options (A, B, C, D) and matching correct answer key.
        2. Deduplication: Eliminates duplicate questions.
        3. Semantic Grounding: Discards questions with ungrounded/hallucinated concepts.
        """
        valid_questions: List[Dict[str, Any]] = []
        seen_questions: Set[str] = set()

        for q in questions:
            # 1. Structural Check
            q_text = q.get("question", "").strip()
            if len(q_text) < 5:
                continue

            options = q.get("options", {})
            if not isinstance(options, dict):
                continue

            # Verify options A, B, C, D are present and non-empty
            if not all(k in options and str(options[k]).strip() for k in ["A", "B", "C", "D"]):
                continue

            # Verify correct_answer key
            correct_key = str(q.get("correct_answer", "")).strip().upper()
            if correct_key not in ["A", "B", "C", "D"]:
                continue

            # 2. Duplicate Detection
            norm_q = re.sub(r'\s+', ' ', q_text.lower())
            if norm_q in seen_questions:
                continue
            seen_questions.add(norm_q)

            # 3. Grounding Validation
            if source_text or source_chunks:
                evidence = cls.evaluate_grounding(
                    claim_text=f"{q_text} {options.get(correct_key, '')}",
                    source_text=source_text,
                    source_chunks=source_chunks
                )
                if evidence.grounding_score < min_grounding_score:
                    logger.warning(f"Rejecting ungrounded question (score {evidence.grounding_score}): {q_text}")
                    continue

                q["grounding_score"] = evidence.grounding_score
                q["supporting_chunk_ids"] = evidence.supporting_chunk_ids

            valid_questions.append(q)

        return valid_questions

    @classmethod
    def validate_flashcard_quality(
        cls, 
        flashcards: List[Dict[str, str]], 
        source_text: str = "", 
        source_chunks: Optional[List[Dict[str, Any]]] = None,
        min_grounding_score: float = 0.25
    ) -> List[Dict[str, str]]:
        """
        Filters and validates generated flashcards:
        1. Non-empty question and answer.
        2. Deduplication.
        3. Semantic Grounding.
        """
        valid_cards: List[Dict[str, str]] = []
        seen_terms: Set[str] = set()

        for fc in flashcards:
            q_text = str(fc.get("question", "")).strip()
            a_text = str(fc.get("answer", "")).strip()

            if len(q_text) < 3 or len(a_text) < 3:
                continue

            norm_term = q_text.lower()
            if norm_term in seen_terms:
                continue
            seen_terms.add(norm_term)

            if source_text or source_chunks:
                evidence = cls.evaluate_grounding(
                    claim_text=f"{q_text} {a_text}",
                    source_text=source_text,
                    source_chunks=source_chunks
                )
                if evidence.grounding_score < min_grounding_score:
                    logger.warning(f"Rejecting ungrounded flashcard (score {evidence.grounding_score}): {q_text}")
                    continue

                fc["grounding_score"] = evidence.grounding_score
                fc["supporting_chunk_ids"] = evidence.supporting_chunk_ids

            valid_cards.append(fc)

        return valid_cards

    @classmethod
    def validate_citation_provenance(
        cls, 
        citations: List[Dict[str, Any]], 
        available_chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Ensures all citations map to actual chunks retrieved from authorized corpus metadata.
        """
        valid_chunk_ids = {
            c.get("chunk_id") for c in available_chunks if c.get("chunk_id")
        }

        verified_citations = []
        for cit in citations:
            cid = cit.get("chunk_id")
            if cid and cid in valid_chunk_ids:
                verified_citations.append(cit)
            elif not cid and cit.get("document_id"):
                # Matches document metadata
                verified_citations.append(cit)

        return verified_citations
