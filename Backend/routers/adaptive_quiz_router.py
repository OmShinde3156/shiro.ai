import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.database import get_db
from models.database import User, AdaptiveQuizSession
from utils.auth import get_current_user, get_authorized_document
from services.adaptive_quiz_service import adaptive_quiz_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quiz/adaptive", tags=["Adaptive Assessment (CAT)"])


# =========================================================================
# SCHEMAS
# =========================================================================

class AdaptiveStartRequest(BaseModel):
    document_id: Optional[int] = Field(default=None, description="Target document ID if studying a specific file")
    topic: Optional[str] = Field(default=None, description="Topic or concept to assess (e.g. 'Operating Systems - Deadlocks')")
    num_questions: Optional[int] = Field(default=10, ge=4, le=15, description="Max questions for this adaptive run")


class AdaptiveStepRequest(BaseModel):
    session_id: str = Field(..., description="Active adaptive quiz session ID")
    question_id: str = Field(..., description="ID of question being answered")
    client_step_id: str = Field(..., description="Idempotency key per step to prevent duplicate submissions")
    selected_answer: str = Field(..., description="User's selected option key ('A', 'B', 'C', or 'D')")
    response_time_ms: Optional[int] = Field(default=0, description="Response time in milliseconds")


# =========================================================================
# ENDPOINTS
# =========================================================================

@router.post("/start", status_code=status.HTTP_201_CREATED)
async def start_adaptive_session(
    request: AdaptiveStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Initializes a Computerized Adaptive Testing session:
    - Seeds initial ability \theta_0 from student's Bayesian Knowledge Tracing state
    - Prepares calibrated question bank with 1PL difficulty priors
    - Selects optimal opening question targeting the student's Zone of Proximal Development
    """
    try:
        if request.document_id:
            get_authorized_document(request.document_id, current_user.id, db)

        session_data = await adaptive_quiz_service.start_adaptive_session(
            user_id=current_user.id,
            document_id=request.document_id,
            topic=request.topic,
            num_questions=request.num_questions or 10,
            db=db
        )
        return session_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start adaptive quiz session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/step")
async def submit_adaptive_step(
    request: AdaptiveStepRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits student response for current step:
    - Verifies step idempotency (client_step_id)
    - Updates latent ability \theta via 1PL Rasch Maximum A Posteriori estimation
    - Updates empirical item calibration difficulty
    - Updates granular concept mastery in Bayesian Knowledge Tracing (KT-01)
    - Dynamically evaluates stopping rules (SE < 0.35, max questions)
    - Returns feedback, updated ability band, and next ZPD question or diagnostic report
    """
    try:
        result = adaptive_quiz_service.submit_adaptive_step(
            session_id=request.session_id,
            question_id=request.question_id,
            client_step_id=request.client_step_id,
            selected_answer=request.selected_answer,
            response_time_ms=request.response_time_ms or 0,
            user_id=current_user.id,
            db=db
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process adaptive step: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/session/{session_id}")
async def get_adaptive_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves full details, ability trajectory, and diagnostic report for an adaptive session
    """
    try:
        return adaptive_quiz_service.get_session_details(
            session_id=session_id,
            user_id=current_user.id,
            db=db
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/history")
async def get_adaptive_history(
    limit: int = 15,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves history of past adaptive assessments for the authenticated student
    """
    sessions = (
        db.query(AdaptiveQuizSession)
        .filter(AdaptiveQuizSession.user_id == current_user.id)
        .order_by(AdaptiveQuizSession.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "session_id": s.id,
            "topic": s.topic,
            "document_id": s.document_id,
            "is_completed": s.is_completed,
            "current_step": s.current_step,
            "target_questions": s.target_questions,
            "final_theta": round(s.theta_estimate, 3),
            "final_se": round(s.standard_error, 3),
            "ability_band": s.final_ability_band or adaptive_quiz_service.classify_ability_band(s.theta_estimate),
            "stopping_reason": s.stopping_reason,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None
        }
        for s in sessions
    ]
