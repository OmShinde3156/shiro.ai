import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.database import get_db
from models.database import User
from utils.auth import get_current_user
from services.recommendation_service import recommendation_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommendations", tags=["Study Pathway & Recommendation Engine (REC-01)"])


# =========================================================================
# SCHEMAS
# =========================================================================

class PathwayGenerateRequest(BaseModel):
    duration_minutes: Optional[int] = Field(default=30, ge=15, le=120, description="Available study budget in minutes")
    mode: Optional[str] = Field(default="balanced", description="Mode: 'balanced', 'retention_rescue', 'mastery_sprint', 'exam_cram'")
    force_refresh: Optional[bool] = Field(default=False, description="Whether to bypass cache/hysteresis and re-roll")
    exam_date: Optional[str] = Field(default=None, description="ISO timestamp of upcoming target exam")


class StepCompleteRequest(BaseModel):
    pathway_id: str = Field(..., description="ID of active pathway")
    step_id: str = Field(..., description="ID of step being completed")
    duration_seconds: Optional[int] = Field(default=0, description="Actual time spent in seconds")
    client_step_id: Optional[str] = Field(default=None, description="Idempotency key")


class StepSkipRequest(BaseModel):
    pathway_id: str = Field(..., description="ID of active pathway")
    step_id: str = Field(..., description="ID of step to skip")


# =========================================================================
# ENDPOINTS
# =========================================================================

@router.post("/pathway", status_code=status.HTTP_200_OK)
def get_or_generate_pathway(
    request: PathwayGenerateRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates or retrieves an optimal multi-constraint study pathway.
    Respects recommendation stability (hysteresis) unless force_refresh is True.
    """
    parsed_exam = None
    if request.exam_date:
        try:
            parsed_exam = datetime.fromisoformat(request.exam_date.replace("Z", "+00:00"))
        except Exception:
            logger.warning(f"Could not parse exam_date '{request.exam_date}'")

    try:
        pathway = recommendation_service.get_or_create_pathway(
            user_id=current_user.id,
            duration_minutes=request.duration_minutes or 30,
            mode=request.mode or "balanced",
            force_refresh=bool(request.force_refresh),
            exam_date=parsed_exam,
            db=db
        )
        return pathway
    except Exception as e:
        logger.error(f"Error generating study pathway: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to generate study pathway: {str(e)}"
        )


@router.get("/pathway/active")
def get_active_pathway(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches the student's current active study pathway.
    """
    return recommendation_service.get_or_create_pathway(
        user_id=current_user.id,
        duration_minutes=30,
        mode="balanced",
        force_refresh=False,
        db=db
    )


@router.post("/pathway/step/complete")
def complete_pathway_step(
    request: StepCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Completes a step in the active pathway, logs telemetry, and triggers adaptive replanning.
    Idempotent via client_step_id.
    """
    try:
        updated_plan = recommendation_service.complete_step(
            user_id=current_user.id,
            pathway_id=request.pathway_id,
            step_id=request.step_id,
            duration_seconds=request.duration_seconds or 0,
            client_step_id=request.client_step_id,
            db=db
        )
        return updated_plan
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to complete pathway step: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/pathway/step/skip")
def skip_pathway_step(
    request: StepSkipRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Skips a step in the active pathway and advances to the next step.
    """
    try:
        return recommendation_service.skip_step(
            user_id=current_user.id,
            pathway_id=request.pathway_id,
            step_id=request.step_id,
            db=db
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to skip pathway step: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/quick-decision")
def get_quick_decision(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Rapid endpoint feeding the hero decision card ("What should I study right now?").
    """
    return recommendation_service.get_quick_decision(
        user_id=current_user.id,
        db=db
    )
