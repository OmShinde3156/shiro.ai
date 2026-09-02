import pytest
from models.database import User, QuizResult, Document, FlashcardProgress
from services.progress_service import ProgressService
from utils.auth import create_access_token


@pytest.mark.asyncio
async def test_get_student_insights_schema(db):
    """Test that ProgressService.get_student_insights returns full learning health contract"""
    service = ProgressService()
    user_id = 1

    # Seed mock data
    doc = Document(user_id=user_id, filename="OS_Notes.pdf", file_type="pdf", subject="Operating Systems", text_content="CPU Scheduling...")
    db.add(doc)
    db.commit()

    db.add(QuizResult(user_id=user_id, document_id=doc.id, score=74, total_questions=5))
    db.commit()

    insights = await service.get_student_insights(user_id=user_id, db=db)

    # 0. Global Decision Center Fields
    assert "is_demo" in insights
    assert "headline_takeaway" in insights

    # 1. Learning Health
    health = insights["learning_health"]
    assert "overall_mastery" in health
    assert "mastery_change_pct" in health
    assert "quiz_accuracy" in health
    assert "retention_rate" in health
    assert "cards_retained" in health
    assert "total_study_time_minutes" in health
    assert "study_streak_days" in health

    # 2. Recommended Action
    rec = insights["recommended_action"]
    assert "topic" in rec
    assert "mastery_score" in rec
    assert "study_plan_steps" in rec
    assert "primary_tool" in rec
    assert "why_recommendation" in rec
    assert "action_payload" in rec

    # 3. Topic Matrix
    matrix = insights["topic_matrix"]
    assert len(matrix) > 0
    first_topic = matrix[0]
    assert "subject" in first_topic
    assert "mastery" in first_topic
    assert "status" in first_topic
    assert first_topic["status"] in ["Mastered", "Developing", "Needs Review", "Weak"]

    # 4. Performance Trend
    trend = insights["performance_trend"]
    assert "points" in trend
    assert len(trend["points"]) > 0

    # 5. Consistency & Cognitive Peak
    assert "consistency_grid" in insights
    assert len(insights["consistency_grid"]) == 7
    assert "cognitive_peak" in insights
    assert "confidence" in insights["cognitive_peak"]


def test_student_insights_endpoint_http(client, db):
    """Test GET /student-insights endpoint with JWT authentication"""
    user = db.query(User).filter(User.id == 1).first()
    token = create_access_token({"sub": str(user.id)})

    response = client.get(
        "/student-insights",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "learning_health" in data
    assert "recommended_action" in data
    assert "topic_matrix" in data
    assert "performance_trend" in data
