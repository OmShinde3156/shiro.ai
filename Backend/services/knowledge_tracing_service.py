from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from models.database import LearnerConceptState, LearnerEventLog, KnowledgeNode, Document
from datetime import datetime
from typing import List, Dict, Any, Optional
import math
import re

# Canonical Corbett & Anderson BKT Parameters
DEFAULT_P_L0 = 0.20    # Prior probability that student knows concept initially
DEFAULT_P_T  = 0.15    # Transition probability (learning rate between attempts)
DEFAULT_P_G  = 0.25    # Guess probability (answering correctly despite unlearned)
DEFAULT_P_S  = 0.10    # Slip probability (answering incorrectly despite learned)
MASTERY_THRESHOLD = 0.85 # P(L) threshold for classification as 'Mastered'


class KnowledgeTracingService:
    """
    Bayesian Knowledge Tracing (BKT) Engine (KT-01).
    Models latent student knowledge states P(L_t) across learning opportunities,
    providing mathematically grounded concept mastery, retention estimates,
    and adaptive diagnostic recovery.
    """

    def __init__(
        self,
        default_p_l0: float = DEFAULT_P_L0,
        default_p_t: float = DEFAULT_P_T,
        default_p_g: float = DEFAULT_P_G,
        default_p_s: float = DEFAULT_P_S,
        mastery_threshold: float = MASTERY_THRESHOLD
    ):
        self.default_p_l0 = default_p_l0
        self.default_p_t = default_p_t
        self.default_p_g = default_p_g
        self.default_p_s = default_p_s
        self.mastery_threshold = mastery_threshold

    # =========================================================================
    # 🧮 MATHEMATICAL FOUNDATION (Corbett & Anderson BKT)
    # =========================================================================

    def compute_posterior(
        self,
        p_l: float,
        is_correct: bool,
        p_guess: Optional[float] = None,
        p_slip: Optional[float] = None
    ) -> float:
        """
        Step 1: Compute posterior P(L_t | Observation).
        Applies Bayes' Theorem on observation evidence.
        """
        pg = p_guess if p_guess is not None else self.default_p_g
        ps = p_slip if p_slip is not None else self.default_p_s

        eps = 1e-7
        p_l = max(eps, min(1.0 - eps, p_l))

        if is_correct:
            # P(L | obs=1) = [P(L) * (1 - P(S))] / [P(L) * (1 - P(S)) + (1 - P(L)) * P(G)]
            numerator = p_l * (1.0 - ps)
            denominator = numerator + (1.0 - p_l) * pg
        else:
            # P(L | obs=0) = [P(L) * P(S)] / [P(L) * P(S) + (1 - P(L)) * (1 - P(G))]
            numerator = p_l * ps
            denominator = numerator + (1.0 - p_l) * (1.0 - pg)

        posterior = numerator / max(eps, denominator)
        return max(0.01, min(0.99, posterior))

    def compute_transition(self, posterior: float, p_learn: Optional[float] = None) -> float:
        """
        Step 2: Markov Knowledge Transition to next opportunity P(L_{t+1}).
        P(L_{t+1}) = P(L_t | obs) + (1 - P(L_t | obs)) * P(T)
        """
        pt = p_learn if p_learn is not None else self.default_p_t
        p_next = posterior + (1.0 - posterior) * pt
        return max(0.01, min(0.99, p_next))

    def predict_next_performance(
        self,
        p_l: float,
        p_guess: Optional[float] = None,
        p_slip: Optional[float] = None
    ) -> float:
        """
        Predicts probability that student will answer next question correctly:
        P(Correct_{t+1}) = P(L_{t+1}) * (1 - P(S)) + (1 - P(L_{t+1})) * P(G)
        """
        pg = p_guess if p_guess is not None else self.default_p_g
        ps = p_slip if p_slip is not None else self.default_p_s
        return p_l * (1.0 - ps) + (1.0 - p_l) * pg

    # =========================================================================
    # ⚡ STATE MANAGEMENT & INGESTION
    # =========================================================================

    def update_knowledge_state(
        self,
        user_id: int,
        concept_name: str,
        is_correct: bool,
        response_time_ms: int = 0,
        interaction_type: str = "quiz",
        item_id: Optional[str] = None,
        document_id: Optional[int] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Record a learning event, calculate the Bayesian knowledge update,
        and append to the immutable event log.
        """
        cleaned_concept = concept_name.strip().title()

        # 1. Fetch or create latent state
        state = db.query(LearnerConceptState).filter(
            LearnerConceptState.user_id == user_id,
            LearnerConceptState.concept_name == cleaned_concept
        ).first()

        if not state:
            state = LearnerConceptState(
                user_id=user_id,
                concept_name=cleaned_concept,
                document_id=document_id,
                p_known=self.default_p_l0,
                p_learn=self.default_p_t,
                p_guess=self.default_p_g,
                p_slip=self.default_p_s,
                total_opportunities=0,
                consecutive_correct=0,
                mastered=False,
                last_interaction_at=datetime.utcnow()
            )
            db.add(state)
            db.flush()

        p_before = state.p_known

        # Dynamic parameter micro-tuning based on response latency
        p_guess = state.p_guess
        p_slip = state.p_slip
        if response_time_ms > 0:
            if is_correct and response_time_ms < 1500:
                # Fast correct answer on MCQ might be a rapid guess
                p_guess = min(0.40, p_guess + 0.05)
            elif not is_correct and response_time_ms > 45000:
                # Long struggle before failure indicates genuine knowledge gap, not careless slip
                p_slip = max(0.04, p_slip - 0.03)

        # 2. Run BKT Equation Steps
        posterior = self.compute_posterior(p_before, is_correct, p_guess, p_slip)
        p_after = self.compute_transition(posterior, state.p_learn)

        # 3. Update materialized state
        state.p_known = round(p_after, 4)
        state.total_opportunities = (state.total_opportunities or 0) + 1
        if is_correct:
            state.consecutive_correct = (state.consecutive_correct or 0) + 1
        else:
            state.consecutive_correct = 0

        state.mastered = (state.p_known >= self.mastery_threshold)
        state.last_interaction_at = datetime.utcnow()
        if document_id and not state.document_id:
            state.document_id = document_id

        # 4. Log immutable telemetry record (DATA-01)
        event_log = LearnerEventLog(
            user_id=user_id,
            concept_name=cleaned_concept,
            interaction_type=interaction_type,
            item_id=item_id,
            is_correct=is_correct,
            response_time_ms=response_time_ms,
            p_known_before=round(p_before, 4),
            p_known_after=round(p_after, 4),
            timestamp=datetime.utcnow()
        )
        db.add(event_log)

        # 5. Synchronize with Concept-Level Memory Retention & Spaced Forgetting (FORGET-01)
        retention_telemetry = None
        try:
            from services.retention_service import retention_service
            retention_telemetry = retention_service.process_learning_interaction(
                user_id=user_id,
                concept_name=cleaned_concept,
                is_correct=is_correct,
                interaction_type=interaction_type,
                source_event_id=item_id,
                db=db
            )
        except Exception as e:
            logger.warning(f"Retention sync warning for concept '{cleaned_concept}': {e}")

        db.commit()
        db.refresh(state)

        next_pred = self.predict_next_performance(state.p_known, state.p_guess, state.p_slip)

        return {
            "concept_name": state.concept_name,
            "p_known_before": p_before,
            "p_known_after": state.p_known,
            "delta": round(state.p_known - p_before, 4),
            "mastered": state.mastered,
            "total_opportunities": state.total_opportunities,
            "consecutive_correct": state.consecutive_correct,
            "predicted_next_accuracy": round(next_pred, 4),
            "retention": retention_telemetry
        }

    # =========================================================================
    # 🔍 CONCEPT RESOLUTION (KnowledgeNode Mapping)
    # =========================================================================

    def auto_tag_concept(
        self,
        text: str,
        document_id: Optional[int] = None,
        user_id: Optional[int] = None,
        db: Session = None
    ) -> str:
        """
        Maps a question, prompt, or flashcard text to an existing KnowledgeNode.
        Falls back to document subject or broad domain topic.
        """
        text_lower = text.lower()

        # 1. Search existing KnowledgeNode labels in the document
        if document_id and db:
            nodes = db.query(KnowledgeNode).filter(KnowledgeNode.document_id == document_id).all()
            for node in sorted(nodes, key=lambda n: len(n.label), reverse=True):
                if node.label.lower() in text_lower:
                    return node.label

        # 2. Search user's global KnowledgeNode catalog
        if user_id and db:
            user_nodes = db.query(KnowledgeNode).filter(KnowledgeNode.user_id == user_id).limit(50).all()
            for node in sorted(user_nodes, key=lambda n: len(n.label), reverse=True):
                if node.label.lower() in text_lower:
                    return node.label

        # 3. Fallback to Document Subject
        if document_id and db:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc and doc.subject:
                return doc.subject

        # 4. Keyword extraction fallback
        keywords = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        if keywords:
            return keywords[0]

        return "Core Architecture"

    # =========================================================================
    # 📊 DIAGNOSTICS & ANALYTICS
    # =========================================================================

    def get_student_concept_mastery(
        self,
        user_id: int,
        document_id: Optional[int] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Retrieves all concept mastery states for a student, categorized into
        Mastered (>=85%), Developing (60-84%), and Needs Review (<60%).
        """
        query = db.query(LearnerConceptState).filter(LearnerConceptState.user_id == user_id)
        if document_id:
            query = query.filter(LearnerConceptState.document_id == document_id)

        states = query.order_by(LearnerConceptState.p_known.asc()).all()

        concept_list = []
        mastered_count = 0
        developing_count = 0
        review_count = 0
        total_p_known = 0.0

        for s in states:
            p_val = s.p_known
            total_p_known += p_val
            pct = int(round(p_val * 100))

            if p_val >= self.mastery_threshold:
                status = "Mastered"
                variant = "sage"
                mastered_count += 1
            elif p_val >= 0.60:
                status = "Developing"
                variant = "gold"
                developing_count += 1
            else:
                status = "Needs Review"
                variant = "rose"
                review_count += 1

            next_acc = self.predict_next_performance(p_val, s.p_guess, s.p_slip)

            concept_list.append({
                "concept_name": s.concept_name,
                "document_id": s.document_id,
                "mastery_score": pct,
                "p_known": round(p_val, 3),
                "predicted_accuracy": int(round(next_acc * 100)),
                "status": status,
                "color_variant": variant,
                "opportunities": s.total_opportunities,
                "consecutive_correct": s.consecutive_correct,
                "last_studied": s.last_interaction_at.isoformat() if s.last_interaction_at else None
            })

        total_concepts = len(states)
        overall_knowledge_index = int(round((total_p_known / total_concepts) * 100)) if total_concepts > 0 else 0

        return {
            "user_id": user_id,
            "overall_knowledge_index": overall_knowledge_index,
            "total_concepts_tracked": total_concepts,
            "mastered_count": mastered_count,
            "developing_count": developing_count,
            "needs_review_count": review_count,
            "concepts": concept_list
        }

    def get_high_yield_recovery_concepts(
        self,
        user_id: int,
        limit: int = 3,
        db: Session = None
    ) -> List[Dict[str, Any]]:
        """
        Returns the top lowest-probability concepts requiring immediate recovery.
        """
        states = db.query(LearnerConceptState).filter(
            LearnerConceptState.user_id == user_id
        ).order_by(LearnerConceptState.p_known.asc()).limit(limit).all()

        return [
            {
                "concept_name": s.concept_name,
                "document_id": s.document_id,
                "mastery_score": int(round(s.p_known * 100)),
                "p_known": round(s.p_known, 3),
                "opportunities": s.total_opportunities,
                "consecutive_correct": s.consecutive_correct
            }
            for s in states
        ]


# Singleton instance
knowledge_tracing_service = KnowledgeTracingService()
