"""
Shiro v3.5: Intelligence Validation & Evaluation Benchmark Suite Tests
Verifies mathematical correctness of IR metrics (Recall, MRR, nDCG),
psychometric ability recovery, BKT calibration metrics (Brier score, AUC, ECE),
and multi-constraint policy simulation.
"""

import math
import pytest
from benchmarks.rag_evaluator import RAGEvaluator
from benchmarks.cat_evaluator import CATEvaluator
from benchmarks.bkt_evaluator import BKTEvaluator
from benchmarks.policy_evaluator import PolicyEvaluator
from benchmarks.runner import BenchmarkRunner


@pytest.fixture(scope="module")
def benchmark_dataset():
    runner = BenchmarkRunner()
    return runner.dataset


# =====================================================================
# 1. RAG EVALUATION METRICS MATHEMATICAL TESTS
# =====================================================================

def test_mrr_first_rank():
    """Verify MRR = 1.0 when ground truth is at rank 1."""
    retrieved = ["chunk_a", "chunk_b", "chunk_c"]
    gt = ["chunk_a"]
    mrr = RAGEvaluator.calculate_reciprocal_rank(retrieved, gt)
    assert mrr == 1.0


def test_mrr_second_rank():
    """Verify MRR = 0.5 when ground truth is at rank 2."""
    retrieved = ["chunk_x", "chunk_target", "chunk_z"]
    gt = ["chunk_target"]
    mrr = RAGEvaluator.calculate_reciprocal_rank(retrieved, gt)
    assert mrr == 0.5


def test_mrr_not_found():
    """Verify MRR = 0.0 when ground truth is missing."""
    retrieved = ["c1", "c2", "c3"]
    gt = ["c_missing"]
    assert RAGEvaluator.calculate_reciprocal_rank(retrieved, gt) == 0.0


def test_recall_at_k():
    """Verify Recall@K fractions."""
    retrieved = ["c1", "c2", "c3", "c4", "c5"]
    gt = ["c2", "c5", "c9"] # 2 of 3 present in top 5
    rec_3 = RAGEvaluator.calculate_recall_at_k(retrieved, gt, k=3)
    assert rec_3 == pytest.approx(1.0 / 3.0)

    rec_5 = RAGEvaluator.calculate_recall_at_k(retrieved, gt, k=5)
    assert rec_5 == pytest.approx(2.0 / 3.0)


def test_ndcg_at_k_perfect_and_degraded():
    """Verify nDCG@K is 1.0 for ideal ranking and < 1.0 for sub-optimal ranking."""
    gt = ["c1", "c2"]
    ideal = ["c1", "c2", "c3", "c4"]
    assert RAGEvaluator.calculate_ndcg_at_k(ideal, gt, k=4) == pytest.approx(1.0)

    suboptimal = ["c3", "c1", "c4", "c2"]
    ndcg_sub = RAGEvaluator.calculate_ndcg_at_k(suboptimal, gt, k=4)
    assert 0.0 < ndcg_sub < 1.0


# =====================================================================
# 2. CAT PSYCHOMETRIC RECOVERY TESTS
# =====================================================================

def test_cat_simulation_execution(benchmark_dataset):
    """Verifies that single student CAT simulation executes and converges."""
    evaluator = CATEvaluator(benchmark_dataset)
    res = evaluator.run_single_simulation(theta_true=0.5, policy="adaptive", max_questions=8)
    assert res["theta_true"] == 0.5
    assert -3.0 <= res["theta_estimated"] <= 3.0
    assert res["questions_administered"] <= 8
    assert len(res["theta_trajectory"]) == res["questions_administered"] + 1


def test_cat_strata_evaluation(benchmark_dataset):
    """Verifies cohort evaluation runs across strata with lower RMSE for adaptive."""
    evaluator = CATEvaluator(benchmark_dataset)
    results = evaluator.evaluate_cohorts(strata=[-1.0, +1.0], samples_per_stratum=4)
    assert "adaptive" in results["policies"]
    assert "random" in results["policies"]
    assert results["policies"]["adaptive"]["rmse"] < results["policies"]["random"]["rmse"] * 1.5


# =====================================================================
# 3. BKT PREDICTIVE CALIBRATION TESTS
# =====================================================================

def test_brier_score_math():
    """Verify Brier score identity: (1/N) * sum((p - y)^2)."""
    preds = [1.0, 0.0]
    actuals = [1, 0]
    assert BKTEvaluator.calculate_brier_score(preds, actuals) == 0.0

    preds_wrong = [0.0, 1.0]
    assert BKTEvaluator.calculate_brier_score(preds_wrong, actuals) == 1.0

    preds_guess = [0.5, 0.5, 0.5, 0.5]
    actuals_mix = [1, 0, 1, 0]
    assert BKTEvaluator.calculate_brier_score(preds_guess, actuals_mix) == 0.25


def test_auc_roc_math():
    """Verify AUC-ROC is 1.0 for perfect separation and 0.5 for random."""
    preds_perfect = [0.9, 0.8, 0.3, 0.2]
    actuals = [1, 1, 0, 0]
    assert BKTEvaluator.calculate_auc_roc(preds_perfect, actuals) == 1.0

    preds_inverted = [0.2, 0.3, 0.8, 0.9]
    assert BKTEvaluator.calculate_auc_roc(preds_inverted, actuals) == 0.0


def test_calibration_curve_and_ece():
    """Verify Expected Calibration Error (ECE) is bounded and computes reliability bins."""
    preds = [0.1, 0.2, 0.8, 0.9]
    actuals = [0, 0, 1, 1]
    ece, diagram = BKTEvaluator.calculate_calibration_curve(preds, actuals, num_bins=5)
    assert 0.0 <= ece <= 0.25
    assert len(diagram) == 5


def test_bkt_dataset_evaluation(benchmark_dataset):
    """Verifies BKT predictive evaluation runs over all synthetic traces."""
    evaluator = BKTEvaluator(benchmark_dataset)
    results = evaluator.evaluate_predictive_performance()
    assert results["metrics"]["brier_score"] < 0.25 # Beats uncalibrated guessing
    assert results["metrics"]["auc_roc"] > 0.50
    assert results["metrics"]["expected_calibration_error_ece"] < 0.25


# =====================================================================
# 4. POLICY SIMULATION & COMPARATIVE BASELINE TESTS
# =====================================================================

def test_pacing_adherence_check():
    """Verifies cognitive pacing order validation function."""
    valid_seq = [
        {"phase": "warmup"},
        {"phase": "core"},
        {"phase": "consolidation"}
    ]
    assert PolicyEvaluator._evaluate_pacing_adherence(valid_seq) == 1.0

    invalid_seq = [
        {"phase": "consolidation"},
        {"phase": "warmup"}
    ]
    assert PolicyEvaluator._evaluate_pacing_adherence(invalid_seq) == 0.0


def test_policy_simulation_budgets(benchmark_dataset):
    """Verifies all 6 policies execute across multiple time budgets."""
    evaluator = PolicyEvaluator(benchmark_dataset)
    results = evaluator.evaluate_all_policies(budgets=[15, 30], trials_per_policy=3)
    assert "15m" in results["results_by_budget"]
    assert "30m" in results["results_by_budget"]

    rec_util_30 = results["results_by_budget"]["30m"]["rec_01"]["mean_utility"]
    rand_util_30 = results["results_by_budget"]["30m"]["random"]["mean_utility"]
    assert rec_util_30 > rand_util_30 # REC-01 must outperform random
