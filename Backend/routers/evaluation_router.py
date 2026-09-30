"""
Shiro v3.5: Evaluation & Benchmark API Router
Exposes endpoints for querying research evaluation benchmarks and triggering on-demand runs.
"""

import os
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Dict, Any, Optional

from utils.auth import get_current_user
from models.database import User
from benchmarks.runner import BenchmarkRunner, OUTPUT_PATH, DATASET_PATH

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/evaluation", tags=["Evaluation & Benchmarks"])


@router.get("/benchmarks/latest")
def get_latest_benchmark_results(current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Retrieves the most recent scientific evaluation results across
    RAG, CAT, BKT, and REC-01 policy simulation.
    """
    if not os.path.exists(OUTPUT_PATH):
        # Generate on-demand if not yet computed
        try:
            runner = BenchmarkRunner()
            return runner.run_all(quick_mode=True)
        except Exception as e:
            logger.error(f"Error computing benchmarks on demand: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate evaluation benchmarks: {str(e)}")

    try:
        with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        logger.error(f"Failed to read benchmark results: {e}")
        raise HTTPException(status_code=500, detail="Failed to load benchmark results.")


@router.post("/benchmarks/run")
def trigger_benchmark_run(
    quick: bool = True,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Executes an evaluation benchmark run and returns updated metrics.
    """
    try:
        runner = BenchmarkRunner()
        results = runner.run_all(quick_mode=quick)
        return {
            "status": "success",
            "message": f"Benchmark run completed in {results['metadata']['duration_seconds']}s",
            "results": results
        }
    except Exception as e:
        logger.error(f"Error executing benchmark run: {e}")
        raise HTTPException(status_code=500, detail=f"Benchmark execution failed: {str(e)}")


@router.get("/dataset-summary")
def get_benchmark_dataset_summary(current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Returns high-level statistics about the Shiro v3.5 Evaluation Benchmark Dataset.
    """
    runner = BenchmarkRunner()
    ds = runner.dataset
    meta = ds.get("metadata", {})
    return {
        "name": meta.get("name"),
        "version": meta.get("version"),
        "document_count": meta.get("document_count"),
        "question_count": meta.get("total_questions"),
        "synthetic_traces_count": meta.get("total_traces"),
        "domains": [d["domain"] for d in ds.get("domains", [])],
        "concepts": [n["name"] for n in ds.get("knowledge_graph", {}).get("nodes", [])]
    }
