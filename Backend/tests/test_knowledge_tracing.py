import pytest
from services.knowledge_tracing_service import KnowledgeTracingService
from models.database import User, Document, LearnerConceptState, LearnerEventLog


@pytest.fixture
def bkt_service():
    return KnowledgeTracingService(
        default_p_l0=0.20,
        default_p_t=0.15,
        default_p_g=0.25,
        default_p_s=0.10,
        mastery_threshold=0.85
    )


def test_bkt_math_single_correct_observation(bkt_service):
    """
    Verify Corbett & Anderson BKT analytical correctness:
    P(L0) = 0.20, P(S) = 0.10, P(G) = 0.25, P(T) = 0.15
    obs = Correct (1)
    Posterior = (0.20 * 0.90) / (0.20 * 0.90 + 0.80 * 0.25) = 0.18 / 0.38 = ~0.47368
    Transition = 0.47368 + (1 - 0.47368) * 0.15 = ~0.5526
    """
    p_l = 0.20
    posterior = bkt_service.compute_posterior(p_l, is_correct=True)
    assert round(posterior, 4) == 0.4737

    p_next = bkt_service.compute_transition(posterior)
    assert round(p_next, 4) == 0.5526


def test_bkt_math_single_incorrect_observation(bkt_service):
    """
    Verify BKT incorrect observation update:
    obs = Incorrect (0)
    Posterior = (0.20 * 0.10) / (0.20 * 0.10 + 0.80 * 0.75) = 0.02 / 0.62 = ~0.03225
    Transition = 0.03225 + (1 - 0.03225) * 0.15 = ~0.1774
    """
    p_l = 0.20
    posterior = bkt_service.compute_posterior(p_l, is_correct=False)
    assert round(posterior, 4) == 0.0323

    p_next = bkt_service.compute_transition(posterior)
    assert round(p_next, 4) == 0.1774


def test_bkt_consecutive_success_mastery_convergence(bkt_service):
    """
    Four consecutive correct answers should systematically drive P(L) across the 0.85 mastery threshold.
    """
    p = 0.20
    trajectory = [p]
    for _ in range(4):
        post = bkt_service.compute_posterior(p, is_correct=True)
        p = bkt_service.compute_transition(post)
        trajectory.append(round(p, 4))

    # Expect: 0.20 -> ~0.5526 -> ~0.7891 -> ~0.9056 -> ~0.9582
    assert trajectory[0] == 0.20
    assert trajectory[1] > trajectory[0]
    assert trajectory[2] > trajectory[1]
    assert trajectory[3] > 0.85 # Crosses mastery threshold on 3rd-4th success
    assert trajectory[4] > 0.94


def test_bkt_slip_resilience(bkt_service):
    """
    A student with strong prior knowledge (e.g. 0.90) making 1 careless error
    should not have their knowledge estimate collapsed to 0 (bounded by P(Slip)).
    """
    p_high = 0.90
    post = bkt_service.compute_posterior(p_high, is_correct=False)
    p_after_slip = bkt_service.compute_transition(post)

    # Knowledge drops, but stays bounded (> 0.35), resilient to random slips
    assert p_after_slip > 0.35
    assert p_after_slip < p_high


def test_bkt_database_state_and_event_logging(db, bkt_service):
    """
    Tests end-to-end database persistence of concept state and immutable event logging.
    """
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(id=1, email="bkt_test@example.com", name="BKT Tester")
        db.add(user)
        db.commit()

    concept = "Deadlock Avoidance"

    # Turn 1: Correct Answer
    res1 = bkt_service.update_knowledge_state(
        user_id=1,
        concept_name=concept,
        is_correct=True,
        response_time_ms=5200,
        interaction_type="quiz",
        item_id="q_deadlock_1",
        db=db
    )

    assert res1["concept_name"] == "Deadlock Avoidance"
    assert res1["p_known_before"] == 0.20
    assert res1["p_known_after"] > 0.50
    assert res1["consecutive_correct"] == 1
    assert res1["total_opportunities"] == 1

    # Verify event logged
    log1 = db.query(LearnerEventLog).filter(
        LearnerEventLog.user_id == 1,
        LearnerEventLog.concept_name == "Deadlock Avoidance"
    ).first()
    assert log1 is not None
    assert log1.is_correct is True
    assert log1.p_known_after == res1["p_known_after"]

    # Turn 2: Another Correct Answer (Crosses toward mastery)
    res2 = bkt_service.update_knowledge_state(
        user_id=1,
        concept_name=concept,
        is_correct=True,
        response_time_ms=4800,
        interaction_type="quiz",
        item_id="q_deadlock_2",
        db=db
    )
    assert res2["consecutive_correct"] == 2
    assert res2["total_opportunities"] == 2
    assert res2["p_known_after"] > res1["p_known_after"]

    # Verify mastery summary API
    summary = bkt_service.get_student_concept_mastery(user_id=1, db=db)
    assert summary["total_concepts_tracked"] >= 1
    assert any(c["concept_name"] == "Deadlock Avoidance" for c in summary["concepts"])
