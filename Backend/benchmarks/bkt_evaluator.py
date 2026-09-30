"""
Shiro v3.5: Bayesian Knowledge Tracing (KT-01) Predictive Evaluation Engine
Evaluates probabilistic performance forecasting:
P(Y_{t+1}=1) accuracy, Brier Score, Log Loss, AUC-ROC, and Expected Calibration Error (ECE).
"""

import math
from typing import Dict, List, Any, Tuple
from services.knowledge_tracing_service import KnowledgeTracingService


class BKTEvaluator:
    """
    Evaluates Corbett & Anderson Bayesian Knowledge Tracing predictive reliability
    across sequential student learning interaction traces.
    """

    def __init__(self, dataset: Dict[str, Any]):
        self.dataset = dataset
        self.service = KnowledgeTracingService()

    @staticmethod
    def calculate_brier_score(predictions: List[float], outcomes: List[int]) -> float:
        """Mean squared error of probabilistic predictions: MSE = (1/N) * sum((p - y)^2)."""
        if not predictions:
            return 0.0
        return sum((p - y) ** 2 for p, y in zip(predictions, outcomes)) / len(predictions)

    @staticmethod
    def calculate_log_loss(predictions: List[float], outcomes: List[int], eps: float = 1e-6) -> float:
        """Binary cross-entropy loss with numerical probability bounding."""
        if not predictions:
            return 0.0
        loss = 0.0
        for p, y in zip(predictions, outcomes):
            clamped_p = max(eps, min(1.0 - eps, p))
            loss -= (y * math.log(clamped_p) + (1 - y) * math.log(1.0 - clamped_p))
        return loss / len(predictions)

    @staticmethod
    def calculate_auc_roc(predictions: List[float], outcomes: List[int]) -> float:
        """Calculates exact Area Under the ROC Curve via Mann-Whitney U statistic."""
        positives = [p for p, y in zip(predictions, outcomes) if y == 1]
        negatives = [p for p, y in zip(predictions, outcomes) if y == 0]

        if not positives or not negatives:
            return 0.50 # Neutral discrimination if unipolar

        wins = 0.0
        for pos in positives:
            for neg in negatives:
                if pos > neg:
                    wins += 1.0
                elif pos == neg:
                    wins += 0.5

        return wins / (len(positives) * len(negatives))

    @staticmethod
    def calculate_calibration_curve(
        predictions: List[float],
        outcomes: List[int],
        num_bins: int = 10
    ) -> Tuple[float, List[Dict[str, Any]]]:
        """
        Calculates Expected Calibration Error (ECE) and bin reliability points.
        Partitions [0, 1] into num_bins equal width intervals.
        """
        bin_width = 1.0 / num_bins
        bins: List[List[Tuple[float, int]]] = [[] for _ in range(num_bins)]

        for p, y in zip(predictions, outcomes):
            b_idx = min(num_bins - 1, int(p / bin_width))
            bins[b_idx].append((p, y))

        total_samples = len(predictions)
        ece = 0.0
        reliability_diagram: List[Dict[str, Any]] = []

        for idx, b in enumerate(bins):
            bin_center = round((idx + 0.5) * bin_width, 2)
            if not b:
                reliability_diagram.append({
                    "bin_index": idx,
                    "bin_center": bin_center,
                    "sample_count": 0,
                    "mean_predicted": bin_center,
                    "empirical_accuracy": bin_center,
                    "calibration_gap": 0.0
                })
                continue

            count = len(b)
            avg_pred = sum(p for p, _ in b) / count
            avg_acc = sum(y for _, y in b) / count
            gap = abs(avg_acc - avg_pred)

            ece += (count / total_samples) * gap
            reliability_diagram.append({
                "bin_index": idx,
                "bin_center": bin_center,
                "sample_count": count,
                "mean_predicted": round(avg_pred, 4),
                "empirical_accuracy": round(avg_acc, 4),
                "calibration_gap": round(gap, 4)
            })

        return round(ece, 4), reliability_diagram

    def evaluate_predictive_performance(self) -> Dict[str, Any]:
        """
        Runs sequential evaluation across all traces in the benchmark dataset.
        For every step t >= 2, predicts P(Y_{t+1}=1) and compares with actual ground truth Y_{t+1}.
        """
        traces = self.dataset.get("synthetic_learner_traces", [])
        if not traces:
            return {}

        predictions: List[float] = []
        actual_outcomes: List[int] = []

        for trace in traces:
            interactions = trace.get("interactions", [])
            # Initialize latent mastery at prior P(L0)
            p_l = self.service.default_p_l0

            for i, step in enumerate(interactions):
                # 1. Predict performance probability on current trial
                pred_p = self.service.predict_next_performance(p_l)
                is_correct = 1 if step.get("is_correct") else 0

                # Log predictions from step 1 onward
                predictions.append(pred_p)
                actual_outcomes.append(is_correct)

                # 2. Update posterior and transition for next step
                posterior = self.service.compute_posterior(p_l, is_correct=bool(is_correct))
                p_l = self.service.compute_transition(posterior)

        # Compute Metrics
        brier = round(self.calculate_brier_score(predictions, actual_outcomes), 4)
        log_loss = round(self.calculate_log_loss(predictions, actual_outcomes), 4)
        auc = round(self.calculate_auc_roc(predictions, actual_outcomes), 4)
        ece, reliability_data = self.calculate_calibration_curve(predictions, actual_outcomes, num_bins=10)

        # Baseline: A naive majority or flat 0.5 guesser
        baseline_brier = 0.2500
        brier_improvement_pct = round(((baseline_brier - brier) / baseline_brier) * 100, 2)

        return {
            "evaluation_type": "Corbett & Anderson Bayesian Knowledge Tracing Predictive Evaluation",
            "total_sequences_evaluated": len(traces),
            "total_interaction_steps": len(predictions),
            "metrics": {
                "brier_score": brier,
                "log_loss": log_loss,
                "auc_roc": auc,
                "expected_calibration_error_ece": ece,
                "brier_gain_vs_random_guess_pct": brier_improvement_pct
            },
            "reliability_diagram": reliability_data,
            "scientific_assessment": (
                f"KT-01 achieves a Brier score of {brier} (a {brier_improvement_pct}% error reduction "
                f"over uncalibrated guessing) with an AUC-ROC of {auc} and Expected Calibration Error of {ece}."
            )
        }
