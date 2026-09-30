import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.database import get_db
from models.database import User
from utils.auth import get_current_user
from services.retention_service import retention_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/retention", tags=["Memory Retention & Forgetting Curve (FORGET-01)"])


# =========================================================================
# SCHEMAS
# =========================================================================

class MemoryBoosterRequest(BaseModel):
    max_concepts: Optional[int] = Field(default=4, ge=1, le=10, description="Max target concepts for booster")
    document_id: Optional[int] = Field(default=None, description="Optional target document filter")


class RetentionInteractionRequest(BaseModel):
    concept_name: str = Field(..., description="Concept evaluated")
    is_correct: bool = Field(..., description="Whether user answered correctly")
    interaction_type: Optional[str] = Field(default="quiz", description="Type of learning interaction")
    source_event_id: Optional[str] = Field(default=None, description="Client or item UUID")
    difficulty: Optional[float] = Field(default=5.0, ge=1.0, le=10.0, description="Estimated difficulty")


# =========================================================================
# ENDPOINTS
# =========================================================================

@router.get("/radar")
def get_retention_radar(
    exam_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the comprehensive Retention Decay Radar:
    - Retrievability R_now
    - Conditional 7-day attrition forecast P(forget next 7d)
    - Half-life in days
    - Multi-factor Urgency ranking (R_now, P_7d, Exam proximity, BKT gap)
    - Status categorization (Resilient, Decaying, Critical)
    """
    parsed_exam_date = None
    if exam_date:
        try:
            parsed_exam_date = datetime.fromisoformat(exam_date.replace("Z", "+00:00"))
        except Exception:
            logger.warning(f"Could not parse exam_date '{exam_date}'")

    return retention_service.scan_retention_radar(
        user_id=current_user.id,
        db=db,
        exam_date=parsed_exam_date
    )


@router.get("/at-risk")
def get_at_risk_concepts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns only concepts currently in decaying or critical attrition states.
    Used for rapid notifications and widget highlights.
    """
    radar = retention_service.scan_retention_radar(user_id=current_user.id, db=db)
    return {
        "at_risk_count": len(radar["at_risk_concepts"]),
        "projected_7d_loss_count": radar["projected_7d_loss_count"],
        "critical_count": radar["critical_count"],
        "decaying_count": radar["decaying_count"],
        "concepts": radar["at_risk_concepts"]
    }


@router.post("/boost", status_code=status.HTTP_201_CREATED)
async def create_memory_booster(
    request: Optional[MemoryBoosterRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Launches a targeted 1-click Memory Booster:
    Selects the highest-urgency decaying concepts and initializes an ADAPT-01 (CAT) session.
    """
    max_c = request.max_concepts if request else 4
    try:
        booster_session = await retention_service.create_memory_booster_session(
            user_id=current_user.id,
            db=db,
            max_concepts=max_c
        )
        return booster_session
    except Exception as e:
        logger.error(f"Failed to generate memory booster session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to launch memory booster: {str(e)}"
        )


@router.post("/record-interaction")
def record_retention_interaction(
    request: RetentionInteractionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Explicitly logs a concept interaction and updates the retention ledger.
    Applies session debouncing (30 min window).
    """
    try:
        result = retention_service.process_learning_interaction(
            user_id=current_user.id,
            concept_name=request.concept_name,
            is_correct=request.is_correct,
            interaction_type=request.interaction_type or "quiz",
            source_event_id=request.source_event_id,
            difficulty=request.difficulty,
            db=db
        )
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to record retention interaction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to record retention interaction: {str(e)}"
        )
