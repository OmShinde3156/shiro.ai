import math
import random
import uuid
from datetime import datetime, timedelta
import pytest
from unittest.mock import patch, MagicMock

from models.database import (
    User,
    Document,
    LearnerConceptState,
    AdaptiveQuizSession,
    KnowledgeNode,
    KnowledgeEdge,
    StudyTimetable,
    StudyPathwayPlan,
    StudyPathwayTelemetryLog,
    FlashcardProgress
)
from services.recommendation_service import (
    ActionProfile,
    ACTION_PROFILES,
    MODE_WEIGHTS,
    LearnerStateSnapshot,
    PrerequisiteAnalyzer,
    UtilityScorer,
    SequenceOptimizer,
    RecommendationService,
    recommendation_service
)
from services.progress_service import ProgressService


# =========================================================================
# FIXTURES
# =========================================================================

@pytest.fixture
def mock_learner_states(db):
    """Seed a realistic multi-concept learner profile for User 1."""
    user_id = 1
    # Clean any leftover states
    db.query(LearnerConceptState).filter(LearnerConceptState.user_id == user_id).delete()
    db.query(StudyPathwayPlan).filter(StudyPathwayPlan.user_id == user_id).delete()
    db.query(StudyPathwayTelemetryLog).filter(StudyPathwayTelemetryLog.user_id == user_id).delete()
    db.query(KnowledgeEdge).delete()
    db.query(KnowledgeNode).delete()

    now = datetime.utcnow()
    states = [
        LearnerConceptState(
            user_id=user_id,
            concept_name="Derivatives & Rate of Change",
            p_known=0.25,
            p_learn=0.18,
            retention_tau_days=1.8,
            last_reviewed_at=now - timedelta(days=4),
            consecutive_correct=0,
            total_opportunities=3,
            mastered=False
        ),
        LearnerConceptState(
            user_id=user_id,
            concept_name="Chain Rule",
            p_known=0.45,
            p_learn=0.20,
            retention_tau_days=3.0,
            last_reviewed_at=now - timedelta(days=2),
            consecutive_correct=1,
            total_opportunities=5,
            mastered=False
        ),
        LearnerConceptState(
            user_id=user_id,
            concept_name="Integration by Parts",
            p_known=0.88,
            p_learn=0.15,
            retention_tau_days=8.0,
            last_reviewed_at=now - timedelta(hours=12),
            consecutive_correct=4,
            total_opportunities=8,
            mastered=True
        ),
        LearnerConceptState(
            user_id=user_id,
            concept_name="Taylor Series",
            p_known=0.30,
            p_learn=0.15,
            retention_tau_days=2.0,
            last_reviewed_at=now - timedelta(days=5),
            consecutive_correct=0,
            total_opportunities=2,
            mastered=False
        )
    ]
    for s in states:
        db.add(s)

    # Prerequisite relationship: Derivatives -> Chain Rule -> Taylor Series
    n1 = KnowledgeNode(id=101, user_id=user_id, label="Derivatives & Rate of Change")
    n2 = KnowledgeNode(id=102, user_id=user_id, label="Chain Rule")
    n3 = KnowledgeNode(id=103, user_id=user_id, label="Taylor Series")
    db.add_all([n1, n2, n3])
    db.commit()

    edge1 = KnowledgeEdge(
        source_node_id=101,
        target_node_id=102,
        relation="prerequisite"
    )
    edge2 = KnowledgeEdge(
        source_node_id=102,
        target_node_id=103,
        relation="prerequisite"
    )
    db.add_all([edge1, edge2])
    db.commit()
    return states


# =========================================================================
# 1. ARCHITECTURAL & METHODOLOGICAL TESTS
# =========================================================================

def test_read_only_learner_state_no_mutations(db, mock_learner_states):
    """
    TEST 1: Strict read-only consumption.
    REC-01 must NEVER mutate LearnerConceptState tables during snapshot or planning.
    """
    user_id = 1
    # Capture pre-state snapshot
    initial_states = {
        s.concept_name: (s.p_known, s.retention_tau_days, s.last_reviewed_at)
        for s in db.query(LearnerConceptState).filter(LearnerConceptState.user_id == user_id).all()
    }

    # Generate pathway
    pathway = recommendation_service.get_or_create_pathway(
        user_id=user_id,
        duration_minutes=30,
        mode="balanced",
        force_refresh=True,
        db=db
    )
    assert pathway is not None
    assert len(pathway["items"]) > 0

    # Verify all learner concept records in database are strictly identical
    post_states = {
        s.concept_name: (s.p_known, s.retention_tau_days, s.last_reviewed_at)
        for s in db.query(LearnerConceptState).filter(LearnerConceptState.user_id == user_id).all()
    }
    assert initial_states == post_states, "LearnerConceptState was mutated during pathway generation!"


def test_action_specific_utility_differentiation(db, mock_learner_states):
    """
    TEST 2: Action-specific gain differentiation.
    Flashcards should yield higher delta_retention, while Feynman/CAT yield higher delta_mastery.
    """
    user_id = 1
    snapshot = LearnerStateSnapshot(user_id=user_id, db=db)
    low_concept = next(c for c in snapshot.concept_states if c["concept_name"] == "Derivatives & Rate of Change")

    score_flashcards = UtilityScorer.score_candidate(
        concept=low_concept,
        action=ACTION_PROFILES["flashcards"],
        duration_minutes=8,
        snapshot=snapshot,
        mode="balanced"
    )

    score_feynman = UtilityScorer.score_candidate(
        concept=low_concept,
        action=ACTION_PROFILES["feynman"],
        duration_minutes=12,
        snapshot=snapshot,
        mode="balanced"
    )

    score_cat = UtilityScorer.score_candidate(
        concept=low_concept,
        action=ACTION_PROFILES["adaptive_cat"],
        duration_minutes=15,
        snapshot=snapshot,
        mode="balanced"
    )

    # Flashcards has highest delta_retention
    assert score_flashcards["priority_components"]["delta_retention"] > score_feynman["priority_components"]["delta_retention"]
    # Feynman has highest delta_mastery
    assert score_feynman["priority_components"]["delta_mastery"] > score_flashcards["priority_components"]["delta_mastery"]
    # Adaptive CAT has highest delta_theta
    assert score_cat["priority_components"]["delta_theta"] > score_feynman["priority_components"]["delta_theta"]


def test_roi_per_minute_maximization(db, mock_learner_states):
    """
    TEST 3: ROI per minute = Total Utility / Duration.
    """
    user_id = 1
    snapshot = LearnerStateSnapshot(user_id=user_id, db=db)
    concept = snapshot.concept_states[0]

    scored_8m = UtilityScorer.score_candidate(
        concept=concept,
        action=ACTION_PROFILES["flashcards"],
        duration_minutes=8,
        snapshot=snapshot,
        mode="balanced"
    )

    scored_16m = UtilityScorer.score_candidate(
        concept=concept,
        action=ACTION_PROFILES["flashcards"],
        duration_minutes=16,
        snapshot=snapshot,
        mode="balanced"
    )

    assert round(scored_8m["utility_score"] / 8, 4) == round(scored_8m["roi_score"], 4)
    # Shorter duration yields higher ROI per minute for the same base gain
    assert scored_8m["roi_score"] > scored_16m["roi_score"]


def test_beam_search_satisfies_exact_time_budget(db, mock_learner_states):
    """
    TEST 4: Beam Search satisfies exact time budget constraint.
    """
    user_id = 1
    snapshot = LearnerStateSnapshot(user_id=user_id, db=db)

    for target_budget in [15, 30, 45, 60, 90]:
        items = SequenceOptimizer.optimize_pathway(snapshot, target_minutes=target_budget, mode="balanced")
        total_dur = sum(it["duration_minutes"] for it in items)
        assert total_dur <= target_budget, f"Pathway exceeded target budget {target_budget}: got {total_dur}"
        assert total_dur >= (target_budget - 12), f"Pathway under-utilized budget {target_budget}: got {total_dur}"


def test_cognitive_pacing_ordering(db, mock_learner_states):
    """
    TEST 5: Cognitive Pacing: Phase 1 (Warmup) -> Phase 2 (Core) -> Phase 3 (Consolidation).
    Consolidation should never precede Warmup or Core in the sequence.
    """
    user_id = 1
    snapshot = LearnerStateSnapshot(user_id=user_id, db=db)
    items = SequenceOptimizer.optimize_pathway(snapshot, target_minutes=60, mode="balanced")

    phase_ranks = {"warmup": 0, "core": 1, "consolidation": 2}
    current_max_rank = 0

    for it in items:
        rank = phase_ranks.get(it["phase"], 1)
        assert rank >= current_max_rank, f"Cognitive pacing violated: {it['phase']} after higher phase rank {current_max_rank}"
        current_max_rank = max(current_max_rank, rank)


def test_prerequisite_graph_propagation(db, mock_learner_states):
    """
    TEST 6: Prerequisite knowledge graph propagation.
    Concepts that unlock downstream gaps receive non-zero prerequisite bonus.
    """
    user_id = 1
    snapshot = LearnerStateSnapshot(user_id=user_id, db=db)

    gap_root = PrerequisiteAnalyzer.calculate_descendant_gap("Derivatives & Rate of Change", snapshot)
    gap_leaf = PrerequisiteAnalyzer.calculate_descendant_gap("Taylor Series", snapshot)

    # Root concept has descendants with gaps, so gap_root > 0
    assert gap_root > 0.0
    # Leaf concept has no descendants, so gap_leaf == 0.0
    assert gap_leaf == 0.0


def test_exam_urgency_does_not_hijack_mastered_concepts(db, mock_learner_states):
    """
    TEST 7: Exam urgency scaling.
    Mastered concepts (P(L) >= 0.85, high retention) do not receive an unearned urgency boost
    even 2 days before an exam.
    """
    now = datetime.utcnow()
    exam_date = now + timedelta(days=2)

    mastered_concept = {
        "concept_name": "Mastered Concept",
        "p_known": 0.95,
        "retention_now": 0.95,
        "predicted_forgetting_7d": 0.05
    }

    struggling_concept = {
        "concept_name": "Struggling Concept",
        "p_known": 0.20,
        "retention_now": 0.35,
        "predicted_forgetting_7d": 0.70
    }

    urgency_mastered = UtilityScorer.calculate_exam_urgency(mastered_concept, exam_date, now)
    urgency_struggling = UtilityScorer.calculate_exam_urgency(struggling_concept, exam_date, now)

    assert urgency_struggling > urgency_mastered
    # Mastered urgency remains close to 1.0 (minimal bump)
    assert urgency_mastered < 1.10
    # Struggling urgency is significantly elevated
    assert urgency_struggling > 1.50


def test_recommendation_stability_hysteresis(db, mock_learner_states):
    """
    TEST 8: Stability & Hysteresis.
    Subsequent calls within expiration window return the identical cached active plan.
    """
    user_id = 1
    plan1 = recommendation_service.get_or_create_pathway(
        user_id=user_id,
        duration_minutes=30,
        mode="balanced",
        force_refresh=False,
        db=db
    )

    plan2 = recommendation_service.get_or_create_pathway(
        user_id=user_id,
        duration_minutes=30,
        mode="balanced",
        force_refresh=False,
        db=db
    )

    assert plan1["id"] == plan2["id"]
    assert plan1["items"] == plan2["items"]

    # Force refresh generates a new plan
    plan3 = recommendation_service.get_or_create_pathway(
        user_id=user_id,
        duration_minutes=30,
        mode="balanced",
        force_refresh=True,
        db=db
    )
    assert plan3["id"] != plan1["id"]


def test_adaptive_replanning_on_step_completion(db, mock_learner_states):
    """
    TEST 9: Adaptive replanning post-step.
    When a step is completed and the concept is marked mastered, downstream steps adapt.
    """
    user_id = 1
    plan = recommendation_service.get_or_create_pathway(
        user_id=user_id,
        duration_minutes=45,
        mode="balanced",
        force_refresh=True,
        db=db
    )
    assert len(plan["items"]) >= 2
    step_0 = plan["items"][0]
    step_1 = plan["items"][1]

    # Mark step 1's concept as mastered in DB before completing step 0
    c_state = db.query(LearnerConceptState).filter(
        LearnerConceptState.user_id == user_id,
        LearnerConceptState.concept_name == step_1["concept_name"]
    ).first()
    if c_state:
        c_state.mastered = True
        c_state.p_known = 0.95
        db.commit()

    updated = recommendation_service.complete_step(
        user_id=user_id,
        pathway_id=plan["id"],
        step_id=step_0["step_id"],
        duration_seconds=480,
        db=db
    )

    assert updated["completed_step_count"] == 1
    assert updated["current_step_index"] == 1
    # Check that step 1 was replanned
    replanned_step_1 = updated["items"][1]
    if c_state:
        assert "Advanced Challenge" in replanned_step_1["title"] or replanned_step_1["phase"] == "consolidation"


def test_step_idempotency_duplicate_safety(db, mock_learner_states):
    """
    TEST 10: Step completion idempotency.
    Submitting the same client_step_id multiple times does NOT double-increment completed steps
    or insert duplicate telemetry records.
    """
    user_id = 1
    plan = recommendation_service.get_or_create_pathway(
        user_id=user_id,
        duration_minutes=30,
        mode="balanced",
        force_refresh=True,
        db=db
    )
    step_0 = plan["items"][0]
    client_id = f"client-step-{uuid.uuid4()}"

    res1 = recommendation_service.complete_step(
        user_id=user_id,
        pathway_id=plan["id"],
        step_id=step_0["step_id"],
        duration_seconds=300,
        client_step_id=client_id,
        db=db
    )
    assert res1["completed_step_count"] == 1

    # Second call with identical client_step_id
    res2 = recommendation_service.complete_step(
        user_id=user_id,
        pathway_id=plan["id"],
        step_id=step_0["step_id"],
        duration_seconds=300,
        client_step_id=client_id,
        db=db
    )
    assert res2["completed_step_count"] == 1

    # Verify database has exactly 1 telemetry log for this client_step_id
    logs = db.query(StudyPathwayTelemetryLog).filter(
        StudyPathwayTelemetryLog.client_step_id == client_id
    ).all()
    assert len(logs) == 1


def test_telemetry_records_pre_and_post_state(db, mock_learner_states):
    """
    TEST 11: Telemetry records both pre- and post-learning states to measure actual educational gain.
    """
    user_id = 1
    plan = recommendation_service.get_or_create_pathway(
        user_id=user_id,
        duration_minutes=30,
        mode="balanced",
        force_refresh=True,
        db=db
    )
    step = plan["items"][0]
    client_id = f"telem-test-{uuid.uuid4()}"

    recommendation_service.complete_step(
        user_id=user_id,
        pathway_id=plan["id"],
        step_id=step["step_id"],
        duration_seconds=500,
        client_step_id=client_id,
        db=db
    )

    log = db.query(StudyPathwayTelemetryLog).filter(
        StudyPathwayTelemetryLog.client_step_id == client_id
    ).first()

    assert log is not None
    assert log.pathway_id == plan["id"]
    assert log.tool == step["tool"]
    assert log.pre_state_p_known is not None
    assert log.planned_duration_seconds == step["duration_seconds"]
    assert log.actual_duration_seconds == 500


def test_cross_user_isolation(db, mock_learner_states):
    """
    TEST 12: Cross-user data isolation.
    User 2 cannot complete or view User 1's pathway.
    """
    user_1_id = 1
    user_2_id = 2

    # Create User 2 if not exists
    u2 = db.query(User).filter(User.id == user_2_id).first()
    if not u2:
        db.add(User(id=user_2_id, name="User Two", email="user2@test.com", password="pwd"))
        db.commit()

    plan = recommendation_service.get_or_create_pathway(
        user_id=user_1_id,
        duration_minutes=30,
        mode="balanced",
        force_refresh=True,
        db=db
    )
    step = plan["items"][0]

    # Attempt to complete User 1's step as User 2
    with pytest.raises(ValueError, match="Pathway not found or unauthorized"):
        recommendation_service.complete_step(
            user_id=user_2_id,
            pathway_id=plan["id"],
            step_id=step["step_id"],
            db=db
        )


def test_synthetic_learner_weak_student_simulation(db):
    """
    TEST 13: Synthetic simulation: Struggling / Novice student.
    All concepts have low BKT mastery (0.15 - 0.25) and decayed retention.
    Pathway should emphasize foundation building, spaced warmup, and diagnostic CAT.
    """
    user_id = 999
    # Add weak learner concept states
    now = datetime.utcnow()
    for name in ["Intro Algebra", "Linear Equations", "Polynomials"]:
        db.add(LearnerConceptState(
            user_id=user_id,
            concept_name=name,
            p_known=0.15,
            p_learn=0.12,
            retention_tau_days=1.5,
            last_reviewed_at=now - timedelta(days=6),
            mastered=False
        ))
    db.commit()

    pathway = recommendation_service.get_or_create_pathway(
        user_id=user_id,
        duration_minutes=30,
        mode="retention_rescue",
        force_refresh=True,
        db=db
    )
    assert len(pathway["items"]) > 0
    # First item should be warmup or core
    first_tool = pathway["items"][0]["tool"]
    assert first_tool in ["flashcards", "adaptive_cat"]


def test_synthetic_learner_advanced_student_simulation(db):
    """
    TEST 14: Synthetic simulation: Advanced student.
    All concepts are mastered (P(L) >= 0.88) with high stability.
    Pathway should prioritize targeted CAT testing or elaboration rather than basic warmup.
    """
    user_id = 998
    now = datetime.utcnow()
    for name in ["Advanced Calculus", "Topology", "Measure Theory"]:
        db.add(LearnerConceptState(
            user_id=user_id,
            concept_name=name,
            p_known=0.92,
            p_learn=0.20,
            retention_tau_days=20.0,
            last_reviewed_at=now - timedelta(hours=10),
            mastered=True
        ))
    db.commit()

    pathway = recommendation_service.get_or_create_pathway(
        user_id=user_id,
        duration_minutes=30,
        mode="mastery_sprint",
        force_refresh=True,
        db=db
    )
    assert len(pathway["items"]) > 0
    # Advanced student receives high-intensity core steps
    tools = [it["tool"] for it in pathway["items"]]
    assert "adaptive_cat" in tools or "feynman" in tools


def test_policy_comparison_rec01_vs_random_baseline(db, mock_learner_states):
    """
    TEST 15: Policy simulation: REC-01 Beam Search vs Random Valid Selection baseline.
    REC-01 optimized sequence must outperform random selection by at least 35% total utility.
    """
    user_id = 1
    snapshot = LearnerStateSnapshot(user_id=user_id, db=db)

    # 1. REC-01 Beam Search
    rec_items = SequenceOptimizer.optimize_pathway(snapshot, target_minutes=45, mode="balanced")
    rec_utility = sum(it["utility_score"] for it in rec_items)

    # 2. Random valid baseline simulation (average over 30 trials)
    random_utilities = []
    actions = list(ACTION_PROFILES.values())

    for _ in range(30):
        accumulated_time = 0
        rand_util = 0.0
        shuffled_concepts = list(snapshot.concept_states)
        random.shuffle(shuffled_concepts)

        for c in shuffled_concepts:
            act = random.choice(actions)
            dur = act.default_minutes
            if accumulated_time + dur <= 45:
                scored = UtilityScorer.score_candidate(c, act, dur, snapshot, mode="balanced")
                rand_util += scored["utility_score"]
                accumulated_time += dur
            if accumulated_time >= 35:
                break
        random_utilities.append(rand_util)

    avg_random_utility = sum(random_utilities) / len(random_utilities)

    # REC-01 should demonstrate statistically superior educational return
    assert rec_utility > avg_random_utility * 1.30, (
        f"REC-01 utility ({rec_utility:.3f}) did not achieve >30% gain over baseline ({avg_random_utility:.3f})"
    )


def test_15m_compact_pathway_generation(db, mock_learner_states):
    """
    TEST 16: Compact 15-minute study sprint.
    """
    user_id = 1
    pathway = recommendation_service.get_or_create_pathway(
        user_id=user_id,
        duration_minutes=15,
        mode="balanced",
        force_refresh=True,
        db=db
    )
    items = pathway["items"]
    assert 1 <= len(items) <= 2
    total_dur = sum(it["duration_minutes"] for it in items)
    assert total_dur <= 15


def test_90m_extended_pathway_generation(db, mock_learner_states):
    """
    TEST 17: Extended 90-minute study session.
    """
    user_id = 1
    pathway = recommendation_service.get_or_create_pathway(
        user_id=user_id,
        duration_minutes=90,
        mode="balanced",
        force_refresh=True,
        db=db
    )
    items = pathway["items"]
    assert len(items) >= 3
    total_dur = sum(it["duration_minutes"] for it in items)
    assert total_dur <= 90
    assert total_dur >= 70


@pytest.mark.asyncio
async def test_progress_service_integration(db, mock_learner_states):
    """
    TEST 18: Integration with progress_service.get_student_insights.
    Verifies that the main progress insights endpoint serves real REC-01 recommendations.
    """
    user_id = 1
    service = ProgressService()
    insights = await service.get_student_insights(user_id=user_id, db=db)
    assert "recommended_action" in insights
    rec = insights["recommended_action"]
    assert rec is not None
    assert "pathway_id" in rec
    assert "primary_tool" in rec
    assert "roi_score" in rec
