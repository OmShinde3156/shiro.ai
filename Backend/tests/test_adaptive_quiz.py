import pytest
import math
from models.database import (
    User,
    Document,
    AdaptiveQuizItem,
    AdaptiveQuizSession,
    AdaptiveQuizResponse,
    LearnerConceptState
)
from services.adaptive_quiz_service import AdaptiveQuizService, adaptive_quiz_service


@pytest.fixture
def service():
    return AdaptiveQuizService()


# =========================================================================
# 1. MATHEMATICAL 1PL RASCH & FISHER INFORMATION TESTS
# =========================================================================

def test_rasch_probability_and_fisher_information(service):
    # Center: theta == b -> P == 0.5, Fisher Information maximum == 0.25
    p_center = service.calculate_rasch_probability(theta=0.0, b=0.0)
    assert round(p_center, 4) == 0.5000
    info_center = service.calculate_fisher_information(theta=0.0, b=0.0)
    assert round(info_center, 4) == 0.2500

    # Strong ability relative to item: theta = 1.0, b = 0.0 -> P = 1 / (1 + exp(-1)) = ~0.7311
    p_high = service.calculate_rasch_probability(theta=1.0, b=0.0)
    assert round(p_high, 4) == 0.7311
    assert service.calculate_fisher_information(theta=1.0, b=0.0) == pytest.approx(0.7311 * (1 - 0.7311), rel=1e-3)

    # Weak ability relative to item: theta = -1.0, b = 0.0 -> P = 1 / (1 + exp(1)) = ~0.2689
    p_low = service.calculate_rasch_probability(theta=-1.0, b=0.0)
    assert round(p_low, 4) == 0.2689

    # Numerical extremes should be bounded and not overflow
    assert service.calculate_rasch_probability(theta=100.0, b=-100.0) >= 0.9999
    assert service.calculate_rasch_probability(theta=-100.0, b=100.0) <= 0.0001


# =========================================================================
# 2. NEWTON-RAPHSON MAP ABILITY ESTIMATION TESTS
# =========================================================================

def test_ability_estimation_convergence(service):
    # Empty responses should preserve prior
    theta_0, se_0 = service.estimate_theta_map([], prior_mu=0.0, prior_sigma=1.0)
    assert theta_0 == 0.0
    assert se_0 == 1.0

    # 4 consecutive correct answers on standard items (b = 0.0) should increase ability monotonically
    responses_correct = [
        {"is_correct": True, "difficulty_b": 0.0},
        {"is_correct": True, "difficulty_b": 0.0},
        {"is_correct": True, "difficulty_b": 0.0},
        {"is_correct": True, "difficulty_b": 0.0}
    ]
    theta_up, se_up = service.estimate_theta_map(responses_correct, prior_mu=0.0, prior_sigma=1.0)
    assert theta_up > 0.80
    assert se_up < se_0 # SE must decrease as information accumulates

    # 4 consecutive incorrect answers should decrease ability monotonically
    responses_incorrect = [
        {"is_correct": False, "difficulty_b": 0.0},
        {"is_correct": False, "difficulty_b": 0.0},
        {"is_correct": False, "difficulty_b": 0.0},
        {"is_correct": False, "difficulty_b": 0.0}
    ]
    theta_down, se_down = service.estimate_theta_map(responses_incorrect, prior_mu=0.0, prior_sigma=1.0)
    assert theta_down < -0.80
    assert se_down < se_0


# =========================================================================
# 3. EMPIRICAL ITEM CALIBRATION TESTS
# =========================================================================

def test_empirical_item_calibration_update(db, service):
    item = AdaptiveQuizItem(
        id="calib_item_1",
        concept_name="Process Synchronization",
        question="What is a mutex?",
        options={"A": "Lock", "B": "Thread", "C": "File", "D": "Signal"},
        correct_answer="A",
        difficulty_prior=0.0,
        difficulty_estimate=0.0,
        response_count=0,
        correct_count=0
    )
    db.add(item)
    db.commit()

    # Step 1: 5 students with ability 1.0 answer incorrectly -> item is much harder than thought
    for _ in range(5):
        service.update_empirical_item_calibration(item, is_correct=False, theta_estimate=1.0, db=db)

    # Difficulty estimate should climb above the 0.0 prior
    assert item.response_count == 5
    assert item.correct_count == 0
    assert item.difficulty_estimate > 0.30

    # Step 2: 10 students with ability -0.5 answer correctly -> item difficulty adjusts downward
    for _ in range(10):
        service.update_empirical_item_calibration(item, is_correct=True, theta_estimate=-0.5, db=db)

    assert item.response_count == 15
    assert item.correct_count == 10
    assert item.difficulty_estimate < 0.50


# =========================================================================
# 4. MULTI-FACTOR ZPD ITEM SELECTION & CONTENT BALANCING TESTS
# =========================================================================

def test_zpd_multi_factor_selection(service):
    # Candidate items
    item_easy = AdaptiveQuizItem(id="i_easy", concept_name="Scheduling", question="Q1", options={}, correct_answer="A", difficulty_prior=-1.5, difficulty_estimate=-1.5)
    item_medium = AdaptiveQuizItem(id="i_med", concept_name="Scheduling", question="Q2", options={}, correct_answer="A", difficulty_prior=0.0, difficulty_estimate=0.0)
    item_hard = AdaptiveQuizItem(id="i_hard", concept_name="Scheduling", question="Q3", options={}, correct_answer="A", difficulty_prior=1.8, difficulty_estimate=1.8)

    candidates = [item_easy, item_medium, item_hard]

    # For a student with theta = 0.8:
    # item_medium (b=0.0) has P = 1 / (1 + exp(-0.8)) = ~0.69 (squarely in ZPD [0.65, 0.80])
    # item_easy (b=-1.5) has P = ~0.91 (too easy), item_hard (b=1.8) has P = ~0.27 (too hard)
    best = service.select_next_item(
        available_items=candidates,
        current_theta=0.8,
        session_responses=[],
        user_seen_item_ids=set(),
        bkt_mastery_map={}
    )
    assert best.id == "i_med"


def test_content_balancing_anti_clustering(service):
    # Setup candidates across 2 concepts
    item_c1_a = AdaptiveQuizItem(id="c1_a", concept_name="Deadlocks", question="Q1", options={}, correct_answer="A", difficulty_prior=0.0, difficulty_estimate=0.0)
    item_c1_b = AdaptiveQuizItem(id="c1_b", concept_name="Deadlocks", question="Q2", options={}, correct_answer="A", difficulty_prior=0.0, difficulty_estimate=0.0)
    item_c2_a = AdaptiveQuizItem(id="c2_a", concept_name="Virtual Memory", question="Q3", options={}, correct_answer="A", difficulty_prior=0.0, difficulty_estimate=0.0)

    candidates = [item_c1_a, item_c1_b, item_c2_a]

    # Simulate that the student already answered 2 questions in a row on "Deadlocks"
    r1 = AdaptiveQuizResponse(session_id="s1", user_id=1, question_id="c1_prev1", concept_name="Deadlocks", client_step_id="step1", selected_answer="A", is_correct=True, difficulty_b=0.0, theta_before=0.0, theta_after=0.2, se_before=1.0, se_after=0.8)
    r2 = AdaptiveQuizResponse(session_id="s1", user_id=1, question_id="c1_prev2", concept_name="Deadlocks", client_step_id="step2", selected_answer="A", is_correct=True, difficulty_b=0.0, theta_before=0.2, theta_after=0.4, se_before=0.8, se_after=0.7)

    # Content balancing should filter out "Deadlocks" and pick "Virtual Memory"
    selected = service.select_next_item(
        available_items=candidates,
        current_theta=0.4,
        session_responses=[r1, r2],
        user_seen_item_ids=set(),
        bkt_mastery_map={}
    )
    assert selected.concept_name == "Virtual Memory"
    assert selected.id == "c2_a"


# =========================================================================
# 5. DYNAMIC STOPPING CRITERIA TESTS
# =========================================================================

def test_dynamic_stopping_rules(service):
    session = AdaptiveQuizSession(
        id="s_stop",
        user_id=1,
        target_questions=10,
        min_questions=4,
        current_step=0
    )

    # Rule 1: Cannot stop before min_questions (even if SE is low)
    should_stop, _ = service.check_stopping_criteria(session, current_se=0.30, step_count=2, se_history=[0.8, 0.4, 0.3])
    assert should_stop is False

    # Rule 2: Stops when min_questions met and SE <= 0.35
    should_stop, reason = service.check_stopping_criteria(session, current_se=0.32, step_count=5, se_history=[0.8, 0.6, 0.45, 0.38, 0.32])
    assert should_stop is True
    assert reason == "SE_CONVERGED"

    # Rule 3: Stops when max questions reached
    should_stop, reason = service.check_stopping_criteria(session, current_se=0.48, step_count=10, se_history=[])
    assert should_stop is True
    assert reason == "MAX_QUESTIONS"


# =========================================================================
# 6. IDEMPOTENCY & DUPLICATE SUBMISSION SAFETY
# =========================================================================

def test_step_idempotency_duplicate_safety(db, service):
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(id=1, name="Idempotent Tester", email="idemp@example.com")
        db.add(user)
        db.commit()

    item1 = AdaptiveQuizItem(
        id="idem_q1",
        concept_name="CPU Scheduling",
        question="Shortest Job First is?",
        options={"A": "Optimal", "B": "Preemptive only", "C": "FIFO", "D": "Random"},
        correct_answer="A",
        difficulty_prior=0.0,
        difficulty_estimate=0.0
    )
    item2 = AdaptiveQuizItem(
        id="idem_q2",
        concept_name="Paging",
        question="Page table is located in?",
        options={"A": "Main memory", "B": "Disk", "C": "Cache", "D": "ROM"},
        correct_answer="A",
        difficulty_prior=0.5,
        difficulty_estimate=0.5
    )
    db.add_all([item1, item2])

    session = AdaptiveQuizSession(
        id="s_idemp",
        user_id=1,
        topic="Operating Systems",
        theta_estimate=0.0,
        standard_error=1.0,
        theta_history=[0.0],
        se_history=[1.0],
        target_questions=6,
        min_questions=4,
        current_step=0,
        is_completed=False,
        question_pool_ids=["idem_q1", "idem_q2"]
    )
    db.add(session)
    db.commit()

    client_step = "client_uuid_9999"

    # Turn 1: First submission
    step1 = service.submit_adaptive_step(
        session_id="s_idemp",
        question_id="idem_q1",
        client_step_id=client_step,
        selected_answer="A",
        response_time_ms=3200,
        user_id=1,
        db=db
    )
    assert step1["feedback"]["is_correct"] is True
    assert step1["step_index"] == 1

    # Turn 2: Exact duplicate submission (e.g. double click or network retry)
    step2 = service.submit_adaptive_step(
        session_id="s_idemp",
        question_id="idem_q1",
        client_step_id=client_step,
        selected_answer="A",
        response_time_ms=3200,
        user_id=1,
        db=db
    )

    # Must return identical step result without incrementing step_index
    assert step2["feedback"]["is_correct"] is True
    assert step2["step_index"] == 1

    # Total responses in database must still be exactly 1
    count = db.query(AdaptiveQuizResponse).filter(
        AdaptiveQuizResponse.session_id == "s_idemp"
    ).count()
    assert count == 1


# =========================================================================
# 7. SYNTHETIC LEARNER SIMULATION TESTS
# =========================================================================

def test_simulated_strong_learner(db, service):
    """
    Simulates a high-ability student answering 5 questions correctly.
    Proves theta climbs into Proficient/Master band and standard error narrows.
    """
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(id=1, name="Strong Learner", email="strong@example.com")
        db.add(user)
        db.commit()

    items = []
    for i in range(8):
        it = AdaptiveQuizItem(
            id=f"sim_strong_{i}",
            concept_name=f"Concept_{i % 3}",
            question=f"Question {i}",
            options={"A": "Ans", "B": "Wrong"},
            correct_answer="A",
            difficulty_prior=-0.8 + (i * 0.4), # Increasing difficulty
            difficulty_estimate=-0.8 + (i * 0.4)
        )
        items.append(it)
        db.add(it)

    session = AdaptiveQuizSession(
        id="s_sim_strong",
        user_id=1,
        theta_estimate=0.0,
        standard_error=1.0,
        theta_history=[0.0],
        se_history=[1.0],
        target_questions=6,
        min_questions=4,
        current_step=0,
        is_completed=False,
        question_pool_ids=[it.id for it in items]
    )
    db.add(session)
    db.commit()

    curr_item_id = "sim_strong_0"
    for step in range(5):
        res = service.submit_adaptive_step(
            session_id="s_sim_strong",
            question_id=curr_item_id,
            client_step_id=f"strong_step_{step}",
            selected_answer="A", # Always correct
            response_time_ms=4000,
            user_id=1,
            db=db
        )
        if res.get("is_completed"):
            break
        curr_item_id = res["next_question"]["id"]

    db.refresh(session)
    # Theta must have climbed significantly from 0.0
    assert session.theta_estimate > 0.75
    assert session.standard_error < session.se_history[0] # SE must decrease from 1.0
    assert session.standard_error < 0.80
    ability_band = session.final_ability_band or service.classify_ability_band(session.theta_estimate)
    assert ability_band in ["Proficient", "Master"]


def test_simulated_alternating_learner(db, service):
    """
    Simulates an average student alternating correct (1) and incorrect (0).
    Proves theta stabilizes near 0.0 with shrinking SE.
    """
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(id=1, name="Avg Learner", email="avg@example.com")
        db.add(user)
        db.commit()

    items = []
    for i in range(8):
        it = AdaptiveQuizItem(
            id=f"sim_alt_{i}",
            concept_name=f"AltConcept_{i % 2}",
            question=f"Alt Question {i}",
            options={"A": "Correct", "B": "Wrong"},
            correct_answer="A",
            difficulty_prior=0.0,
            difficulty_estimate=0.0
        )
        items.append(it)
        db.add(it)

    session = AdaptiveQuizSession(
        id="s_sim_alt",
        user_id=1,
        theta_estimate=0.0,
        standard_error=1.0,
        theta_history=[0.0],
        se_history=[1.0],
        target_questions=6,
        min_questions=4,
        current_step=0,
        is_completed=False,
        question_pool_ids=[it.id for it in items]
    )
    db.add(session)
    db.commit()

    curr_item_id = "sim_alt_0"
    for step in range(5):
        # Alternate correct ('A') and incorrect ('B')
        ans = "A" if (step % 2 == 0) else "B"
        res = service.submit_adaptive_step(
            session_id="s_sim_alt",
            question_id=curr_item_id,
            client_step_id=f"alt_step_{step}",
            selected_answer=ans,
            response_time_ms=3500,
            user_id=1,
            db=db
        )
        if res.get("is_completed"):
            break
        curr_item_id = res["next_question"]["id"]

    db.refresh(session)
    # Theta should stabilize near 0.0 (between -0.5 and +0.5)
    assert -0.60 <= session.theta_estimate <= 0.60
    assert session.standard_error < 0.70


def test_cross_user_isolation(db, service):
    """
    Verifies that User B cannot submit responses to User A's active adaptive session.
    """
    session = AdaptiveQuizSession(
        id="s_user1_secure",
        user_id=1,
        topic="Security",
        theta_estimate=0.0,
        standard_error=1.0,
        theta_history=[0.0],
        se_history=[1.0],
        target_questions=5,
        min_questions=4,
        current_step=0,
        is_completed=False,
        question_pool_ids=[]
    )
    db.add(session)
    db.commit()

    with pytest.raises(Exception) as exc_info:
        service.submit_adaptive_step(
            session_id="s_user1_secure",
            question_id="some_q",
            client_step_id="hack_step_1",
            selected_answer="A",
            response_time_ms=1000,
            user_id=999, # Mismatched user
            db=db
        )

    assert "unauthorized" in str(exc_info.value).lower() or "not found" in str(exc_info.value).lower()
