import math
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import desc

from models.database import (
    LearnerConceptState,
    ConceptRetentionEvent,
    User,
    Document
)

logger = logging.getLogger(__name__)


# =========================================================================
# 1. RETENTION POLICY CONFIGURATION
# =========================================================================

@dataclass
class RetentionPolicy:
    """
    Configurable hyperparameters for the Shiro Concept Retention Update Heuristic.
    Allows adjusting memory dynamics without changing algorithm code.
    """
    success_growth_factor: float = 1.2
    difficulty_weight: float = 10.0
    difficulty_offset: float = 11.0
    streak_weight: float = 1.0
    lapse_multiplier: float = 0.40
    minimum_tau_days: float = 0.5
    maximum_tau_days: float = 365.0
    critical_retention_threshold: float = 0.60
    decaying_retention_threshold: float = 0.80
    forecast_horizon_days: float = 7.0
    debounce_window_minutes: int = 30
    model_version: str = "forget-v1"


# =========================================================================
# 2. PLUGGABLE RETENTION MODEL INTERFACE & IMPLEMENTATION
# =========================================================================

class BaseRetentionModel(ABC):
    """
    Abstract interface for concept-level forgetting and retention curves.
    Enables future evaluation of alternative models (e.g. PowerLaw, learned models)
    without breaking the Shiro architecture.
    """

    @abstractmethod
    def retrievability(self, tau: float, elapsed_days: float) -> float:
        """Calculates instantaneous retrievability R(t) in [0.0, 1.0]."""
        pass

    @abstractmethod
    def half_life(self, tau: float) -> float:
        """Calculates memory half-life (days until R(t) = 0.50)."""
        pass

    @abstractmethod
    def conditional_forgetting_risk(self, tau: float, horizon_days: float = 7.0) -> float:
        """
        Calculates conditional probability of forgetting within the next horizon days
        given that the memory is currently retained:
        P(forget next d | retained at t) = 1 - R(t+d) / R(t).
        """
        pass

    @abstractmethod
    def projected_retrievability(self, tau: float, elapsed_days: float, horizon_days: float = 7.0) -> float:
        """Calculates absolute retrievability after horizon days: R(t + horizon)."""
        pass

    @abstractmethod
    def update_after_recall(
        self,
        tau: float,
        elapsed_days: float,
        difficulty: float,
        streak: int,
        policy: RetentionPolicy
    ) -> float:
        """Calculates new time constant tau after successful recall."""
        pass

    @abstractmethod
    def update_after_lapse(
        self,
        tau: float,
        elapsed_days: float,
        difficulty: float,
        streak: int,
        policy: RetentionPolicy
    ) -> float:
        """Calculates new time constant tau after memory lapse/failure."""
        pass


class ExponentialRetentionModel(BaseRetentionModel):
    """
    Deterministic exponential retention model inspired by cognitive forgetting-curve research.
    Note: Formally treated as an engineering approximation of conceptual decay,
    not biological truth.

    Semantics:
    - tau (\tau): The exponential time constant (days) where R(\tau) = e^{-1} \approx 0.367879.
      Distinct from FSRS card stability (which operates at R(S) = 0.90).
    - Half-life: h = \tau * ln(2) \approx 0.693147 * \tau.
    - Conditional 7-day risk: P(forget next 7d | retained) = 1 - e^{-7 / \tau}.
    """

    def retrievability(self, tau: float, elapsed_days: float) -> float:
        if elapsed_days <= 0.0:
            return 1.0
        safe_tau = max(0.1, tau)
        exponent = - (elapsed_days / safe_tau)
        if exponent < -20.0:
            return 0.00001
        r = math.exp(exponent)
        return max(0.00001, min(1.0, r))

    def half_life(self, tau: float) -> float:
        safe_tau = max(0.1, tau)
        return round(safe_tau * math.log(2.0), 3)

    def conditional_forgetting_risk(self, tau: float, horizon_days: float = 7.0) -> float:
        safe_tau = max(0.1, tau)
        safe_horizon = max(0.0, horizon_days)
        risk = 1.0 - math.exp(- (safe_horizon / safe_tau))
        return max(0.0, min(1.0, risk))

    def projected_retrievability(self, tau: float, elapsed_days: float, horizon_days: float = 7.0) -> float:
        total_days = max(0.0, elapsed_days) + max(0.0, horizon_days)
        return self.retrievability(tau, total_days)

    def update_after_recall(
        self,
        tau: float,
        elapsed_days: float,
        difficulty: float,
        streak: int,
        policy: RetentionPolicy
    ) -> float:
        """
        Shiro Concept Retention Update Heuristic v1 (Recall):
        Incorporates:
        1. Desirable difficulty: Greater stability gain if recalled after decay (1 - R_prior).
        2. Concept intrinsic difficulty: D in [1, 10] scales growth.
        3. Retrieval streak: Logarithmic scaling with repetition count.
        """
        safe_tau = max(policy.minimum_tau_days, min(policy.maximum_tau_days, tau))
        r_prior = self.retrievability(safe_tau, elapsed_days)
        clamped_d = max(1.0, min(10.0, difficulty))
        safe_streak = max(1, streak)

        growth_component = (
            policy.success_growth_factor
            * (1.0 - r_prior)
            * ((policy.difficulty_offset - clamped_d) / policy.difficulty_weight)
            * math.log(1.0 + safe_streak)
        )

        # Baseline expansion guarantee for spaced recall even at high initial retrievability
        growth = max(0.10, growth_component)
        new_tau = safe_tau * (1.0 + growth)
        return round(min(policy.maximum_tau_days, max(policy.minimum_tau_days, new_tau)), 3)

    def update_after_lapse(
        self,
        tau: float,
        elapsed_days: float,
        difficulty: float,
        streak: int,
        policy: RetentionPolicy
    ) -> float:
        """
        Shiro Concept Retention Update Heuristic v1 (Lapse):
        Reduces time constant tau toward baseline recovery floor.
        """
        safe_tau = max(policy.minimum_tau_days, min(policy.maximum_tau_days, tau))
        contracted_tau = safe_tau * policy.lapse_multiplier
        return round(max(policy.minimum_tau_days, contracted_tau), 3)


# =========================================================================
# 3. RETENTION SERVICE (Core Engine & Lifecycle Management)
# =========================================================================

class RetentionService:
    """
    Shiro v3.2: Memory Retention & Spaced Forgetting Curve Predictor (FORGET-01)

    Owns:
    - Concept-level retrievability R(t) and exponential decay time constant (\tau)
    - Conditional 7-day attrition forecasting
    - Multi-factor Retention Decay Radar
    - 30-minute session debouncing to prevent streak inflation
    - Immutable event logging via ConceptRetentionEvent
    - Targeted Memory Booster feeding into ADAPT-01 (CAT)
    """

    def __init__(
        self,
        policy: Optional[RetentionPolicy] = None,
        model: Optional[BaseRetentionModel] = None
    ):
        self.policy = policy or RetentionPolicy()
        self.model = model or ExponentialRetentionModel()

    # Direct helper wrappers
    def calculate_retrievability(self, tau: float, elapsed_days: float) -> float:
        return self.model.retrievability(tau, elapsed_days)

    def calculate_half_life(self, tau: float) -> float:
        return self.model.half_life(tau)

    def calculate_conditional_forgetting_risk(self, tau: float, horizon_days: float = 7.0) -> float:
        return self.model.conditional_forgetting_risk(tau, horizon_days)

    def calculate_projected_retrievability(self, tau: float, elapsed_days: float, horizon_days: float = 7.0) -> float:
        return self.model.projected_retrievability(tau, elapsed_days, horizon_days)

    # -------------------------------------------------------------------------
    # Learning Interaction Processing & State Materialization
    # -------------------------------------------------------------------------

    def process_learning_interaction(
        self,
        user_id: int,
        concept_name: str,
        is_correct: bool,
        interaction_type: str = "quiz",
        source_event_id: Optional[str] = None,
        difficulty: Optional[float] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Processes a learning observation (quiz, CAT, flashcard, or feynman):
        1. Debounces rapid same-session interactions (within 30 mins) to prevent streak inflation.
        2. Applies stability growth or lapse contraction to retention_tau_days.
        3. Appends an immutable ConceptRetentionEvent ledger record.
        4. Updates the materialized LearnerConceptState cache.
        """
        cleaned_concept = concept_name.strip().title()
        now = datetime.utcnow()

        # 1. Fetch or create concept state
        is_new_state = False
        state = db.query(LearnerConceptState).filter(
            LearnerConceptState.user_id == user_id,
            LearnerConceptState.concept_name == cleaned_concept
        ).first()

        if not state:
            is_new_state = True
            state = LearnerConceptState(
                user_id=user_id,
                concept_name=cleaned_concept,
                p_known=0.20,
                retention_tau_days=2.5,
                memory_difficulty=difficulty or 5.0,
                last_interaction_at=now,
                last_reviewed_at=None,
                total_opportunities=0,
                consecutive_correct=0,
                retention_cached=1.0,
                predicted_forgetting_7d_cached=self.calculate_conditional_forgetting_risk(2.5, self.policy.forecast_horizon_days),
                retention_model_version=self.policy.model_version
            )
            db.add(state)
            db.flush()

        tau_before = state.retention_tau_days or 2.5
        concept_diff = difficulty or state.memory_difficulty or 5.0
        last_reviewed = state.last_reviewed_at

        # Calculate elapsed days since last review
        if last_reviewed is not None and not is_new_state:
            elapsed_seconds = max(0.0, (now - last_reviewed).total_seconds())
        else:
            elapsed_seconds = 0.0
        elapsed_days = elapsed_seconds / 86400.0

        retrievability_before = self.model.retrievability(tau_before, elapsed_days)

        # 2. Session Debouncing Check (Anti-Inflation)
        is_debounced = (not is_new_state) and ((state.total_opportunities or 0) > 0 or last_reviewed is not None) and (elapsed_seconds < (self.policy.debounce_window_minutes * 60))

        if is_debounced:
            # Same study session: do not expand streak or aggressively inflate tau
            streak_after = state.consecutive_correct or (1 if is_correct else 0)
            if is_correct:
                tau_after = tau_before # Keep tau stable within rapid repetition window
            else:
                # Still register lapse if student made a mistake in the same session
                tau_after = self.model.update_after_lapse(tau_before, elapsed_days, concept_diff, streak_after, self.policy)
                streak_after = 0
        else:
            # Spaced trial: execute full heuristic updates
            if is_correct:
                streak_after = (state.consecutive_correct or 0) + 1
                tau_after = self.model.update_after_recall(
                    tau_before,
                    elapsed_days,
                    concept_diff,
                    streak_after,
                    self.policy
                )
            else:
                streak_after = 0
                tau_after = self.model.update_after_lapse(
                    tau_before,
                    elapsed_days,
                    concept_diff,
                    streak_after,
                    self.policy
                )

        # 3. Log immutable telemetry event (Event Sourcing)
        retention_event = ConceptRetentionEvent(
            user_id=user_id,
            concept_name=cleaned_concept,
            source_event_id=source_event_id,
            interaction_type=interaction_type,
            is_correct=is_correct,
            elapsed_days=round(elapsed_days, 4),
            retrievability_before=round(retrievability_before, 4),
            tau_before=round(tau_before, 3),
            tau_after=round(tau_after, 3),
            streak_after=streak_after,
            model_version=self.policy.model_version,
            created_at=now
        )
        db.add(retention_event)

        # 4. Update materialized projection cache
        state.retention_tau_days = tau_after
        state.last_reviewed_at = now
        state.last_interaction_at = now
        state.consecutive_correct = streak_after
        # Tested now -> modeled post-review retrievability refreshed to 1.0
        state.retention_cached = 1.0
        state.predicted_forgetting_7d_cached = round(
            self.model.conditional_forgetting_risk(tau_after, self.policy.forecast_horizon_days),
            4
        )
        state.retention_model_version = self.policy.model_version

        db.flush()

        return {
            "concept_name": cleaned_concept,
            "is_debounced": is_debounced,
            "elapsed_days": round(elapsed_days, 3),
            "retrievability_before": round(retrievability_before, 4),
            "retrievability_after": 1.0,
            "tau_before": round(tau_before, 3),
            "tau_after": round(tau_after, 3),
            "half_life_days": self.model.half_life(tau_after),
            "predicted_forgetting_7d": state.predicted_forgetting_7d_cached,
            "streak": streak_after,
            "model_version": self.policy.model_version
        }

    # -------------------------------------------------------------------------
    # Retention Radar & Attrition Forecasting
    # -------------------------------------------------------------------------

    def scan_retention_radar(
        self,
        user_id: int,
        db: Session,
        exam_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Scans all tracked concepts for a student:
        1. Derives dynamic R_now based on elapsed time.
        2. Computes conditional 7-day attrition probability P_forget_7d.
        3. Evaluates multi-factor Urgency Score incorporating retention, exam proximity, and BKT mastery gap.
        4. Sorts concepts descending by Urgency to drive the Retention Radar HUD.
        """
        now = datetime.utcnow()
        states = db.query(LearnerConceptState).filter(
            LearnerConceptState.user_id == user_id
        ).all()

        if not states:
            return {
                "overall_memory_health": 100.0,
                "total_concepts_tracked": 0,
                "resilient_count": 0,
                "decaying_count": 0,
                "critical_count": 0,
                "projected_7d_loss_count": 0,
                "at_risk_concepts": [],
                "all_concepts": []
            }

        exam_urgency_factor = 0.20
        if exam_date:
            days_to_exam = max(0.5, (exam_date - now).total_seconds() / 86400.0)
            # Higher urgency weight if exam is within 14 days
            exam_urgency_factor = min(1.0, 14.0 / days_to_exam)

        concept_analyses = []
        resilient_count = 0
        decaying_count = 0
        critical_count = 0
        projected_loss_count = 0

        for s in states:
            tau = s.retention_tau_days or 2.5
            last_dt = s.last_reviewed_at or s.last_interaction_at or now
            elapsed_days = max(0.0, (now - last_dt).total_seconds() / 86400.0)

            # Instantaneous and conditional metrics
            r_now = self.model.retrievability(tau, elapsed_days)
            p_forget_7d = self.model.conditional_forgetting_risk(tau, self.policy.forecast_horizon_days)
            r_in_7d = self.model.projected_retrievability(tau, elapsed_days, self.policy.forecast_horizon_days)
            hl = self.model.half_life(tau)

            # Status categorization
            if r_now >= self.policy.decaying_retention_threshold:
                category = "resilient" # 🟢
                resilient_count += 1
            elif r_now >= self.policy.critical_retention_threshold:
                category = "decaying" # 🟡
                decaying_count += 1
            else:
                category = "critical" # 🔴
                critical_count += 1

            # Check if concept will fall below threshold in next 7 days
            if r_now >= self.policy.critical_retention_threshold and r_in_7d < self.policy.critical_retention_threshold:
                projected_loss_count += 1

            # Multi-factor Urgency Score
            bkt_gap = max(0.0, 1.0 - (s.p_known or 0.20))
            urgency = (
                0.45 * (1.0 - r_now)
                + 0.30 * p_forget_7d
                + 0.15 * exam_urgency_factor
                + 0.10 * bkt_gap
            )

            # Update cached values on materialized projection
            s.retention_cached = round(r_now, 4)
            s.predicted_forgetting_7d_cached = round(p_forget_7d, 4)

            concept_analyses.append({
                "concept_name": s.concept_name,
                "document_id": s.document_id,
                "retention_now": round(r_now * 100.0, 1),
                "retention_ratio": round(r_now, 4),
                "retention_in_7d": round(r_in_7d * 100.0, 1),
                "predicted_forgetting_7d": round(p_forget_7d * 100.0, 1),
                "predicted_forgetting_7d_ratio": round(p_forget_7d, 4),
                "time_constant_days": round(tau, 2),
                "half_life_days": hl,
                "elapsed_days": round(elapsed_days, 2),
                "category": category,
                "urgency_score": round(urgency, 4),
                "bkt_p_known": round(s.p_known or 0.20, 3),
                "streak": s.consecutive_correct or 0,
                "last_reviewed_at": last_dt.isoformat()
            })

        # Sort descending by urgency score
        concept_analyses.sort(key=lambda x: x["urgency_score"], reverse=True)

        avg_health = sum(c["retention_ratio"] for c in concept_analyses) / len(concept_analyses)
        at_risk = [c for c in concept_analyses if c["category"] in ["critical", "decaying"]]

        return {
            "overall_memory_health": round(avg_health * 100.0, 1),
            "total_concepts_tracked": len(states),
            "resilient_count": resilient_count,
            "decaying_count": decaying_count,
            "critical_count": critical_count,
            "projected_7d_loss_count": projected_loss_count,
            "at_risk_concepts": at_risk,
            "all_concepts": concept_analyses
        }

    # -------------------------------------------------------------------------
    # 4. ADAPT-01 INTEGRATION (Memory Booster CAT Session)
    # -------------------------------------------------------------------------

    async def create_memory_booster_session(
        self,
        user_id: int,
        db: Session,
        max_concepts: int = 4
    ) -> Dict[str, Any]:
        """
        Connects FORGET-01 directly into ADAPT-01 (CAT Engine):
        1. Scans the retention radar for highest-urgency decaying/critical concepts.
        2. Spawns an adaptive assessment drill focused on recovering these concepts.
        3. Provides the client with an immediate session ready to launch.
        """
        from services.adaptive_quiz_service import AdaptiveQuizService

        radar = self.scan_retention_radar(user_id, db)
        at_risk = radar["at_risk_concepts"]

        if not at_risk:
            # If all are resilient, select lowest retention concepts
            target_concepts = [c["concept_name"] for c in radar["all_concepts"][:max_concepts]]
        else:
            target_concepts = [c["concept_name"] for c in at_risk[:max_concepts]]

        if not target_concepts:
            target_concepts = ["General Mastery"]

        topic_label = f"Retention Booster: {', '.join(target_concepts[:2])}"
        if len(target_concepts) > 2:
            topic_label += f" +{len(target_concepts) - 2} more"

        # Find relevant document if available
        primary_doc_id = None
        for c in (at_risk or radar["all_concepts"]):
            if c.get("document_id"):
                primary_doc_id = c["document_id"]
                break

        adaptive_service = AdaptiveQuizService()
        session_data = await adaptive_service.start_adaptive_session(
            user_id=user_id,
            document_id=primary_doc_id,
            topic=topic_label,
            num_questions=min(8, max(4, len(target_concepts) * 2)),
            db=db
        )

        return {
            "booster_type": "adaptive_cat",
            "target_concepts": target_concepts,
            "topic": topic_label,
            "session": session_data,
            "urgent_concept_count": len(at_risk)
        }


# Global singleton instance for service injection
retention_service = RetentionService()
