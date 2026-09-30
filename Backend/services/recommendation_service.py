import math
import uuid
import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple, Set

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import desc

from models.database import (
    User,
    Document,
    LearnerConceptState,
    AdaptiveQuizSession,
    AdaptiveQuizItem,
    FlashcardProgress,
    KnowledgeNode,
    KnowledgeEdge,
    StudyTimetable,
    StudyPathwayPlan,
    StudyPathwayTelemetryLog
)

logger = logging.getLogger(__name__)


# =========================================================================
# 1. CONFIGURATION & ACTION EFFECTIVENESS PROFILES
# =========================================================================

@dataclass
class ActionProfile:
    """
    Action-specific cognitive effectiveness profile:
    Models expected marginal gains for retention, latent mastery, and Rasch ability.
    """
    tool: str # "flashcards", "adaptive_cat", "feynman", "summary_notes", "continue_current_task"
    min_minutes: int
    max_minutes: int
    default_minutes: int
    phase: str # "warmup", "core", "consolidation"
    delta_retention_efficiency: float # Expected retention gain scalar
    delta_mastery_efficiency: float   # Expected BKT transition scalar
    delta_theta_efficiency: float     # Expected Rasch ability calibration scalar


ACTION_PROFILES: Dict[str, ActionProfile] = {
    "flashcards": ActionProfile(
        tool="flashcards",
        min_minutes=5,
        max_minutes=15,
        default_minutes=8,
        phase="warmup",
        delta_retention_efficiency=0.85, # High immediate retrieval restoration
        delta_mastery_efficiency=0.15,   # Moderate conceptual depth
        delta_theta_efficiency=0.05
    ),
    "adaptive_cat": ActionProfile(
        tool="adaptive_cat",
        min_minutes=10,
        max_minutes=25,
        default_minutes=15,
        phase="core",
        delta_retention_efficiency=0.65,
        delta_mastery_efficiency=0.55,   # High targeted knowledge transition
        delta_theta_efficiency=0.40      # High ability calibration gain
    ),
    "feynman": ActionProfile(
        tool="feynman",
        min_minutes=10,
        max_minutes=20,
        default_minutes=12,
        phase="core",
        delta_retention_efficiency=0.40,
        delta_mastery_efficiency=0.75,   # Deep conceptual synthesis & gap repair
        delta_theta_efficiency=0.10
    ),
    "summary_notes": ActionProfile(
        tool="summary_notes",
        min_minutes=5,
        max_minutes=15,
        default_minutes=7,
        phase="consolidation",
        delta_retention_efficiency=0.35,
        delta_mastery_efficiency=0.20,
        delta_theta_efficiency=0.02
    ),
    "continue_current_task": ActionProfile(
        tool="continue_current_task",
        min_minutes=5,
        max_minutes=20,
        default_minutes=10,
        phase="core",
        delta_retention_efficiency=0.50,
        delta_mastery_efficiency=0.50,
        delta_theta_efficiency=0.15
    )
}


@dataclass
class ModeWeights:
    alpha_retention: float
    beta_mastery: float
    gamma_theta: float
    lambda_prerequisite: float


MODE_WEIGHTS: Dict[str, ModeWeights] = {
    "balanced": ModeWeights(0.35, 0.40, 0.25, 0.20),
    "retention_rescue": ModeWeights(0.60, 0.20, 0.20, 0.15),
    "mastery_sprint": ModeWeights(0.20, 0.60, 0.20, 0.30),
    "exam_cram": ModeWeights(0.35, 0.35, 0.30, 0.25)
}


# =========================================================================
# 2. READ-ONLY LEARNER STATE SNAPSHOT
# =========================================================================

class LearnerStateSnapshot:
    """
    Guaranteed read-only point-in-time snapshot of the student's cognitive state.
    Consumes from BKT, FORGET-01, ADAPT-01, FSRS, and Knowledge Graph.
    Never mutates authoritative database tables.
    """

    def __init__(self, user_id: int, db: Session, exam_date: Optional[datetime] = None):
        self.user_id = user_id
        self.now = datetime.utcnow()
        self.exam_date = exam_date

        # 1. Fetch BKT & FORGET-01 concept states
        self.concept_states: List[Dict[str, Any]] = []
        raw_states = db.query(LearnerConceptState).filter(
            LearnerConceptState.user_id == user_id
        ).all()

        for s in raw_states:
            tau = s.retention_tau_days or 2.5
            last_dt = s.last_reviewed_at or s.last_interaction_at or self.now
            elapsed_days = max(0.0, (self.now - last_dt).total_seconds() / 86400.0)

            # Pure mathematical derivation (read-only)
            safe_tau = max(0.1, tau)
            r_now = math.exp(- (elapsed_days / safe_tau)) if elapsed_days > 0 else 1.0
            r_now = max(0.001, min(1.0, r_now))
            p_forget_7d = max(0.0, min(1.0, 1.0 - math.exp(- (7.0 / safe_tau))))

            self.concept_states.append({
                "concept_name": s.concept_name,
                "document_id": s.document_id,
                "p_known": round(s.p_known or 0.20, 4),
                "p_learn": round(s.p_learn or 0.15, 4),
                "retention_now": round(r_now, 4),
                "retention_tau_days": round(tau, 2),
                "predicted_forgetting_7d": round(p_forget_7d, 4),
                "streak": s.consecutive_correct or 0,
                "total_opportunities": s.total_opportunities or 0,
                "mastered": bool(s.mastered or (s.p_known or 0.20) >= 0.85)
            })

        # 2. Fetch latent Rasch ability \theta from latest adaptive assessment
        latest_session = db.query(AdaptiveQuizSession).filter(
            AdaptiveQuizSession.user_id == user_id
        ).order_by(desc(AdaptiveQuizSession.created_at)).first()

        if latest_session:
            self.theta_estimate = float(latest_session.theta_estimate)
            self.theta_se = float(latest_session.standard_error)
        else:
            # Seed initial ability approximation from average BKT
            if self.concept_states:
                avg_p = sum(c["p_known"] for c in self.concept_states) / len(self.concept_states)
                bounded_p = max(0.10, min(0.90, avg_p))
                self.theta_estimate = round(math.log(bounded_p / (1.0 - bounded_p)), 2)
            else:
                self.theta_estimate = 0.0
            self.theta_se = 1.0

        # 3. Fetch pending FSRS cards
        self.pending_flashcards_count = db.query(FlashcardProgress).filter(
            FlashcardProgress.user_id == user_id,
            FlashcardProgress.next_review <= (self.now + timedelta(days=1))
        ).count()

        # 4. Fetch Knowledge Graph prerequisite edges
        self.prerequisite_edges: List[Dict[str, str]] = []
        try:
            nodes = db.query(KnowledgeNode).all()
            node_map = {n.id: n.label for n in nodes if n.label}
            edges = db.query(KnowledgeEdge).filter(
                KnowledgeEdge.relation.in_(["prerequisite", "depends_on", "requires", "leads_to"])
            ).all()
            for e in edges:
                src_label = node_map.get(e.source_node_id)
                tgt_label = node_map.get(e.target_node_id)
                if src_label and tgt_label:
                    self.prerequisite_edges.append({
                        "source_label": src_label,
                        "target_label": tgt_label,
                        "relation": e.relation
                    })
        except Exception as err:
            logger.warning(f"Could not load knowledge graph prerequisite edges: {err}")

        # 5. Determine exam deadline if not passed
        if not self.exam_date:
            active_tt = db.query(StudyTimetable).filter(
                StudyTimetable.user_id == user_id,
                StudyTimetable.exam_date > self.now
            ).order_by(desc(StudyTimetable.created_at)).first()
            if active_tt:
                self.exam_date = active_tt.exam_date

        # Compute unique snapshot hash for auditability
        hash_input = f"{user_id}:{len(self.concept_states)}:{self.theta_estimate}:{self.pending_flashcards_count}"
        self.snapshot_id = hashlib.md5(hash_input.encode()).hexdigest()[:12]


# =========================================================================
# 3. KNOWLEDGE GRAPH PREREQUISITE ANALYZER
# =========================================================================

class PrerequisiteAnalyzer:
    r"""
    Evaluates topological prerequisite dependencies.
    A concept receives bonus utility \lambda G(c) if mastering it unlocks
    unmastered downstream descendants.
    """

    @classmethod
    def calculate_descendant_gap(cls, concept_name: str, snapshot: LearnerStateSnapshot) -> float:
        cleaned = concept_name.strip().title()
        concept_map = {c["concept_name"].lower(): c for c in snapshot.concept_states}

        # Find direct and indirect downstream concepts
        descendants: Set[str] = set()
        for edge in snapshot.prerequisite_edges:
            src = edge.get("source_label") if isinstance(edge, dict) else getattr(edge, "source_label", None)
            tgt = edge.get("target_label") if isinstance(edge, dict) else getattr(edge, "target_label", None)
            if src and src.strip().title() == cleaned and tgt:
                descendants.add(tgt.strip().title())

        if not descendants:
            return 0.0

        total_gap = 0.0
        for d in descendants:
            d_state = concept_map.get(d.lower())
            if d_state:
                total_gap += (1.0 - d_state["p_known"])
            else:
                total_gap += 0.80 # Assume unlearned if untracked

        return round(total_gap / max(1, len(descendants)), 4)


# =========================================================================
# 4. UTILITY & ROI SCORER
# =========================================================================

class UtilityScorer:
    """
    Computes action-specific marginal educational gain and ROI per minute:
    ROI(c, a, t) = ExpectedGain(c, a, t) / t
    """

    @classmethod
    def calculate_exam_urgency(cls, concept_state: Dict[str, Any], exam_date: Optional[datetime], now: datetime) -> float:
        """
        Multi-factor exam urgency:
        Days remaining alone does not determine priority. Mastered concepts (P(L) >= 0.90)
        do not receive an unearned urgency boost even right before an exam.
        """
        if not exam_date:
            return 1.0

        days_remaining = max(0.5, (exam_date - now).total_seconds() / 86400.0)
        deadline_weight = min(2.5, 14.0 / days_remaining)

        p_known = concept_state.get("p_known", 0.20)
        p_forget = concept_state.get("predicted_forgetting_7d", 0.20)

        # Knowledge gap and retention risk scale the urgency
        gap_factor = max(0.05, 1.0 - p_known)
        risk_factor = max(0.10, p_forget)

        urgency = 1.0 + (deadline_weight * gap_factor * risk_factor)
        return round(min(3.5, urgency), 3)

    @classmethod
    def score_candidate(
        cls,
        concept: Dict[str, Any],
        action: ActionProfile,
        duration_minutes: int,
        snapshot: LearnerStateSnapshot,
        mode: str = "balanced"
    ) -> Dict[str, Any]:
        weights = MODE_WEIGHTS.get(mode, MODE_WEIGHTS["balanced"])

        p_known = concept["p_known"]
        r_now = concept["retention_now"]
        p_forget = concept["predicted_forgetting_7d"]

        # 1. Action-Specific Expected Retention Gain
        delta_r = (1.0 - r_now) * action.delta_retention_efficiency

        # 2. Action-Specific Expected Mastery Gain
        delta_l = (1.0 - p_known) * action.delta_mastery_efficiency

        # 3. ZPD Ability Alignment Gain (1PL Rasch Fisher Information approximation)
        # Closer student theta is to calibrated challenge, the greater the ability gain
        item_diff = 0.0 # Standard calibration baseline
        theta_diff = abs(snapshot.theta_estimate - item_diff)
        zpd_fit = max(0.10, 1.0 - (theta_diff / 4.0))
        delta_theta = zpd_fit * action.delta_theta_efficiency

        # 4. Prerequisite Dependency Value
        prereq_gap = PrerequisiteAnalyzer.calculate_descendant_gap(concept["concept_name"], snapshot)

        # 5. Comprehensive Exam Urgency Multiplier
        w_exam = cls.calculate_exam_urgency(concept, snapshot.exam_date, snapshot.now)

        # Base composite utility
        composite_gain = (
            (weights.alpha_retention * delta_r)
            + (weights.beta_mastery * delta_l)
            + (weights.gamma_theta * delta_theta)
            + (weights.lambda_prerequisite * prereq_gap)
        )

        total_utility = composite_gain * w_exam

        # Educational Return on Investment per minute
        safe_duration = max(1, duration_minutes)
        roi = total_utility / safe_duration

        return {
            "concept_name": concept["concept_name"],
            "document_id": concept.get("document_id"),
            "tool": action.tool,
            "phase": action.phase,
            "duration_minutes": safe_duration,
            "utility_score": round(total_utility, 4),
            "expected_gain": round(composite_gain, 4),
            "roi_score": round(roi, 5),
            "priority_components": {
                "delta_retention": round(delta_r, 3),
                "delta_mastery": round(delta_l, 3),
                "delta_theta": round(delta_theta, 3),
                "prerequisite_gap": round(prereq_gap, 3),
                "exam_urgency": round(w_exam, 3),
                "retention_now": round(r_now * 100, 1),
                "p_known": round(p_known * 100, 1)
            }
        }


# =========================================================================
# 5. CONSTRAINED SEQUENCE OPTIMIZER (Beam Search)
# =========================================================================

class SequenceOptimizer:
    """
    Constrained Sequence Optimizer using Pruned Beam Search.
    Maximizes total educational utility and ROI subject to:
    - Exact Time Budget: sum(t_u) <= T_budget
    - Cognitive Pacing: Phase 1 (Warmup) -> Phase 2 (Core Focus) -> Phase 3 (Consolidation)
    - Modality Diversity: Soft penalty on 3+ consecutive identical study tools
    - Concept Redundancy: Prevents redundant repetitions of same concept within session
    """

    BEAM_WIDTH = 8

    @classmethod
    def optimize_pathway(
        cls,
        snapshot: LearnerStateSnapshot,
        target_minutes: int,
        mode: str = "balanced"
    ) -> List[Dict[str, Any]]:
        # Fallback if student has zero tracked concepts
        if not snapshot.concept_states:
            return cls._generate_onboarding_pathway(target_minutes)

        # 1. Candidate Generation (Concept x Action x Viable Durations)
        candidates: List[Dict[str, Any]] = []

        # Sort concepts by risk-adjusted opportunity
        sorted_concepts = sorted(
            snapshot.concept_states,
            key=lambda c: (1.0 - c["retention_now"]) * 0.45 + (1.0 - c["p_known"]) * 0.55,
            reverse=True
        )

        for concept in sorted_concepts[:6]: # Focus on top 6 priority concepts
            for action_key, profile in ACTION_PROFILES.items():
                if action_key == "continue_current_task":
                    continue # Selected only under active context continuity

                # Determine feasible duration within action min/max
                duration = profile.default_minutes
                if target_minutes <= 15:
                    duration = profile.min_minutes
                elif target_minutes >= 60:
                    duration = min(profile.max_minutes, profile.default_minutes + 5)

                if duration > target_minutes:
                    continue

                scored = UtilityScorer.score_candidate(concept, profile, duration, snapshot, mode)
                candidates.append(scored)

        # Sort candidates descending by ROI
        candidates.sort(key=lambda x: x["roi_score"], reverse=True)

        # 2. Beam Search over feasible sequences
        # Each beam state: (sequence_list, total_duration, total_utility, current_phase_idx, used_concepts)
        initial_beam = [([], 0, 0.0, 0, set())]
        phase_order = ["warmup", "core", "consolidation"]

        max_steps = 2 if target_minutes <= 15 else 5
        for _ in range(max_steps):
            new_beam = []
            for seq, total_dur, total_util, phase_idx, used_concepts in initial_beam:
                for cand in candidates:
                    dur = cand["duration_minutes"]
                    if total_dur + dur > target_minutes:
                        continue

                    concept_name = cand["concept_name"]
                    # Disallow consecutive identical tool and concept
                    if seq and seq[-1]["concept_name"] == concept_name and seq[-1]["tool"] == cand["tool"]:
                        continue

                    # Limit concept to max 2 appearances in single session
                    concept_count = sum(1 for s in seq if s["concept_name"] == concept_name)
                    if concept_count >= 2:
                        continue

                    cand_phase_idx = phase_order.index(cand["phase"]) if cand["phase"] in phase_order else 1
                    # Enforce loose forward progression (Warmup -> Core -> Consolidation)
                    if cand_phase_idx < phase_idx:
                        continue

                    # Soft modality diversity penalty (consecutive same tool)
                    diversity_multiplier = 1.0
                    if len(seq) >= 2 and seq[-1]["tool"] == cand["tool"] and seq[-2]["tool"] == cand["tool"]:
                        diversity_multiplier = 0.65

                    new_util = total_util + (cand["utility_score"] * diversity_multiplier)
                    new_seq = seq + [cand]
                    new_concepts = used_concepts | {concept_name}

                    new_beam.append((
                        new_seq,
                        total_dur + dur,
                        new_util,
                        max(phase_idx, cand_phase_idx),
                        new_concepts
                    ))

            if not new_beam:
                break

            # Prune to top-K highest utility states
            new_beam.sort(key=lambda state: state[2], reverse=True)
            initial_beam = new_beam[:cls.BEAM_WIDTH]

        best_sequence = initial_beam[0][0] if initial_beam and initial_beam[0][0] else []

        # Fallback if beam search found no sequence (e.g. strict constraints on short budget)
        if not best_sequence and candidates:
            # Pick top candidate that fits in time
            for c in candidates:
                if c["duration_minutes"] <= target_minutes:
                    best_sequence = [c]
                    break

        return cls._finalize_pathway_items(best_sequence)

    @classmethod
    def _finalize_pathway_items(cls, sequence: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        final_items = []
        for idx, item in enumerate(sequence):
            step_id = str(uuid.uuid4())[:8]
            tool = item["tool"]
            concept = item["concept_name"]
            doc_id = item.get("document_id")

            # Construct concrete 1-click executable payload
            if tool == "adaptive_cat":
                payload = {
                    "tool": "adaptive_cat",
                    "mode": "adaptive",
                    "topic": concept,
                    "document_id": doc_id,
                    "num_questions": max(4, min(10, item["duration_minutes"] // 2))
                }
                title = f"Adaptive CAT Diagnostic: {concept}"
            elif tool == "flashcards":
                payload = {
                    "tool": "flashcards",
                    "mode": "review",
                    "topic": concept,
                    "document_id": doc_id
                }
                title = f"Spaced Retrieval Warmup: {concept}"
            elif tool == "feynman":
                payload = {
                    "tool": "feynman",
                    "mode": "elaboration",
                    "topic": concept,
                    "document_id": doc_id
                }
                title = f"Feynman Gap Check: {concept}"
            else:
                payload = {
                    "tool": "summary_notes",
                    "mode": "consolidation",
                    "topic": concept,
                    "document_id": doc_id
                }
                title = f"Core Summary Synthesis: {concept}"

            p_comp = item["priority_components"]
            rationale = (
                f"Targeting {concept} in {item['phase'].upper()} phase: "
                f"Current retention is {p_comp['retention_now']}% with {p_comp['p_known']}% BKT mastery. "
                f"Expected gain: +{int(item['expected_gain'] * 100)}% ROI."
            )

            final_items.append({
                "step_id": step_id,
                "step_index": idx,
                "title": title,
                "concept_name": concept,
                "tool": tool,
                "phase": item["phase"],
                "duration_minutes": item["duration_minutes"],
                "duration_seconds": item["duration_minutes"] * 60,
                "utility_score": item["utility_score"],
                "expected_gain": item["expected_gain"],
                "roi_score": item["roi_score"],
                "priority_components": p_comp,
                "payload": payload,
                "rationale": rationale,
                "status": "pending",
                "model_versions": {
                    "bkt": "KT-01-v2",
                    "forget": "FORGET-01-v1",
                    "adapt": "ADAPT-01-v1",
                    "rec": "REC-01-v2"
                }
            })

        return final_items

    @classmethod
    def _generate_onboarding_pathway(cls, target_minutes: int) -> List[Dict[str, Any]]:
        """Graceful fallback for new learners with zero recorded concept state"""
        items = [
            {
                "step_id": str(uuid.uuid4())[:8],
                "step_index": 0,
                "title": "Initial Adaptive Baseline Assessment",
                "concept_name": "General Diagnostic",
                "tool": "adaptive_cat",
                "phase": "core",
                "duration_minutes": min(15, target_minutes),
                "duration_seconds": min(15, target_minutes) * 60,
                "utility_score": 0.85,
                "expected_gain": 0.40,
                "roi_score": 0.056,
                "priority_components": {
                    "retention_now": 100.0,
                    "p_known": 20.0,
                    "exam_urgency": 1.0
                },
                "payload": {
                    "tool": "adaptive_cat",
                    "mode": "adaptive",
                    "topic": "General Diagnostic",
                    "num_questions": 6
                },
                "rationale": "Calibrates initial Rasch ability and establishes Bayesian Knowledge Tracing priors.",
                "status": "pending",
                "model_versions": {"rec": "REC-01-v2"}
            }
        ]

        if target_minutes >= 30:
            items.append({
                "step_id": str(uuid.uuid4())[:8],
                "step_index": 1,
                "title": "Active Flashcard Recall Session",
                "concept_name": "Core Principles",
                "tool": "flashcards",
                "phase": "consolidation",
                "duration_minutes": 10,
                "duration_seconds": 600,
                "utility_score": 0.60,
                "expected_gain": 0.25,
                "roi_score": 0.025,
                "priority_components": {
                    "retention_now": 100.0,
                    "p_known": 30.0,
                    "exam_urgency": 1.0
                },
                "payload": {
                    "tool": "flashcards",
                    "mode": "review"
                },
                "rationale": "Initializes FSRS stability and active recall memory baselines.",
                "status": "pending",
                "model_versions": {"rec": "REC-01-v2"}
            })

        return items


# =========================================================================
# 6. RECOMMENDATION SERVICE (Lifecycle, Replanning, Stability)
# =========================================================================

class RecommendationService:
    """
    Shiro v3.3: Multi-Constraint Study Pathway & Recommendation Engine (REC-01)

    Owns:
    - Generation of utility-maximizing study pathways
    - Recommendation stability / hysteresis (no flickering on refresh)
    - Adaptive replanning when learner evidence changes post-activity
    - Recommendation-to-outcome telemetry ledger
    """

    EXPIRATION_HOURS = 12

    def get_or_create_pathway(
        self,
        user_id: int,
        duration_minutes: int = 30,
        mode: str = "balanced",
        force_refresh: bool = False,
        exam_date: Optional[datetime] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Fetches existing active pathway or optimizes a new one.
        Hysteresis: Preserves existing active pathway within expiration window
        unless force_refresh is explicitly requested or pathway is finished.
        """
        now = datetime.utcnow()

        if not force_refresh:
            active_plan = db.query(StudyPathwayPlan).filter(
                StudyPathwayPlan.user_id == user_id,
                StudyPathwayPlan.is_active == True,
                StudyPathwayPlan.target_duration_minutes == duration_minutes,
                StudyPathwayPlan.session_mode == mode,
                StudyPathwayPlan.created_at >= (now - timedelta(hours=self.EXPIRATION_HOURS))
            ).first()

            if active_plan:
                return self._serialize_plan(active_plan)

        # Generate fresh pathway
        snapshot = LearnerStateSnapshot(user_id=user_id, db=db, exam_date=exam_date)
        items = SequenceOptimizer.optimize_pathway(snapshot, duration_minutes, mode)

        total_util = sum(it.get("utility_score", 0.0) for it in items)
        total_roi = sum(it.get("roi_score", 0.0) for it in items)

        # Deactivate any previous active plans for this user
        db.query(StudyPathwayPlan).filter(
            StudyPathwayPlan.user_id == user_id,
            StudyPathwayPlan.is_active == True
        ).update({"is_active": False})

        plan_id = str(uuid.uuid4())
        new_plan = StudyPathwayPlan(
            id=plan_id,
            user_id=user_id,
            target_duration_minutes=duration_minutes,
            session_mode=mode,
            algorithm_version="REC-01-v2",
            learner_state_snapshot_id=snapshot.snapshot_id,
            total_utility_score=round(total_util, 3),
            total_roi_score=round(total_roi, 4),
            items=items,
            is_active=True,
            current_step_index=0,
            completed_step_count=0,
            created_at=now
        )
        db.add(new_plan)
        db.commit()
        db.refresh(new_plan)

        return self._serialize_plan(new_plan)

    def complete_step(
        self,
        user_id: int,
        pathway_id: str,
        step_id: str,
        duration_seconds: int = 0,
        client_step_id: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Completes a step in the active pathway:
        1. Checks idempotency (prevents double logging).
        2. Logs outcome telemetry.
        3. Advances current_step_index.
        4. Triggers Adaptive Replanning if remaining steps can be further optimized.
        """
        plan = db.query(StudyPathwayPlan).filter(
            StudyPathwayPlan.id == pathway_id,
            StudyPathwayPlan.user_id == user_id
        ).first()

        if not plan:
            raise ValueError("Pathway not found or unauthorized.")

        items = list(plan.items or [])
        target_step = None
        target_idx = -1
        for idx, it in enumerate(items):
            if it.get("step_id") == step_id:
                target_step = it
                target_idx = idx
                break

        if not target_step:
            raise ValueError(f"Step '{step_id}' not found in pathway.")

        # Idempotency check: verify if step was already completed
        if client_step_id:
            existing_log = db.query(StudyPathwayTelemetryLog).filter(
                StudyPathwayTelemetryLog.client_step_id == client_step_id
            ).first()
            if existing_log:
                return self._serialize_plan(plan)

        # Mark step completed
        target_step["status"] = "completed"
        items[target_idx] = target_step
        plan.items = items
        flag_modified(plan, "items")
        plan.completed_step_count = (plan.completed_step_count or 0) + 1
        plan.current_step_index = min(len(items), target_idx + 1)

        # Read post-activity state to measure recommendation-to-outcome gain
        concept_name = target_step["concept_name"]
        concept_state = db.query(LearnerConceptState).filter(
            LearnerConceptState.user_id == user_id,
            LearnerConceptState.concept_name == concept_name
        ).first()

        post_p = concept_state.p_known if concept_state else None
        post_r = concept_state.retention_cached if concept_state else None
        pre_p = target_step.get("priority_components", {}).get("p_known", 20.0) / 100.0

        actual_gain = round((post_p - pre_p), 4) if post_p is not None else None

        # Record rich telemetry log
        telemetry = StudyPathwayTelemetryLog(
            pathway_id=pathway_id,
            user_id=user_id,
            step_id=step_id,
            step_index=target_idx,
            tool=target_step["tool"],
            concept_name=concept_name,
            planned_duration_seconds=target_step["duration_seconds"],
            actual_duration_seconds=duration_seconds or target_step["duration_seconds"],
            completion_status="completed",
            expected_gain=target_step.get("expected_gain", 0.0),
            pre_state_p_known=pre_p,
            post_state_p_known=post_p,
            pre_state_retention=target_step.get("priority_components", {}).get("retention_now", 100.0) / 100.0,
            post_state_retention=post_r,
            actual_gain=actual_gain,
            client_step_id=client_step_id or str(uuid.uuid4()),
            created_at=datetime.utcnow()
        )
        db.add(telemetry)

        # Check if all steps completed
        if plan.completed_step_count >= len(items):
            plan.is_active = False
            plan.completed_at = datetime.utcnow()
        else:
            # Adaptive Replanning Check:
            # If the student unexpectedly reached mastery or had a major gain on this step,
            # re-evaluate the remaining downstream steps
            self._replan_remaining_steps(plan, target_idx, user_id, db)

        db.commit()
        db.refresh(plan)
        return self._serialize_plan(plan)

    def skip_step(
        self,
        user_id: int,
        pathway_id: str,
        step_id: str,
        db: Session = None
    ) -> Dict[str, Any]:
        """Skips a step and advances current_step_index"""
        plan = db.query(StudyPathwayPlan).filter(
            StudyPathwayPlan.id == pathway_id,
            StudyPathwayPlan.user_id == user_id
        ).first()

        if not plan:
            raise ValueError("Pathway not found.")

        items = list(plan.items or [])
        for idx, it in enumerate(items):
            if it.get("step_id") == step_id:
                it["status"] = "skipped"
                items[idx] = it
                plan.current_step_index = min(len(items), idx + 1)
                break

        plan.items = items
        flag_modified(plan, "items")
        db.commit()
        db.refresh(plan)
        return self._serialize_plan(plan)

    def _replan_remaining_steps(self, plan: StudyPathwayPlan, completed_idx: int, user_id: int, db: Session):
        """
        Adaptive Replanning:
        If remaining steps exist, re-scores them against updated learner evidence.
        """
        items = list(plan.items or [])
        remaining_indices = [i for i in range(completed_idx + 1, len(items))]
        if not remaining_indices:
            return

        snapshot = LearnerStateSnapshot(user_id=user_id, db=db)
        concept_map = {c["concept_name"].strip().lower(): c for c in snapshot.concept_states}

        for i in remaining_indices:
            step = items[i]
            c_name = step["concept_name"]
            c_state = concept_map.get(c_name.strip().lower())
            if c_state and c_state.get("mastered"):
                # Concept was mastered during session! Pivot step to deeper elaboration or new gap
                step["title"] = f"Advanced Challenge & Synthesis: {c_name}"
                step["phase"] = "consolidation"
                items[i] = step

        plan.items = items
        flag_modified(plan, "items")

    def get_quick_decision(self, user_id: int, db: Session) -> Dict[str, Any]:
        """
        Fast endpoint feeding the hero decision card:
        Returns the top immediate action with concise educational reasoning.
        """
        pathway_data = self.get_or_create_pathway(
            user_id=user_id,
            duration_minutes=30,
            mode="balanced",
            db=db
        )

        items = pathway_data.get("items", [])
        active_step = None
        for it in items:
            if it.get("status") == "pending":
                active_step = it
                break

        if not active_step and items:
            active_step = items[0]

        return {
            "pathway_id": pathway_data.get("id"),
            "target_duration_minutes": pathway_data.get("target_duration_minutes"),
            "session_mode": pathway_data.get("session_mode"),
            "total_steps": len(items),
            "completed_steps": pathway_data.get("completed_step_count", 0),
            "next_action": active_step,
            "overall_roi": pathway_data.get("total_roi_score"),
            "all_steps": items
        }

    def _serialize_plan(self, plan: StudyPathwayPlan) -> Dict[str, Any]:
        return {
            "id": plan.id,
            "user_id": plan.user_id,
            "target_duration_minutes": plan.target_duration_minutes,
            "session_mode": plan.session_mode,
            "algorithm_version": plan.algorithm_version,
            "total_utility_score": plan.total_utility_score,
            "total_roi_score": plan.total_roi_score,
            "is_active": plan.is_active,
            "current_step_index": plan.current_step_index,
            "completed_step_count": plan.completed_step_count,
            "items": plan.items or [],
            "created_at": plan.created_at.isoformat() if plan.created_at else None,
            "completed_at": plan.completed_at.isoformat() if plan.completed_at else None
        }


# Singleton service instance
recommendation_service = RecommendationService()
