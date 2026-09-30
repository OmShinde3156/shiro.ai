"""
Shiro v3.5: Master Benchmark Runner & CLI Orchestrator
Executes RAG, CAT, BKT, and Policy evaluation suites, generating
structured JSON artifacts and terminal executive summaries.
"""

import os
import sys
import io
import json
import time
import argparse
from typing import Dict, Any, Optional

# Add Backend root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from benchmarks.rag_evaluator import RAGEvaluator
from benchmarks.cat_evaluator import CATEvaluator
from benchmarks.bkt_evaluator import BKTEvaluator
from benchmarks.policy_evaluator import PolicyEvaluator

DATASET_PATH = os.path.join(os.path.dirname(__file__), "datasets", "benchmark_dataset.json")
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")
OUTPUT_PATH = os.path.join(RESULTS_DIR, "latest_benchmark.json")


class BenchmarkRunner:
    """Orchestrates multi-suite evaluation benchmarks."""

    def __init__(self, dataset_path: str = DATASET_PATH):
        self.dataset_path = dataset_path
        self.dataset = self._load_dataset()

    def _load_dataset(self) -> Dict[str, Any]:
        if not os.path.exists(self.dataset_path):
            from benchmarks.datasets.generate_dataset import generate_full_dataset
            data = generate_full_dataset()
            os.makedirs(os.path.dirname(self.dataset_path), exist_ok=True)
            with open(self.dataset_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            return data

        with open(self.dataset_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def run_all(self, quick_mode: bool = False) -> Dict[str, Any]:
        """Runs RAG, CAT, BKT, and Policy evaluations."""
        start_time = time.time()
        results: Dict[str, Any] = {
            "metadata": {
                "benchmark_version": "v3.5.0",
                "mode": "quick" if quick_mode else "full",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "duration_seconds": 0.0
            }
        }

        print("\n" + "=" * 80, flush=True)
        print("  SHIRO v3.5: SCIENTIFIC INTELLIGENCE BENCHMARK & EVALUATION SUITE", flush=True)
        print("=" * 80, flush=True)

        # 1. Hybrid RAG Evaluation
        print("\n[1/4] Running Hybrid RAG IR Evaluation...", flush=True)
        rag_eval = RAGEvaluator(self.dataset)
        rag_sample = 25 if quick_mode else 100
        rag_results = rag_eval.evaluate_retrieval(sample_size=rag_sample)
        results["rag_benchmark"] = rag_results
        print(f"  [OK] RAG Evaluation Complete: Recall@5={rag_results['pipelines']['hybrid_rrf']['recall@5']}% | MRR={rag_results['pipelines']['hybrid_rrf']['mrr']}", flush=True)

        # 2. CAT Psychometric Ability Recovery
        print("\n[2/4] Running 1PL Rasch Adaptive CAT Monte Carlo Recovery...", flush=True)
        cat_eval = CATEvaluator(self.dataset)
        cat_samples = 10 if quick_mode else 25
        cat_results = cat_eval.evaluate_cohorts(samples_per_stratum=cat_samples)
        results["cat_benchmark"] = cat_results
        print(f"  [OK] CAT Evaluation Complete: Adaptive RMSE={cat_results['policies']['adaptive']['rmse']} | Questions={cat_results['policies']['adaptive']['avg_questions_to_stop']}", flush=True)

        # 3. BKT Predictive Calibration
        print("\n[3/4] Running BKT Predictive Calibration & Brier Score Analysis...", flush=True)
        bkt_eval = BKTEvaluator(self.dataset)
        bkt_results = bkt_eval.evaluate_predictive_performance()
        results["bkt_benchmark"] = bkt_results
        print(f"  [OK] BKT Evaluation Complete: Brier Score={bkt_results['metrics']['brier_score']} | AUC={bkt_results['metrics']['auc_roc']} | ECE={bkt_results['metrics']['expected_calibration_error_ece']}", flush=True)

        # 4. REC-01 Multi-Constraint Policy Simulation
        print("\n[4/4] Running REC-01 Multi-Baseline Policy Simulation...", flush=True)
        policy_eval = PolicyEvaluator(self.dataset)
        policy_trials = 5 if quick_mode else 15
        policy_results = policy_eval.evaluate_all_policies(trials_per_policy=policy_trials)
        results["policy_benchmark"] = policy_results
        print(f"  [OK] Policy Simulation Complete: 45m Gain vs Random={policy_results['comparative_advantage_45m']['rec01_utility_gain_vs_random_pct']}% | Gain vs Greedy={policy_results['comparative_advantage_45m']['rec01_utility_gain_vs_greedy_roi_pct']}%", flush=True)

        elapsed = round(time.time() - start_time, 2)
        results["metadata"]["duration_seconds"] = elapsed

        # Persist results
        os.makedirs(RESULTS_DIR, exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)

        print("\n" + "=" * 80, flush=True)
        print(f"  ALL BENCHMARKS COMPLETED SUCCESSFULLY IN {elapsed}s", flush=True)
        print(f"  Results saved to: {OUTPUT_PATH}", flush=True)
        print("=" * 80 + "\n", flush=True)

        return results


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

    parser = argparse.ArgumentParser(description="Shiro v3.5 Evaluation Benchmark Runner")
    parser.add_argument("--suite", choices=["all", "rag", "cat", "bkt", "policy"], default="all", help="Suite to run")
    parser.add_argument("--quick", action="store_true", help="Quick mode with smaller Monte Carlo sample sizes")
    args = parser.parse_args()

    runner = BenchmarkRunner()
    if args.suite == "all":
        runner.run_all(quick_mode=args.quick)
    elif args.suite == "rag":
        rag = RAGEvaluator(runner.dataset).evaluate_retrieval(sample_size=30 if args.quick else 100)
        print(json.dumps(rag, indent=2))
    elif args.suite == "cat":
        cat = CATEvaluator(runner.dataset).evaluate_cohorts(samples_per_stratum=10 if args.quick else 25)
        print(json.dumps(cat, indent=2))
    elif args.suite == "bkt":
        bkt = BKTEvaluator(runner.dataset).evaluate_predictive_performance()
        print(json.dumps(bkt, indent=2))
    elif args.suite == "policy":
        pol = PolicyEvaluator(runner.dataset).evaluate_all_policies(trials_per_policy=5 if args.quick else 15)
        print(json.dumps(pol, indent=2))


if __name__ == "__main__":
    main()
