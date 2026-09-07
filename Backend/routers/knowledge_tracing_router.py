from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from database.database import get_db
from models.database import User
from utils.auth import get_current_user
from services.knowledge_tracing_service import knowledge_tracing_service

router = APIRouter(prefix="/api/knowledge-tracing", tags=["Knowledge Tracing"])


class KnowledgeEventRequest(BaseModel):
    concept_name: str
    is_correct: bool
    response_time_ms: Optional[int] = 0
    interaction_type: Optional[str] = "custom"
    item_id: Optional[str] = None
    document_id: Optional[int] = None


@router.get("/concepts")
async def get_concept_mastery(
    document_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all concept mastery states for current user based on Bayesian Knowledge Tracing (KT-01).
    """
    return knowledge_tracing_service.get_student_concept_mastery(
        user_id=current_user.id,
        document_id=document_id,
        db=db
    )


@router.get("/recovery")
async def get_recovery_recommendations(
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get high-yield concept gaps prioritized by lowest latent mastery probability P(Known).
    """
    return knowledge_tracing_service.get_high_yield_recovery_concepts(
        user_id=current_user.id,
        limit=limit,
        db=db
    )


@router.post("/event")
async def record_learning_event(
    payload: KnowledgeEventRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually record an external learning interaction event to update BKT state.
    """
    return knowledge_tracing_service.update_knowledge_state(
        user_id=current_user.id,
        concept_name=payload.concept_name,
        is_correct=payload.is_correct,
        response_time_ms=payload.response_time_ms or 0,
        interaction_type=payload.interaction_type or "custom",
        item_id=payload.item_id,
        document_id=payload.document_id,
        db=db
    )
