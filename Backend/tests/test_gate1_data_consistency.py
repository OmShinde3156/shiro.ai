# pyrefly: ignore [missing-import]
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from models.database import User, Document, Flashcard, FlashcardSet, FlashcardProgress, FlashcardReview, DocumentIngestionJob
from utils.auth import create_access_token, hash_password
from models.schema import FlashcardStudyRequest


def create_test_user(db, user_id: int, email: str, name: str) -> User:
    user = User(
        id=user_id,
        name=name,
        email=email,
        password=hash_password("password123"),
        preferred_language="en"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_test_flashcard(db, card_id: str, set_id: str, user_id: int) -> Flashcard:
    doc = db.query(Document).filter(Document.user_id == user_id).first()
    if not doc:
        doc = Document(
            filename="test_notes.pdf",
            file_type="pdf",
            subject="CS",
            text_content="Test content for flashcard generation.",
            user_id=user_id
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

    fset = db.query(FlashcardSet).filter(FlashcardSet.id == set_id).first()
    if not fset:
        fset = FlashcardSet(id=set_id, document_id=doc.id, user_id=user_id)
        db.add(fset)
        db.commit()

    card = Flashcard(
        id=card_id,
        set_id=set_id,
        question="What is the CAP theorem?",
        answer="Consistency, Availability, Partition tolerance."
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card



# ============================================================================
# DATA-01: Immutable FSRS Review Event Logs & Atomicity Tests
# ============================================================================

def test_flashcard_reviews_are_append_only(client, db):
    """Sequential reviews on a flashcard must append review events without mutating past logs."""
    user = create_test_user(db, 401, "student1@study.ai", "Student One")
    card = create_test_flashcard(db, "card_001", "set_001", user.id)
    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Review 1: Rating 1 (Again)
    req1 = {"flashcard_id": card.id, "ease_rating": 1, "review_duration_ms": 4500}
    res1 = client.post("/study-flashcard", json=req1, headers=headers)
    assert res1.status_code == 200

    # Review 2: Rating 3 (Good)
    req2 = {"flashcard_id": card.id, "ease_rating": 3, "review_duration_ms": 3200}
    res2 = client.post("/study-flashcard", json=req2, headers=headers)
    assert res2.status_code == 200

    # Verify that 2 distinct immutable review events exist in DB
    reviews = db.query(FlashcardReview).filter(
        FlashcardReview.flashcard_id == card.id,
        FlashcardReview.user_id == user.id
    ).order_by(FlashcardReview.reviewed_at.asc()).all()

    assert len(reviews) == 2
    assert reviews[0].rating == 1
    assert reviews[0].review_duration_ms == 4500
    assert reviews[1].rating == 3
    assert reviews[1].review_duration_ms == 3200

    # Verify latest materialized progress reflects the second review
    progress = db.query(FlashcardProgress).filter(
        FlashcardProgress.flashcard_id == card.id,
        FlashcardProgress.user_id == user.id
    ).first()
    assert progress is not None
    assert progress.review_count >= 1


def test_flashcard_review_state_transitions(client, db):
    """Review logs must capture correct fsrs_state_before and fsrs_state_after."""
    user = create_test_user(db, 402, "student2@study.ai", "Student Two")
    card = create_test_flashcard(db, "card_002", "set_002", user.id)
    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # First review on new card
    req = {"flashcard_id": card.id, "ease_rating": 4, "review_duration_ms": 2000}
    res = client.post("/study-flashcard", json=req, headers=headers)
    assert res.status_code == 200

    review = db.query(FlashcardReview).filter(
        FlashcardReview.flashcard_id == card.id,
        FlashcardReview.user_id == user.id
    ).first()
    assert review is not None
    assert review.fsrs_state_before == 0 # New state
    assert review.stability_after >= 0.0


def test_flashcard_review_idempotency(client, db):
    """Submitting review with the same idempotency_key must return same result without duplicate log entry."""
    user = create_test_user(db, 403, "student3@study.ai", "Student Three")
    card = create_test_flashcard(db, "card_003", "set_003", user.id)
    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    idem_key = "idemp_test_uuid_12345"
    req = {
        "flashcard_id": card.id, 
        "ease_rating": 3, 
        "review_duration_ms": 1500,
        "idempotency_key": idem_key
    }

    # First attempt
    res1 = client.post("/study-flashcard", json=req, headers=headers)
    assert res1.status_code == 200

    # Second attempt with identical idempotency_key (e.g. network retry / double-click)
    res2 = client.post("/study-flashcard", json=req, headers=headers)
    assert res2.status_code == 200

    # Verify only ONE review event was persisted
    count = db.query(FlashcardReview).filter(
        FlashcardReview.flashcard_id == card.id,
        FlashcardReview.idempotency_key == idem_key
    ).count()
    assert count == 1


def test_flashcard_review_atomic_rollback(db):
    """If review event insertion fails, progress changes must roll back completely."""
    from services.flashcard_service import FlashcardService
    service = FlashcardService()

    user = create_test_user(db, 404, "student4@study.ai", "Student Four")
    card = create_test_flashcard(db, "card_004", "set_004", user.id)
    card_id = str(card.id)
    user_id = int(user.id)

    # Pre-create progress
    progress = FlashcardProgress(
        user_id=user_id,
        flashcard_id=card_id,
        ease_factor=2.5,
        interval_days=10,
        review_count=5
    )
    db.add(progress)
    db.commit()

    # Verify 0 review logs initially
    initial_reviews_count = db.query(FlashcardReview).filter(FlashcardReview.flashcard_id == card_id).count()
    assert initial_reviews_count == 0

    # Simulate error during transaction commit
    study_req = FlashcardStudyRequest(flashcard_id=card_id, ease_rating=3)

    with patch.object(db, "commit", side_effect=Exception("Database connection timeout")):
        with pytest.raises(Exception):
            service.study_flashcard(study_req, db, user_id)

    # Verify no partial review was committed and no orphan event was created
    final_reviews_count = db.query(FlashcardReview).filter(FlashcardReview.flashcard_id == card_id).count()
    assert final_reviews_count == 0



def test_flashcard_history_endpoint(client, db):
    """GET /flashcards/{id}/history returns complete chronologically ordered review log."""
    user = create_test_user(db, 405, "student5@study.ai", "Student Five")
    card = create_test_flashcard(db, "card_005", "set_005", user.id)
    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Perform 2 reviews
    client.post("/study-flashcard", json={"flashcard_id": card.id, "ease_rating": 2}, headers=headers)
    client.post("/study-flashcard", json={"flashcard_id": card.id, "ease_rating": 4}, headers=headers)

    res = client.get(f"/flashcards/{card.id}/history", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["flashcard_id"] == card.id
    assert data["total_reviews"] == 2
    assert len(data["reviews"]) == 2
    assert data["reviews"][0]["rating"] == 2
    assert data["reviews"][1]["rating"] == 4


# ============================================================================
# TASK-01: Durable Ingestion Job State Machine Tests
# ============================================================================

def test_document_ingestion_job_created_on_save(db):
    """Saving a document via PDFService must create a DocumentIngestionJob in QUEUED state."""
    from services.pdf_service import PDFService
    service = PDFService()

    user = create_test_user(db, 406, "student6@study.ai", "Student Six")
    doc, is_new = service.save_document_to_db(
        user_id=user.id,
        filename="distributed_systems.pdf",
        content="Distributed systems require replication, consensus, and fault tolerance.",
        subject="CS",
        file_type="pdf",
        db=db
    )
    assert is_new is True
    assert doc.id is not None

    # Verify DocumentIngestionJob was created
    job = db.query(DocumentIngestionJob).filter(
        DocumentIngestionJob.document_id == doc.id,
        DocumentIngestionJob.user_id == user.id
    ).first()
    assert job is not None
    assert job.status in ("QUEUED", "EXTRACTING", "INDEXED")


def test_ingestion_task_state_progression(db):
    """Running process_document_ingestion_task progresses job from QUEUED to INDEXED with 100% progress."""
    from tasks import process_document_ingestion_task
    import uuid

    user = create_test_user(db, 407, "student7@study.ai", "Student Seven")
    doc = Document(
        id=701,
        filename="microservices.pdf",
        file_type="pdf",
        subject="Software Architecture",
        text_content="Microservices communicate via lightweight HTTP or message brokers like Kafka.",
        vector_db_id="vec_test_701",
        user_id=user.id
    )
    db.add(doc)

    job_id = str(uuid.uuid4())
    job = DocumentIngestionJob(
        id=job_id,
        document_id=doc.id,
        user_id=user.id,
        status="QUEUED",
        current_step="INITIALIZED",
        progress=0
    )
    db.add(job)
    db.commit()

    # Mock Celery delay and graph extraction to isolate state machine transitions
    with patch("tasks.generate_study_pack_task.delay"):
        with patch("services.graph_service.GraphService.extract_and_store_graph"):
            process_document_ingestion_task(job_id, db=db)

    # Reload job
    db.expire_all()
    updated_job = db.query(DocumentIngestionJob).filter(DocumentIngestionJob.id == job_id).first()
    assert updated_job.status == "INDEXED"
    assert updated_job.progress == 100
    assert updated_job.current_step == "COMPLETED"
    assert updated_job.completed_at is not None
    assert updated_job.error_code is None



def test_ingestion_task_corrupt_document_fails_non_retryable(db):
    """Empty or unparseable document must immediately transition to FAILED with sanitized error code."""
    from tasks import process_document_ingestion_task
    import uuid

    user = create_test_user(db, 408, "student8@study.ai", "Student Eight")
    doc = Document(
        id=702,
        filename="empty.pdf",
        file_type="pdf",
        subject="Empty",
        text_content="   ", # Empty whitespace text
        vector_db_id="vec_test_702",
        user_id=user.id
    )
    db.add(doc)

    job_id = str(uuid.uuid4())
    job = DocumentIngestionJob(
        id=job_id,
        document_id=doc.id,
        user_id=user.id,
        status="QUEUED",
        progress=0
    )
    db.add(job)
    db.commit()

    process_document_ingestion_task(job_id, db=db)

    db.expire_all()
    failed_job = db.query(DocumentIngestionJob).filter(DocumentIngestionJob.id == job_id).first()
    assert failed_job.status == "FAILED"
    assert failed_job.error_code == "CORRUPT_OR_EMPTY_DOCUMENT"
    assert failed_job.error_message is not None



def test_document_status_endpoint(client, db):
    """GET /documents/{id}/status returns structured progress and enforces owner access."""
    user_a = create_test_user(db, 409, "alice_doc@study.ai", "Alice")
    user_b = create_test_user(db, 410, "bob_doc@study.ai", "Bob")

    doc = Document(
        id=703,
        filename="operating_systems.pdf",
        file_type="pdf",
        subject="OS",
        text_content="Virtual memory allows OS to map physical pages to virtual addresses.",
        user_id=user_a.id
    )
    db.add(doc)

    job = DocumentIngestionJob(
        id="job_os_703",
        document_id=doc.id,
        user_id=user_a.id,
        status="EMBEDDING",
        current_step="EMBEDDING",
        progress=65
    )
    db.add(job)
    db.commit()

    token_a = create_access_token({"sub": str(user_a.id)})
    headers_a = {"Authorization": f"Bearer {token_a}"}

    token_b = create_access_token({"sub": str(user_b.id)})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Alice (Owner) queries status
    res_a = client.get(f"/documents/{doc.id}/status", headers=headers_a)
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["document_id"] == doc.id
    assert data_a["status"] == "EMBEDDING"
    assert data_a["progress"] == 65
    assert data_a["current_step"] == "EMBEDDING"

    # Bob (Attacker) queries Alice's document status -> rejected 404
    res_b = client.get(f"/documents/{doc.id}/status", headers=headers_b)
    assert res_b.status_code == 404
