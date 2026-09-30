import math
import random
from datetime import datetime, timedelta
import pytest
from unittest.mock import patch, MagicMock

from services.retention_service import (
    RetentionPolicy,
    ExponentialRetentionModel,
    RetentionService
)
from models.database import (
    User,
    Document,
    LearnerConceptState,
    ConceptRetentionEvent
)


@pytest.fixture
def retention_model():
    return ExponentialRetentionModel()


@pytest.fixture
def retention_service_fixture():
    policy = RetentionPolicy(
        success_growth_factor=1.2,
        lapse_multiplier=0.40,
        minimum_tau_days=0.5,
        maximum_tau_days=365.0,
        critical_retention_threshold=0.60,
        decaying_retention_threshold=0.80,
        forecast_horizon_days=7.0,
        debounce_window_minutes=30,
        model_version="forget-v1"
    )
    return RetentionService(policy=policy, model=ExponentialRetentionModel())


# =========================================================================
# MATHEMATICAL INTEGRITY TESTS
# =========================================================================

def test_retrievability_at_zero_is_one(retention_model):
    """Verify R(0) = 1.0 and non-positive elapsed times are safely handled."""
    assert retention_model.retrievability(tau=5.0, elapsed_days=0.0) == 1.0
    assert retention_model.retrievability(tau=5.0, elapsed_days=-2.0) == 1.0


def test_retrievability_monotonic_decay(retention_model):
    """Verify R(t) monotonically decreases as elapsed days advance."""
    tau = 4.0
    days = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0, 15.0]
    r_vals = [retention_model.retrievability(tau, d) for d in days]

    for i in range(len(r_vals) - 1):
        assert r_vals[i] > r_vals[i + 1], f"Failed monotonicity at day {days[i]} -> {days[i+1]}"


def test_larger_tau_slower_decay(retention_model):
    """Verify larger time constant tau yields higher retrievability at same elapsed time."""
    elapsed = 5.0
    r_low_tau = retention_model.retrievability(tau=2.0, elapsed_days=elapsed)
    r_high_tau = retention_model.retrievability(tau=10.0, elapsed_days=elapsed)

    assert r_high_tau > r_low_tau
    assert r_high_tau > 0.60
    assert r_low_tau < 0.10


def test_retrievability_at_tau(retention_model):
    """Verify by mathematical definition that R(tau) = e^-1 ≈ 0.367879."""
    for tau in [1.0, 3.5, 12.0, 30.0]:
        r_at_tau = retention_model.retrievability(tau=tau, elapsed_days=tau)
        expected = math.exp(-1.0)
        assert abs(r_at_tau - expected) < 0.001


def test_half_life_identity(retention_model):
    """Verify half-life formula h = tau * ln(2) and R(h) == 0.50."""
    for tau in [1.5, 4.0, 10.0, 25.0]:
        h = retention_model.half_life(tau)
        r_at_h = retention_model.retrievability(tau=tau, elapsed_days=h)
        assert abs(r_at_h - 0.50) < 0.01


def test_conditional_7day_risk_formula(retention_model):
    """
    Verify conditional 7-day attrition probability:
    P(forget next 7d | retained at t) = 1 - e^(-7 / tau)
    This must be strictly independent of current elapsed t.
    """
    tau = 8.0
    horizon = 7.0
    expected_risk = 1.0 - math.exp(- (horizon / tau))

    risk = retention_model.conditional_forgetting_risk(tau, horizon_days=horizon)
    assert abs(risk - expected_risk) < 0.0001
    assert 0.0 < risk < 1.0

    # Risk must be independent of t
    r_t1 = retention_model.retrievability(tau, 3.0)
    r_t1_plus_7 = retention_model.retrievability(tau, 3.0 + 7.0)
    conditional_risk_at_t1 = 1.0 - (r_t1_plus_7 / r_t1)
    assert abs(risk - conditional_risk_at_t1) < 0.0001

    r_t2 = retention_model.retrievability(tau, 12.0)
    r_t2_plus_7 = retention_model.retrievability(tau, 12.0 + 7.0)
    conditional_risk_at_t2 = 1.0 - (r_t2_plus_7 / r_t2)
    assert abs(risk - conditional_risk_at_t2) < 0.0001


def test_randomized_monotonicity_stress(retention_model):
    """Stress test with 200 random samples across wide domain."""
    random.seed(42)
    for _ in range(200):
        tau = random.uniform(0.5, 50.0)
        t1 = random.uniform(0.01, 50.0)
        t2 = t1 + random.uniform(0.01, 30.0)

        r1 = retention_model.retrievability(tau, t1)
        r2 = retention_model.retrievability(tau, t2)

        assert 0.0 <= r1 <= 1.0
        assert 0.0 <= r2 <= 1.0
        assert r1 >= r2, f"Monotonicity violated for tau={tau}, t1={t1}, t2={t2}"


def test_stability_growth_on_spaced_recall(retention_service_fixture):
    """Successful recall after spaced decay expands tau."""
    model = retention_service_fixture.model
    policy = retention_service_fixture.policy

    initial_tau = 3.0
    elapsed_days = 2.0 # Substantial decay
    new_tau = model.update_after_recall(
        tau=initial_tau,
        elapsed_days=elapsed_days,
        difficulty=5.0,
        streak=2,
        policy=policy
    )
    assert new_tau > initial_tau


def test_stability_contraction_on_lapse(retention_service_fixture):
    """Memory lapse contracts tau toward minimum floor."""
    model = retention_service_fixture.model
    policy = retention_service_fixture.policy

    initial_tau = 10.0
    new_tau = model.update_after_lapse(
        tau=initial_tau,
        elapsed_days=2.0,
        difficulty=5.0,
        streak=0,
        policy=policy
    )
    assert new_tau == round(initial_tau * policy.lapse_multiplier, 3)
    assert new_tau < initial_tau

    # Verify floor enforcement
    low_tau = 0.8
    floored_tau = model.update_after_lapse(
        tau=low_tau,
        elapsed_days=1.0,
        difficulty=5.0,
        streak=0,
        policy=policy
    )
    assert floored_tau == policy.minimum_tau_days


# =========================================================================
# STATE & DATABASE TELEMETRY TESTS
# =========================================================================

def test_session_debouncing_prevents_inflation(db, retention_service_fixture):
    """
    Verifies that multiple answers to the same concept within 30 minutes
    do not inflate streak or balloon stability.
    """
    user_id = 1
    concept = "Debounced Process Scheduling"

    # 1. First interaction
    res1 = retention_service_fixture.process_learning_interaction(
        user_id=user_id,
        concept_name=concept,
        is_correct=True,
        interaction_type="quiz",
        source_event_id="q1",
        db=db
    )
    assert res1["streak"] == 1
    tau1 = res1["tau_after"]

    # 2. Rapid second interaction (same minute)
    res2 = retention_service_fixture.process_learning_interaction(
        user_id=user_id,
        concept_name=concept,
        is_correct=True,
        interaction_type="quiz",
        source_event_id="q2",
        db=db
    )
    assert res2["is_debounced"] is True
    assert res2["streak"] == 1 # Streak did not advance to 2
    assert res2["tau_after"] == tau1 # Tau did not inflate


def test_event_immutability_and_replay(db, retention_service_fixture):
    """
    Verifies ConceptRetentionEvent ledger records match materialized LearnerConceptState.
    """
    user_id = 1
    concept = "Memory Virtualization"

    # Step 1: Initial recall
    retention_service_fixture.process_learning_interaction(
        user_id=user_id,
        concept_name=concept,
        is_correct=True,
        interaction_type="quiz",
        source_event_id="ev_1",
        db=db
    )

    # Simulate 3 days passing
    state = db.query(LearnerConceptState).filter(
        LearnerConceptState.user_id == user_id,
        LearnerConceptState.concept_name == concept
    ).first()
    state.last_reviewed_at = datetime.utcnow() - timedelta(days=3)
    db.commit()

    # Step 2: Second recall after 3 days
    res2 = retention_service_fixture.process_learning_interaction(
        user_id=user_id,
        concept_name=concept,
        is_correct=True,
        interaction_type="flashcard",
        source_event_id="ev_2",
        db=db
    )

    # Check event ledger
    events = db.query(ConceptRetentionEvent).filter(
        ConceptRetentionEvent.user_id == user_id,
        ConceptRetentionEvent.concept_name == concept
    ).order_by(ConceptRetentionEvent.id).all()

    assert len(events) == 2
    assert events[0].interaction_type == "quiz"
    assert events[1].interaction_type == "flashcard"
    assert events[1].elapsed_days >= 2.9
    assert events[1].tau_after == res2["tau_after"]
    assert state.retention_tau_days == events[1].tau_after


def test_radar_urgency_ranking(db, retention_service_fixture):
    """
    Verifies that a concept suffering severe decay and high 7d risk
    ranks higher in urgency than a fresh concept.
    """
    user_id = 1
    now = datetime.utcnow()

    # Create fresh resilient concept
    c1 = LearnerConceptState(
        user_id=user_id,
        concept_name="Fresh Resilient Concept",
        retention_tau_days=10.0,
        last_reviewed_at=now - timedelta(hours=2),
        p_known=0.90
    )
    # Create decaying concept (elapsed 15 days on tau=3.0)
    c2 = LearnerConceptState(
        user_id=user_id,
        concept_name="Decaying Forgotten Concept",
        retention_tau_days=3.0,
        last_reviewed_at=now - timedelta(days=15),
        p_known=0.40
    )
    db.add_all([c1, c2])
    db.commit()

    radar = retention_service_fixture.scan_retention_radar(user_id=user_id, db=db)
    assert radar["total_concepts_tracked"] >= 2

    # Top urgency concept must be the decaying one
    top_concept = radar["all_concepts"][0]
    assert top_concept["concept_name"] == "Decaying Forgotten Concept"
    assert top_concept["category"] == "critical"
    assert top_concept["urgency_score"] > 0.60


def test_exam_proximity_boost(db, retention_service_fixture):
    """Verifies that an approaching exam date elevates concept urgency."""
    user_id = 1
    now = datetime.utcnow()

    c = LearnerConceptState(
        user_id=user_id,
        concept_name="Exam Concept",
        retention_tau_days=4.0,
        last_reviewed_at=now - timedelta(days=3),
        p_known=0.70
    )
    db.add(c)
    db.commit()

    far_exam = now + timedelta(days=60)
    near_exam = now + timedelta(days=2)

    radar_far = retention_service_fixture.scan_retention_radar(user_id=user_id, db=db, exam_date=far_exam)
    radar_near = retention_service_fixture.scan_retention_radar(user_id=user_id, db=db, exam_date=near_exam)

    urgency_far = radar_far["all_concepts"][0]["urgency_score"]
    urgency_near = radar_near["all_concepts"][0]["urgency_score"]

    assert urgency_near > urgency_far


@pytest.mark.asyncio
async def test_booster_triggers_adaptive_cat(db, retention_service_fixture):
    """
    Verifies that create_memory_booster_session gathers critical concepts
    and calls the adaptive CAT session starter.
    """
    user_id = 1
    now = datetime.utcnow()

    c = LearnerConceptState(
        user_id=user_id,
        concept_name="Deadlocks",
        retention_tau_days=2.0,
        last_reviewed_at=now - timedelta(days=7),
        p_known=0.30
    )
    db.add(c)
    db.commit()

    # Mock AdaptiveQuizService.start_adaptive_session to verify parameter contract
    mock_session_res = {
        "session_id": "mock-cat-session-123",
        "theta": 0.0,
        "first_question": {"id": "q1", "text": "What causes deadlock?"}
    }
    with patch(
        "services.adaptive_quiz_service.AdaptiveQuizService.start_adaptive_session",
        return_value=mock_session_res
    ) as mock_start:
        booster = await retention_service_fixture.create_memory_booster_session(user_id=user_id, db=db)

        assert booster["booster_type"] == "adaptive_cat"
        assert "Deadlocks" in booster["target_concepts"]
        assert booster["session"]["session_id"] == "mock-cat-session-123"
        mock_start.assert_called_once()


def test_cross_user_isolation(db, retention_service_fixture):
    """Verifies that User 1's retention events do not touch or leak into User 2's state."""
    user2 = db.query(User).filter(User.id == 2).first()
    if not user2:
        user2 = User(id=2, email="user2@example.com", name="User Two")
        db.add(user2)
        db.commit()

    # User 1 review
    retention_service_fixture.process_learning_interaction(
        user_id=1,
        concept_name="Shared Topic",
        is_correct=True,
        interaction_type="quiz",
        db=db
    )

    # User 2 state should still be empty
    user2_states = db.query(LearnerConceptState).filter(LearnerConceptState.user_id == 2).all()
    assert len(user2_states) == 0

    user2_events = db.query(ConceptRetentionEvent).filter(ConceptRetentionEvent.user_id == 2).all()
    assert len(user2_events) == 0
