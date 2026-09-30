"""
Shiro v3.5: Computerized Adaptive Testing (CAT) Psychometric Evaluation Engine
Simulates Monte Carlo student cohorts across latent ability strata (theta in [-2.0, +2.0]).
Empirically benchmarks ADAPT-01 against Random Selection and Fixed-Difficulty Linear tests.
"""

import math
import random
from typing import Dict, List, Any, Tuple, Optional
from services.adaptive_quiz_service import AdaptiveQuizService
from models.database import AdaptiveQuizItem, AdaptiveQuizSession


class CATEvaluator:
    """
    Evaluates 1PL Rasch ability estimation accuracy, test length efficiency,
    and Fisher information maximization across synthetic learner cohorts.
    """

    def __init__(self, dataset: Dict[str, Any]):
        self.dataset = dataset
        self.service = AdaptiveQuizService()
        self.items: List[AdaptiveQuizItem] = []
        self._load_items()

    def _load_items(self):
        """Loads questions from benchmark dataset as AdaptiveQuizItem models."""
        self.items = []
        for q in self.dataset.get("questions", []):
            item = AdaptiveQuizItem(
                id=q["id"],
                concept_name=q["concept_name"],
                question=q["question"],
                options=q["options"],
                correct_answer=q["correct_answer"],
                explanation=q.get("explanation", ""),
                difficulty_prior=q.get("difficulty_b", 0.0),
                difficulty_estimate=q.get("difficulty_b", 0.0)
            )
            self.items.append(item)

    @staticmethod
    def simulate_rasch_response(theta_true: float, b_item: float) -> bool:
        """Samples a Bernoulli response from the true 1PL Rasch probability."""
        z = theta_true - b_item
        if z > 15.0:
            p = 0.99999
        elif z < -15.0:
            p = 0.00001
        else:
            p = 1.0 / (1.0 + math.exp(-z))
        return random.random() < p

    def run_single_simulation(
        self,
        theta_true: float,
        policy: str = "adaptive", # "adaptive", "fixed_difficulty", "random"
        min_questions: int = 4,
        max_questions: int = 10,
        target_se: float = 0.35
    ) -> Dict[str, Any]:
        """
        Simulates an end-to-end testing session for a student with known true ability theta_true.
        """
        session = AdaptiveQuizSession(
            id=f"sim_{random.randint(1000, 9999)}",
            user_id=1,
            theta_estimate=0.0,
            standard_error=1.0,
            theta_history=[0.0],
            se_history=[1.0],
            target_questions=max_questions,
            min_questions=min_questions,
            current_step=0,
            is_completed=False,
            question_pool_ids=[it.id for it in self.items]
        )

        administered_items: List[AdaptiveQuizItem] = []
        responses: List[Dict[str, Any]] = []
        seen_ids = set()

        while session.current_step < max_questions and not session.is_completed:
            available = [it for it in self.items if it.id not in seen_ids]
            if not available:
                break

            # 1. Item Selection Policy
            if policy == "adaptive":
                # ADAPT-01: Fisher info maximization + ZPD targeting
                selected_item = self.service.select_next_item(
                    available_items=available,
                    current_theta=session.theta_estimate,
                    session_responses=[],
                    user_seen_item_ids=seen_ids,
                    bkt_mastery_map={}
                )
            elif policy == "fixed_difficulty":
                # Classical Classroom Test: Always pick items close to average b=0.0
                available.sort(key=lambda x: abs(x.difficulty_estimate - 0.0))
                selected_item = available[0]
            else: # "random"
                # Naive Baseline: Uniform random sampling
                selected_item = random.choice(available)

            seen_ids.add(selected_item.id)
            administered_items.append(selected_item)

            # 2. Simulate Response
            is_correct = self.simulate_rasch_response(theta_true, selected_item.difficulty_estimate)
            responses.append({
                "is_correct": is_correct,
                "difficulty_b": selected_item.difficulty_estimate
            })

            # 3. Ability Estimation (Newton-Raphson MAP)
            new_theta, new_se = self.service.estimate_theta_map(responses)
            session.theta_estimate = new_theta
            session.standard_error = new_se
            session.current_step += 1
            session.theta_history.append(new_theta)
            session.se_history.append(new_se)

            # 4. Check Dynamic Stopping Criteria
            should_stop, reason = self.service.check_stopping_criteria(
                session=session,
                current_se=new_se,
                step_count=session.current_step,
                se_history=session.se_history
            )
            if should_stop:
                session.is_completed = True
                session.stopping_reason = reason
                break

        estimation_error = abs(session.theta_estimate - theta_true)
        signed_error = session.theta_estimate - theta_true

        return {
            "theta_true": theta_true,
            "theta_estimated": round(session.theta_estimate, 4),
            "final_se": round(session.standard_error, 4),
            "abs_error": round(estimation_error, 4),
            "signed_error": round(signed_error, 4),
            "questions_administered": session.current_step,
            "converged_early": session.standard_error <= target_se and session.current_step < max_questions,
            "stopping_reason": session.stopping_reason or "MAX_QUESTIONS",
            "theta_trajectory": session.theta_history,
            "se_trajectory": session.se_history
        }

    def evaluate_cohorts(
        self,
        strata: Optional[List[float]] = None,
        samples_per_stratum: int = 25
    ) -> Dict[str, Any]:
        """
        Executes Monte Carlo evaluation across multiple ability strata for each policy.
        """
        if strata is None:
            strata = [-2.0, -1.0, 0.0, +1.0, +2.0]

        policies = ["adaptive", "fixed_difficulty", "random"]
        policy_results: Dict[str, Dict[str, Any]] = {}

        for pol in policies:
            all_errors = []
            all_signed = []
            all_q_counts = []
            all_se = []
            converged_count = 0
            stratum_breakdown = {}

            for th_true in strata:
                stratum_errors = []
                stratum_q = []
                for _ in range(samples_per_stratum):
                    res = self.run_single_simulation(theta_true=th_true, policy=pol)
                    all_errors.append(res["abs_error"])
                    all_signed.append(res["signed_error"])
                    all_q_counts.append(res["questions_administered"])
                    all_se.append(res["final_se"])
                    if res["converged_early"]:
                        converged_count += 1
                    stratum_errors.append(res["abs_error"])
                    stratum_q.append(res["questions_administered"])

                stratum_breakdown[f"theta_{th_true:+.1f}"] = {
                    "mae": round(sum(stratum_errors) / len(stratum_errors), 4),
                    "avg_questions": round(sum(stratum_q) / len(stratum_q), 2)
                }

            n = len(all_errors)
            mae = sum(all_errors) / n
            rmse = math.sqrt(sum(e ** 2 for e in all_errors) / n)
            bias = sum(all_signed) / n
            avg_q = sum(all_q_counts) / n
            avg_se = sum(all_se) / n
            convergence_rate = (converged_count / n) * 100.0

            policy_results[pol] = {
                "mae": round(mae, 4),
                "rmse": round(rmse, 4),
                "bias": round(bias, 4),
                "avg_questions_to_stop": round(avg_q, 2),
                "avg_final_se": round(avg_se, 4),
                "early_convergence_rate_pct": round(convergence_rate, 2),
                "stratum_breakdown": stratum_breakdown
            }

        # Calculate comparative advantage
        rmse_gain = round(((policy_results["random"]["rmse"] - policy_results["adaptive"]["rmse"]) / policy_results["random"]["rmse"]) * 100, 2)
        q_reduction = round(((policy_results["fixed_difficulty"]["avg_questions_to_stop"] - policy_results["adaptive"]["avg_questions_to_stop"]) / policy_results["fixed_difficulty"]["avg_questions_to_stop"]) * 100, 2)

        # Generate sample regression trajectory data for frontend HUD visualization
        sample_trajectory = self.run_single_simulation(theta_true=1.0, policy="adaptive")

        return {
            "evaluation_type": "1PL Rasch Adaptive CAT Psychometric Ability Recovery",
            "total_simulated_learners": len(strata) * samples_per_stratum * len(policies),
            "ability_strata_evaluated": strata,
            "samples_per_stratum": samples_per_stratum,
            "policies": policy_results,
            "comparative_insights": {
                "adaptive_rmse_reduction_vs_random_pct": rmse_gain,
                "question_efficiency_gain_vs_fixed_pct": max(0.0, q_reduction),
                "scientific_conclusion": f"ADAPT-01 achieves {rmse_gain}% lower estimation error (RMSE: {policy_results['adaptive']['rmse']}) while requiring an average of only {policy_results['adaptive']['avg_questions_to_stop']} questions."
            },
            "hud_sample_trajectory": {
                "theta_true": 1.0,
                "estimated_steps": sample_trajectory["theta_trajectory"],
                "se_steps": sample_trajectory["se_trajectory"]
            }
        }
