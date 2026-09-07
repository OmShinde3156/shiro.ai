import math
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Set

from sqlalchemy.orm import Session
from models.database import (
    AdaptiveQuizItem,
    AdaptiveQuizSession,
    AdaptiveQuizResponse,
    Document,
    User,
    LearnerConceptState
)
from utils.llm_client import LLMClient
from utils.quality_gate import QualityGate
from services.knowledge_tracing_service import knowledge_tracing_service

logger = logging.getLogger(__name__)


class AdaptiveQuizService:
    """
    Shiro v3.1: Adaptive Assessment Engine (ADAPT-01)
    
    Scientifically grounded Computerized Adaptive Testing (CAT) implementation based on:
    1. 1PL Rasch Model for response probabilities & Fisher information
    2. Bayesian Maximum A Posteriori (MAP) ability estimation (\theta \in [-3.0, +3.0])
    3. Multi-factor Zone of Proximal Development (ZPD) item selection (P* in [0.65, 0.80])
    4. Content balancing & anti-clustering constraints (max 2 consecutive on same concept)
    5. Empirical item calibration with credibility-weighted Bayesian updates
    6. Dynamic stopping criteria (SE < 0.35, min 4 questions, max 10 questions)
    7. Closed-loop synchronization with Bayesian Knowledge Tracing (KT-01)
    """

    THETA_MIN = -3.0
    THETA_MAX = 3.0
    B_MIN = -3.0
    B_MAX = 3.0
    ZPD_P_MIN = 0.65
    ZPD_P_MAX = 0.80
    CONVERGENCE_SE = 0.35
    DEFAULT_MIN_QUESTIONS = 4
    DEFAULT_MAX_QUESTIONS = 10
    MAX_CONSECUTIVE_CONCEPT = 2

    def __init__(self):
        self.llm_client = LLMClient()

    # =========================================================================
    # 1. PSYCHOMETRIC & MATHEMATICAL KERNEL (1PL Rasch Model)
    # =========================================================================

    @staticmethod
    def calculate_rasch_probability(theta: float, b: float) -> float:
        """
        1PL Rasch response probability:
        P(X=1 | \theta, b) = 1 / (1 + exp(-(\theta - b)))
        """
        z = theta - b
        # Bounded to prevent numerical underflow/overflow
        if z > 15.0:
            return 0.99999
        if z < -15.0:
            return 0.00001
        return 1.0 / (1.0 + math.exp(-z))

    @classmethod
    def calculate_fisher_information(cls, theta: float, b: float) -> float:
        """
        Fisher Information for 1PL Rasch Model:
        I(\theta, b) = P \cdot (1 - P)
        Maximum at \theta = b (I = 0.25).
        """
        p = cls.calculate_rasch_probability(theta, b)
        return p * (1.0 - p)

    @classmethod
    def estimate_theta_map(
        cls,
        responses: List[Dict[str, Any]],
        prior_mu: float = 0.0,
        prior_sigma: float = 1.0,
        max_iterations: int = 25,
        tolerance: float = 0.001
    ) -> Tuple[float, float]:
        """
        Bayesian Maximum A Posteriori (MAP) ability estimation using Newton-Raphson:
        \log P(\theta | u) = \sum [u_i \log P_i + (1-u_i)\log(1-P_i)] - (\theta - \mu)^2 / (2\sigma^2)
        
        Score function: S(\theta) = \sum (u_i - P_i(\theta)) - (\theta - \mu) / \sigma^2
        Information:    J(\theta) = \sum P_i(1 - P_i) + 1 / \sigma^2
        Step:           \Delta \theta = S(\theta) / J(\theta)
        
        Returns:
            (theta_estimate, standard_error)
        """
        if not responses:
            return round(prior_mu, 4), round(prior_sigma, 4)

        theta = float(prior_mu)
        prior_var = max(0.01, prior_sigma ** 2)

        for _ in range(max_iterations):
            score = 0.0
            info = 0.0

            for r in responses:
                u = 1.0 if r.get("is_correct") else 0.0
                b = float(r.get("difficulty_b", 0.0))
                p = cls.calculate_rasch_probability(theta, b)
                score += (u - p)
                info += (p * (1.0 - p))

            # Add Gaussian prior regularization
            score -= (theta - prior_mu) / prior_var
            info += 1.0 / prior_var

            if info <= 0.0:
                break

            delta = score / info
            # Step damping for robust convergence
            if delta > 0.75:
                delta = 0.75
            elif delta < -0.75:
                delta = -0.75

            theta += delta
            theta = max(cls.THETA_MIN, min(cls.THETA_MAX, theta))

            if abs(delta) < tolerance:
                break

        # Calculate final standard error of measurement
        final_info = sum(
            cls.calculate_fisher_information(theta, float(r.get("difficulty_b", 0.0)))
            for r in responses
        ) + (1.0 / prior_var)

        se = 1.0 / math.sqrt(max(0.25, final_info))
        return round(theta, 4), round(se, 4)

    # =========================================================================
    # 2. EMPIRICAL ITEM CALIBRATION
    # =========================================================================

    @classmethod
    def update_empirical_item_calibration(
        cls,
        item: AdaptiveQuizItem,
        is_correct: bool,
        theta_estimate: float,
        db: Session
    ) -> float:
        """
        Incrementally updates the item's empirical difficulty estimate using empirical Bayes:
        b_empirical = \theta_mean - \ln((correct + 1) / (incorrect + 1))
        
        Blends prior and empirical estimates using credibility weighting w_N = N / (N + 10).
        Early items use the prior; as N increases, true empirical difficulty takes over.
        """
        item.response_count += 1
        if is_correct:
            item.correct_count += 1

        n = item.response_count
        r = item.correct_count
        w_n = n / (n + 10.0)

        # Empirical difficulty offset from student ability
        odds_ratio = (r + 1.0) / (n - r + 1.0)
        b_empirical = theta_estimate - math.log(odds_ratio)
        b_empirical = max(cls.B_MIN, min(cls.B_MAX, b_empirical))

        # Credibility-weighted blend
        b_blended = ((1.0 - w_n) * item.difficulty_prior) + (w_n * b_empirical)
        item.difficulty_estimate = round(max(cls.B_MIN, min(cls.B_MAX, b_blended)), 4)
        db.commit()

        return item.difficulty_estimate

    # =========================================================================
    # 3. ZPD MULTI-FACTOR ITEM SELECTION & CONTENT BALANCING
    # =========================================================================

    @classmethod
    def select_next_item(
        cls,
        available_items: List[AdaptiveQuizItem],
        current_theta: float,
        session_responses: List[AdaptiveQuizResponse],
        user_seen_item_ids: Set[str],
        bkt_mastery_map: Dict[str, float]
    ) -> Optional[AdaptiveQuizItem]:
        """
        Multi-Factor Item Selection targeting:
        1. Fisher Information I(\theta, b)
        2. Zone of Proximal Development fit (P* \in [0.65, 0.80])
        3. Concept mastery priority from BKT ((1 - P(L)))
        4. Content balancing (penalize concepts asked > 2 consecutive times)
        5. Exposure penalty for questions previously seen by user
        """
        if not available_items:
            return None

        # Exclude questions already answered in this current session
        answered_ids = {r.question_id for r in session_responses}
        candidate_pool = [it for it in available_items if it.id not in answered_ids]
        if not candidate_pool:
            return None

        # Content balancing: identify concepts answered in the last 2 steps
        recent_concepts = [r.concept_name for r in session_responses[-cls.MAX_CONSECUTIVE_CONCEPT:]]
        consecutive_concept = None
        if len(recent_concepts) >= cls.MAX_CONSECUTIVE_CONCEPT and len(set(recent_concepts)) == 1:
            consecutive_concept = recent_concepts[0]

        # Filter candidates to enforce content diversity
        balanced_candidates = [
            it for it in candidate_pool
            if consecutive_concept is None or it.concept_name != consecutive_concept
        ]
        if not balanced_candidates:
            # Fallback if all remaining candidates are in the consecutive concept
            balanced_candidates = candidate_pool

        best_item = None
        best_score = -float('inf')

        for item in balanced_candidates:
            # Effective difficulty: empirical if calibrated, otherwise prior
            resp_cnt = getattr(item, "response_count", 0) or 0
            has_calibrated = (resp_cnt >= 3 and item.difficulty_estimate is not None)
            b_eff = float(item.difficulty_estimate if has_calibrated else (item.difficulty_prior or 0.0))
            p_success = cls.calculate_rasch_probability(current_theta, b_eff)

            # 1. Fisher Information
            info = cls.calculate_fisher_information(current_theta, b_eff)

            # 2. ZPD Fit: Highest when P(success) \in [0.65, 0.80]
            if cls.ZPD_P_MIN <= p_success <= cls.ZPD_P_MAX:
                zpd_fit = 1.0
            else:
                dist = min(abs(p_success - cls.ZPD_P_MIN), abs(p_success - cls.ZPD_P_MAX))
                zpd_fit = max(0.0, 1.0 - (2.5 * dist))

            # 3. Concept Priority: prioritize concepts where student BKT knowledge is lowest
            p_l = bkt_mastery_map.get(item.concept_name, 0.5)
            concept_priority = 1.0 - p_l

            # 4. Exposure penalty: penalize items the user has seen in previous sessions
            exposure_penalty = 1.0 if item.id in user_seen_item_ids else 0.0

            # Composite pedagogical utility function
            score = (
                (1.0 * info) +
                (1.2 * zpd_fit) +
                (0.8 * concept_priority) -
                (1.5 * exposure_penalty)
            )

            if score > best_score:
                best_score = score
                best_item = item

        return best_item or candidate_pool[0]

    # =========================================================================
    # 4. DYNAMIC STOPPING CRITERIA & ABILITY CLASSIFICATION
    # =========================================================================

    @classmethod
    def check_stopping_criteria(
        cls,
        session: AdaptiveQuizSession,
        current_se: float,
        step_count: int,
        se_history: List[float]
    ) -> Tuple[bool, Optional[str]]:
        """
        Determines whether the adaptive assessment should terminate:
        1. Max questions reached
        2. High confidence convergence: SE < 0.35 after at least min_questions
        3. Diminishing information return: SE plateau across 3 steps
        """
        if step_count >= session.target_questions:
            return True, "MAX_QUESTIONS"

        if step_count >= session.min_questions and current_se <= cls.CONVERGENCE_SE:
            return True, "SE_CONVERGED"

        if (
            step_count >= session.min_questions and
            len(se_history) >= 3 and
            abs(se_history[-1] - se_history[-2]) < 0.008 and
            abs(se_history[-2] - se_history[-3]) < 0.008
        ):
            return True, "LOW_INFO_GAIN"

        return False, None

    @staticmethod
    def classify_ability_band(theta: float) -> str:
        """User-friendly ability classification band"""
        if theta < -0.75:
            return "Novice"
        if theta < 0.25:
            return "Developing"
        if theta < 1.25:
            return "Proficient"
        return "Master"

    # =========================================================================
    # 5. BKT INITIALIZATION SEED
    # =========================================================================

    @staticmethod
    def seed_theta_from_bkt(user_id: int, document_id: Optional[int], db: Session) -> float:
        """
        Maps the student's latent Bayesian Knowledge Tracing state P(L)
        into an initial Rasch ability prior \theta_0:
        \theta_0 = \text{logit}(\bar{P}(L)) = \ln(\bar{P}(L) / (1 - \bar{P}(L)))
        """
        query = db.query(LearnerConceptState).filter(LearnerConceptState.user_id == user_id)
        if document_id:
            query = query.filter(LearnerConceptState.document_id == document_id)
        states = query.all()

        if not states:
            return 0.0

        avg_p_known = sum(s.p_known for s in states) / len(states)
        bounded_p = max(0.10, min(0.90, avg_p_known))
        theta_0 = math.log(bounded_p / (1.0 - bounded_p))
        return round(max(-1.5, min(1.5, theta_0)), 4)

    # =========================================================================
    # 6. SESSION LIFECYCLE & STEP ENGINE
    # =========================================================================

    async def start_adaptive_session(
        self,
        user_id: int,
        document_id: Optional[int],
        topic: Optional[str],
        num_questions: int,
        db: Session
    ) -> Dict[str, Any]:
        """
        Initializes an adaptive testing session:
        1. Ensures item pool exists with calibrated priors
        2. Seeds \theta_0 from BKT
        3. Selects optimal opening question targeting ZPD
        4. Persists session and returns student payload
        """
        # Ensure candidate question bank exists
        await self._ensure_item_pool(document_id, topic, db, user_id=user_id)

        # Seed initial ability
        theta_0 = self.seed_theta_from_bkt(user_id, document_id, db)
        se_0 = 1.0

        # Load available items for this document/topic
        query = db.query(AdaptiveQuizItem)
        if document_id:
            query = query.filter(AdaptiveQuizItem.document_id == document_id)
        elif topic:
            query = query.filter(AdaptiveQuizItem.concept_name.ilike(f"%{topic}%"))
        available_items = query.all()

        if not available_items:
            raise Exception("No adaptive questions available. Please verify document ingestion.")

        # User's historical exposure to avoid repeats
        past_responses = db.query(AdaptiveQuizResponse.question_id).filter(
            AdaptiveQuizResponse.user_id == user_id
        ).all()
        user_seen_ids = {r[0] for r in past_responses}

        # BKT concept mastery map
        bkt_states = db.query(LearnerConceptState).filter(LearnerConceptState.user_id == user_id).all()
        bkt_map = {s.concept_name: s.p_known for s in bkt_states}

        # Select initial item
        first_item = self.select_next_item(
            available_items=available_items,
            current_theta=theta_0,
            session_responses=[],
            user_seen_item_ids=user_seen_ids,
            bkt_mastery_map=bkt_map
        )
        if not first_item:
            raise Exception("Failed to select initial adaptive question.")

        target_q = max(self.DEFAULT_MIN_QUESTIONS, min(self.DEFAULT_MAX_QUESTIONS, num_questions))
        session_id = f"cat_{uuid.uuid4().hex[:12]}"

        new_session = AdaptiveQuizSession(
            id=session_id,
            user_id=user_id,
            document_id=document_id,
            topic=topic or (first_item.concept_name if first_item else "General Assessment"),
            theta_estimate=theta_0,
            standard_error=se_0,
            theta_history=[theta_0],
            se_history=[se_0],
            target_questions=target_q,
            min_questions=self.DEFAULT_MIN_QUESTIONS,
            current_step=0,
            is_completed=False,
            question_pool_ids=[it.id for it in available_items]
        )
        db.add(new_session)
        db.commit()

        return {
            "session_id": session_id,
            "topic": new_session.topic,
            "current_step": 0,
            "target_questions": target_q,
            "min_questions": self.DEFAULT_MIN_QUESTIONS,
            "initial_theta": theta_0,
            "ability_level": self.classify_ability_band(theta_0),
            "question": {
                "id": first_item.id,
                "concept_name": first_item.concept_name,
                "question": first_item.question,
                "options": first_item.options,
                "difficulty_level": self._format_difficulty_label(first_item.difficulty_estimate or first_item.difficulty_prior),
                # Scientific metrics for collapsible diagnostics
                "difficulty_b": round(first_item.difficulty_estimate or first_item.difficulty_prior, 2)
            }
        }

    def submit_adaptive_step(
        self,
        session_id: str,
        question_id: str,
        client_step_id: str,
        selected_answer: str,
        response_time_ms: int,
        user_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """
        Processes an adaptive answer submission:
        1. Checks idempotency via client_step_id
        2. Evaluates correctness and executes Rasch MAP update
        3. Updates empirical item calibration and BKT concept state
        4. Checks stopping rules; either concludes or serves next item
        """
        session = db.query(AdaptiveQuizSession).filter(
            AdaptiveQuizSession.id == session_id,
            AdaptiveQuizSession.user_id == user_id
        ).first()
        if not session:
            raise Exception("Adaptive quiz session not found or unauthorized.")

        # Idempotency check: if already processed, return cached step payload
        existing_resp = db.query(AdaptiveQuizResponse).filter(
            AdaptiveQuizResponse.session_id == session_id,
            AdaptiveQuizResponse.client_step_id == client_step_id
        ).first()
        if existing_resp:
            logger.info(f"Duplicate step submission detected: {client_step_id}. Returning cached response.")
            return self._build_step_payload(session, existing_resp, None, db)

        if session.is_completed:
            raise Exception("Adaptive quiz session is already completed.")

        item = db.query(AdaptiveQuizItem).filter(AdaptiveQuizItem.id == question_id).first()
        if not item:
            raise Exception(f"Adaptive quiz question {question_id} not found.")

        # 1. Correctness evaluation
        is_correct = (selected_answer.strip().upper() == item.correct_answer.strip().upper())
        theta_before = session.theta_estimate
        se_before = session.standard_error

        # 2. Gather response history including this step
        past_responses = db.query(AdaptiveQuizResponse).filter(
            AdaptiveQuizResponse.session_id == session_id
        ).all()
        response_history = [
            {"is_correct": r.is_correct, "difficulty_b": r.difficulty_b}
            for r in past_responses
        ]
        eff_b = item.difficulty_estimate if item.response_count >= 3 else item.difficulty_prior
        response_history.append({"is_correct": is_correct, "difficulty_b": eff_b})

        # 3. Newton-Raphson MAP Ability Update
        theta_after, se_after = self.estimate_theta_map(
            responses=response_history,
            prior_mu=session.theta_history[0] if session.theta_history else 0.0,
            prior_sigma=1.0
        )

        # 4. Empirical Item Calibration Update
        self.update_empirical_item_calibration(
            item=item,
            is_correct=is_correct,
            theta_estimate=theta_after,
            db=db
        )

        # 5. Synchronize with Bayesian Knowledge Tracing (KT-01)
        try:
            knowledge_tracing_service.update_knowledge_state(
                user_id=user_id,
                concept_name=item.concept_name,
                is_correct=is_correct,
                response_time_ms=response_time_ms,
                interaction_type="cat_quiz",
                item_id=item.id,
                document_id=session.document_id,
                db=db
            )
        except Exception as e:
            logger.warning(f"Non-fatal BKT sync error during adaptive step: {e}")

        # 6. Save immutable response record
        step_response = AdaptiveQuizResponse(
            session_id=session_id,
            user_id=user_id,
            question_id=item.id,
            concept_name=item.concept_name,
            client_step_id=client_step_id,
            selected_answer=selected_answer,
            is_correct=is_correct,
            response_time_ms=response_time_ms,
            difficulty_b=eff_b,
            theta_before=theta_before,
            theta_after=theta_after,
            se_before=se_before,
            se_after=se_after
        )
        db.add(step_response)

        # 7. Update Session State
        session.current_step += 1
        session.theta_estimate = theta_after
        session.standard_error = se_after
        session.theta_history = list(session.theta_history or []) + [theta_after]
        session.se_history = list(session.se_history or []) + [se_after]

        # 8. Evaluate Dynamic Stopping Rule
        all_session_responses = past_responses + [step_response]
        should_stop, stop_reason = self.check_stopping_criteria(
            session=session,
            current_se=se_after,
            step_count=session.current_step,
            se_history=session.se_history
        )

        next_item = None
        if should_stop:
            session.is_completed = True
            session.stopping_reason = stop_reason
            session.final_ability_band = self.classify_ability_band(theta_after)
            session.completed_at = datetime.utcnow()
        else:
            # 9. Select Next Optimal Item
            available_items = db.query(AdaptiveQuizItem).filter(
                AdaptiveQuizItem.id.in_(session.question_pool_ids or [])
            ).all()

            user_seen_records = db.query(AdaptiveQuizResponse.question_id).filter(
                AdaptiveQuizResponse.user_id == user_id
            ).all()
            user_seen_ids = {r[0] for r in user_seen_records}

            bkt_states = db.query(LearnerConceptState).filter(LearnerConceptState.user_id == user_id).all()
            bkt_map = {s.concept_name: s.p_known for s in bkt_states}

            next_item = self.select_next_item(
                available_items=available_items,
                current_theta=theta_after,
                session_responses=all_session_responses,
                user_seen_item_ids=user_seen_ids,
                bkt_mastery_map=bkt_map
            )
            # If no more questions in pool, terminate gracefully
            if not next_item:
                session.is_completed = True
                session.stopping_reason = "POOL_EXHAUSTED"
                session.final_ability_band = self.classify_ability_band(theta_after)
                session.completed_at = datetime.utcnow()

        db.commit()
        return self._build_step_payload(session, step_response, next_item, db, item=item)

    # =========================================================================
    # 7. RESPONSE PAYLOAD SERIALIZATION & DIAGNOSTICS
    # =========================================================================

    def _build_step_payload(
        self,
        session: AdaptiveQuizSession,
        resp: AdaptiveQuizResponse,
        next_item: Optional[AdaptiveQuizItem],
        db: Session,
        item: Optional[AdaptiveQuizItem] = None
    ) -> Dict[str, Any]:
        """Formats the step feedback and diagnostic payload"""
        if not item:
            item = db.query(AdaptiveQuizItem).filter(AdaptiveQuizItem.id == resp.question_id).first()

        theta_delta = round(resp.theta_after - resp.theta_before, 3)

        payload = {
            "session_id": session.id,
            "step_index": session.current_step,
            "is_completed": session.is_completed,
            "feedback": {
                "question_id": resp.question_id,
                "concept_name": resp.concept_name,
                "is_correct": resp.is_correct,
                "selected_answer": resp.selected_answer,
                "correct_answer": item.correct_answer if item else "",
                "explanation": item.explanation if item else "",
                "ability_band": self.classify_ability_band(resp.theta_after),
                "ability_delta_direction": "UP" if theta_delta > 0.05 else ("DOWN" if theta_delta < -0.05 else "STABLE"),
                # Power user diagnostic metrics
                "theta_before": resp.theta_before,
                "theta_after": resp.theta_after,
                "theta_delta": theta_delta,
                "standard_error": resp.se_after
            }
        }

        if not session.is_completed and next_item:
            payload["next_question"] = {
                "id": next_item.id,
                "concept_name": next_item.concept_name,
                "question": next_item.question,
                "options": next_item.options,
                "difficulty_level": self._format_difficulty_label(next_item.difficulty_estimate or next_item.difficulty_prior),
                "difficulty_b": round(next_item.difficulty_estimate or next_item.difficulty_prior, 2)
            }
        elif session.is_completed:
            payload["diagnostic_report"] = self._generate_session_report(session, db)

        return payload

    def _generate_session_report(self, session: AdaptiveQuizSession, db: Session) -> Dict[str, Any]:
        """Generates comprehensive post-assessment diagnostic summary"""
        responses = db.query(AdaptiveQuizResponse).filter(
            AdaptiveQuizResponse.session_id == session.id
        ).all()

        total = len(responses)
        correct_count = sum(1 for r in responses if r.is_correct)
        accuracy = round((correct_count / total * 100) if total > 0 else 0.0, 1)

        # Concept breakdown
        mastered_concepts = []
        practice_concepts = []
        concept_perf: Dict[str, List[bool]] = {}

        for r in responses:
            concept_perf.setdefault(r.concept_name, []).append(r.is_correct)

        for concept, results in concept_perf.items():
            if all(results):
                mastered_concepts.append(concept)
            elif any(not res for res in results):
                practice_concepts.append(concept)

        stopping_labels = {
            "SE_CONVERGED": "Ability measurement converged with high statistical confidence",
            "MAX_QUESTIONS": "Assessment completed targeted assessment length",
            "LOW_INFO_GAIN": "Measurement plateaued; ability reliably classified",
            "POOL_EXHAUSTED": "All calibrated questions completed"
        }

        final_band = session.final_ability_band or self.classify_ability_band(session.theta_estimate)

        return {
            "final_ability_band": final_band,
            "final_theta": round(session.theta_estimate, 3),
            "final_se": round(session.standard_error, 3),
            "total_items_answered": total,
            "correct_items": correct_count,
            "accuracy_percentage": accuracy,
            "stopping_reason": session.stopping_reason or "MAX_QUESTIONS",
            "stopping_explanation": stopping_labels.get(session.stopping_reason, "Completed"),
            "ability_trajectory": session.theta_history or [],
            "mastered_concepts": mastered_concepts,
            "needs_practice_concepts": practice_concepts,
            "recommended_recovery_tool": "flashcards" if accuracy < 65 else "feynman"
        }

    def get_session_details(self, session_id: str, user_id: int, db: Session) -> Dict[str, Any]:
        """Retrieves session state and response history"""
        session = db.query(AdaptiveQuizSession).filter(
            AdaptiveQuizSession.id == session_id,
            AdaptiveQuizSession.user_id == user_id
        ).first()
        if not session:
            raise Exception("Session not found")

        responses = db.query(AdaptiveQuizResponse).filter(
            AdaptiveQuizResponse.session_id == session_id
        ).order_by(AdaptiveQuizResponse.id.asc()).all()

        return {
            "session_id": session.id,
            "topic": session.topic,
            "current_step": session.current_step,
            "target_questions": session.target_questions,
            "is_completed": session.is_completed,
            "theta_estimate": round(session.theta_estimate, 3),
            "standard_error": round(session.standard_error, 3),
            "ability_band": self.classify_ability_band(session.theta_estimate),
            "responses": [
                {
                    "step": i + 1,
                    "concept_name": r.concept_name,
                    "is_correct": r.is_correct,
                    "theta_after": round(r.theta_after, 3),
                    "difficulty_b": round(r.difficulty_b, 2),
                    "response_time_ms": r.response_time_ms
                }
                for i, r in enumerate(responses)
            ],
            "diagnostic_report": self._generate_session_report(session, db) if session.is_completed else None
        }

    # =========================================================================
    # 8. QUESTION POOL SEEDING & QUALITY GATE VALIDATION
    # =========================================================================

    async def _ensure_item_pool(
        self,
        document_id: Optional[int],
        topic: Optional[str],
        db: Session,
        user_id: Optional[int] = None
    ):
        """
        Ensures a calibrated question pool exists with Easy, Medium, and Hard items.
        Applies QualityGate validation to all candidate questions.
        """
        query = db.query(AdaptiveQuizItem)
        if document_id:
            query = query.filter(AdaptiveQuizItem.document_id == document_id)
        elif topic:
            query = query.filter(AdaptiveQuizItem.concept_name.ilike(f"%{topic}%"))
        existing_count = query.count()

        # If pool already has at least 8 items, no need to regenerate
        if existing_count >= 8:
            return

        source_text = ""
        if document_id:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc and doc.text_content:
                source_text = doc.text_content[:20000]

        if not source_text and topic:
            source_text = f"Comprehensive study guide covering key principles, mechanisms, and examples of {topic}."

        if not source_text:
            source_text = "Computer science, algorithms, operating systems, and computer network foundations."

        # Generate tiered questions across difficulty spectrum
        raw_items: List[Dict[str, Any]] = []
        for diff_level, prior_b in [("easy", -1.2), ("medium", 0.0), ("hard", 1.2)]:
            try:
                gen_questions = await self.llm_client.generate_quiz_questions(
                    content=source_text,
                    num_questions=4,
                    difficulty=diff_level,
                    user_id=user_id,
                    db=db
                )
                for q in gen_questions:
                    q["difficulty_prior"] = prior_b
                raw_items.extend(gen_questions)
            except Exception as e:
                logger.warning(f"Error generating {diff_level} adaptive items: {e}")

        # Quality Gate validation (Structural, Duplicate, and Grounding)
        validated = QualityGate.validate_quiz_quality(
            questions=raw_items,
            source_text=source_text,
            min_grounding_score=0.15
        )
        if not validated:
            validated = raw_items

        # Deduplicate and insert into AdaptiveQuizItem table
        for q in validated:
            q_text = q.get("question", "").strip()
            if not q_text:
                continue

            # Auto-tag concept if missing
            concept = q.get("concept") or knowledge_tracing_service.auto_tag_concept(
                text=f"{q_text} {q.get('explanation', '')}",
                document_id=document_id,
                user_id=user_id or 1,
                db=db
            )

            options = q.get("options")
            if isinstance(options, list):
                # Convert list ["A) ...", "B) ..."] to dict {"A": "...", "B": "..."}
                opt_dict = {}
                for idx, opt in enumerate(options):
                    key = chr(65 + idx)
                    val = opt
                    if isinstance(opt, str) and len(opt) >= 3 and opt[1] in [')', ':', '.']:
                        key = opt[0].upper()
                        val = opt[2:].strip()
                    opt_dict[key] = val
                options = opt_dict

            correct_ans = q.get("correct_answer", "A").strip()[:1].upper()
            if correct_ans not in ["A", "B", "C", "D"]:
                correct_ans = "A"

            prior_b = float(q.get("difficulty_prior", 0.0))

            item_record = AdaptiveQuizItem(
                id=f"item_{uuid.uuid4().hex[:12]}",
                document_id=document_id,
                concept_name=concept,
                subtopic=topic,
                question=q_text,
                options=options or {"A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D"},
                correct_answer=correct_ans,
                explanation=q.get("explanation", "Correct answer based on source text."),
                difficulty_prior=prior_b,
                difficulty_estimate=prior_b,
                response_count=0,
                correct_count=0,
                quality_score=1.0
            )
            db.add(item_record)

        db.commit()

    @staticmethod
    def _format_difficulty_label(b: float) -> str:
        """Translates numeric parameter b into friendly label"""
        if b < -0.5:
            return "Foundation"
        if b <= 0.5:
            return "Standard"
        return "Advanced"


# Global singleton instance
adaptive_quiz_service = AdaptiveQuizService()
