import pytest
import uuid
from decimal import Decimal
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from models.database import User, Document, AIRequestLog
from utils.auth import hash_password
from utils.llm_client import AIGateway, AIResult, QuizQuestion, QuizOption, QuizResponse
from utils.quality_gate import QualityGate, GroundingEvidence
from database.vector_db import VectorDB, BM25Index
from prompts.prompt_registry import prompt_registry
from services.chat_service import ChatService
from services.quiz_service import QuizService
from services.flashcard_service import FlashcardService


def create_test_user(db, user_id: int, email: str, name: str) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(
            id=user_id,
            name=name,
            email=email,
            password=hash_password("password123"),
            preferred_language="en",
            ai_quota_daily=50
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def create_test_document(db, user_id: int, title: str = "os.pdf") -> Document:
    doc = Document(
        filename=title,
        file_type="pdf",
        subject="Computer Science",
        text_content="A page fault is an interrupt raised by hardware when a program accesses a page not mapped in RAM. Operating systems manage CPU scheduling using round robin, memory management with paging, and file systems.",
        user_id=user_id,
        version=1
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@pytest.mark.asyncio
async def test_ai_gateway_telemetry_and_cost_accounting(db):
    """Test AI Gateway logs request_id, tokens, latency, cost, and rate card with Decimal precision (AI-01)"""
    user = create_test_user(db, 101, "gate2_telemetry@study.ai", "Telemetry User")
    gateway = AIGateway()
    
    result = await gateway.execute_with_governance(
        prompt="Explain virtual memory paging.",
        feature="quiz",
        prompt_version="v1.0",
        user_id=user.id,
        db=db
    )
    
    assert result.request_id is not None
    assert result.prompt_version == "v1.0"
    assert result.latency_ms >= 0
    assert result.cost_usd >= 0.0

    # Query logged telemetry in DB
    log = db.query(AIRequestLog).filter(AIRequestLog.request_id == result.request_id).first()
    assert log is not None
    assert log.user_id == user.id
    assert log.feature == "quiz"
    assert log.rate_card_version == "2026-Q3"
    assert log.prompt_version == "v1.0"
    assert log.cost_usd is not None


@pytest.mark.asyncio
async def test_ai_gateway_provider_fallback_telemetry(db):
    """Test provider fallback sets fallback_used=True and records telemetry"""
    user = create_test_user(db, 102, "gate2_fallback@study.ai", "Fallback User")
    gateway = AIGateway()
    
    # Mock Groq client to raise exception
    mock_groq = MagicMock()
    mock_groq.chat.completions.create.side_effect = Exception("Groq rate limit exceeded (429)")
    gateway.groq_client = mock_groq

    result = await gateway.execute_with_governance(
        prompt="What is process synchronization?",
        feature="chat",
        prompt_version="v1.0",
        user_id=user.id,
        db=db
    )

    assert result.fallback_used is True
    log = db.query(AIRequestLog).filter(AIRequestLog.request_id == result.request_id).first()
    assert log is not None
    assert log.fallback_used is True


def test_ai_quota_rejects_excessive_usage(db):
    """Test daily AI request quota enforcement (AI-01)"""
    from datetime import datetime
    user = create_test_user(db, 103, "gate2_quota@study.ai", "Quota User")
    user.ai_quota_daily = 2
    db.commit()

    gateway = AIGateway()

    # Ingest 2 previous logs for today
    for _ in range(2):
        log = AIRequestLog(
            request_id=str(uuid.uuid4()),
            user_id=user.id,
            feature="chat",
            provider="mock",
            model="mock",
            cost_usd=Decimal("0.0001"),
            created_at=datetime.utcnow()
        )
        db.add(log)
    db.commit()

    # Third check should raise 429 quota exceeded
    with pytest.raises(HTTPException) as exc_info:
        gateway.check_user_quota(user.id, db)
    assert exc_info.value.status_code == 429
    assert "quota" in exc_info.value.detail.lower()



def test_ai_gateway_bounded_json_repair_and_schema_validation():
    """Test dirty LLM JSON response with markdown code fences is cleaned and validated"""
    gateway = AIGateway()
    
    dirty_json = """```json
{
  "questions": [
    {
      "question": "What is a semaphore?",
      "options": {"A": "A synchronization variable", "B": "A compiler", "C": "A database", "D": "A monitor"},
      "correct_answer": "A",
      "explanation": "A semaphore is a synchronization primitive."
    }
  ]
}
```"""
    
    cleaned = gateway._clean_json_string(dirty_json)
    validated = QuizResponse.model_validate_json(cleaned)
    assert len(validated.questions) == 1
    assert validated.questions[0].correct_answer == "A"
    assert validated.questions[0].options.A == "A synchronization variable"


def test_hybrid_retrieval_rrf_and_reranking():
    """Test Hybrid Search (Dense + BM25) with Reciprocal Rank Fusion (RAG-01)"""
    vector_db = VectorDB()
    collection_name = f"test_coll_{uuid.uuid4().hex}"
    
    docs = [
        "Semaphores and mutexes are locking mechanisms used to avoid race conditions in concurrency.",
        "Photosynthesis is the process used by plants to convert light energy into chemical energy.",
        "Deadlock occurs when processes are blocked because each process holds a resource and waits for another.",
        "Relational databases use SQL for querying structured relational tabular data."
    ]
    metadatas = [
        {"chunk_id": "c1", "user_id": 1, "document_id": 10, "document_version": 1, "page_number": 1, "filename": "os.pdf"},
        {"chunk_id": "c2", "user_id": 1, "document_id": 10, "document_version": 1, "page_number": 2, "filename": "os.pdf"},
        {"chunk_id": "c3", "user_id": 1, "document_id": 10, "document_version": 1, "page_number": 3, "filename": "os.pdf"},
        {"chunk_id": "c4", "user_id": 1, "document_id": 10, "document_version": 1, "page_number": 4, "filename": "os.pdf"},
    ]

    vector_db.add_documents(collection_name, docs, metadatas, ids=["c1", "c2", "c3", "c4"])

    # Query specifically for concurrency locking semaphores
    results = vector_db.hybrid_search_with_rerank(
        collection_name=collection_name,
        query="concurrency locking semaphores race conditions",
        user_id=1,
        n_results=2
    )

    assert len(results) >= 1
    top_result = results[0]
    assert top_result["chunk_id"] == "c1"
    assert top_result["page_number"] == 1
    assert top_result["rrf_score"] > 0.0

    # Cleanup
    vector_db.delete_collection(collection_name)


def test_retrieval_level_tenant_isolation():
    """Test that User 2 cannot retrieve User 1 chunks in vector or BM25 retrieval (RAG-01)"""
    vector_db = VectorDB()
    collection_name = f"tenant_coll_{uuid.uuid4().hex}"
    
    docs = [
        "User 1 confidential financial data and private records.",
        "User 2 public computer science study notes."
    ]
    metadatas = [
        {"chunk_id": "u1_c1", "user_id": 1, "document_id": 1, "page_number": 1, "filename": "u1.pdf"},
        {"chunk_id": "u2_c1", "user_id": 2, "document_id": 2, "page_number": 1, "filename": "u2.pdf"},
    ]

    vector_db.add_documents(collection_name, docs, metadatas, ids=["u1_c1", "u2_c1"])

    # Query as User 2 for "confidential records"
    results = vector_db.hybrid_search_with_rerank(
        collection_name=collection_name,
        query="confidential records",
        user_id=2,
        n_results=5
    )

    # Must NOT return User 1's chunk
    for r in results:
        assert r["metadata"]["user_id"] == 2
        assert r["chunk_id"] != "u1_c1"

    # Cleanup
    vector_db.delete_collection(collection_name)


def test_document_version_isolation_in_retrieval():
    """Test retrieval filters by document_version for exact provenance"""
    vector_db = VectorDB()
    collection_name = f"version_coll_{uuid.uuid4().hex}"
    
    docs = [
        "Kernel v1 uses single monolithic scheduler.",
        "Kernel v2 uses completely fair scheduler with red-black tree."
    ]
    metadatas = [
        {"chunk_id": "doc1_v1", "user_id": 1, "document_id": 1, "document_version": 1, "page_number": 1, "filename": "os.pdf"},
        {"chunk_id": "doc1_v2", "user_id": 1, "document_id": 1, "document_version": 2, "page_number": 1, "filename": "os.pdf"},
    ]

    vector_db.add_documents(collection_name, docs, metadatas, ids=["doc1_v1", "doc1_v2"])

    # Query specifically for document_version=2
    results = vector_db.hybrid_search_with_rerank(
        collection_name=collection_name,
        query="scheduler",
        user_id=1,
        document_version=2,
        n_results=5
    )

    assert len(results) == 1
    assert results[0]["chunk_id"] == "doc1_v2"
    assert results[0]["document_version"] == 2

    # Cleanup
    vector_db.delete_collection(collection_name)


def test_bm25_rebuild_and_delete_lifecycle():
    """Test BM25 index builds, updates, rebuilds, and deletes cleanly"""
    vector_db = VectorDB()
    coll = f"lifecycle_{uuid.uuid4().hex}"

    docs = ["Operating systems manage hardware."]
    metas = [{"chunk_id": "c1", "user_id": 1}]

    vector_db.add_documents(coll, docs, metas, ids=["c1"])
    assert coll in vector_db.bm25_indices

    # Rebuild with new documents
    new_docs = ["Operating systems manage hardware.", "Distributed systems coordinate across networks."]
    new_metas = [{"chunk_id": "c1", "user_id": 1}, {"chunk_id": "c2", "user_id": 1}]
    vector_db.rebuild_bm25_index(coll, new_docs, new_metas)
    assert len(vector_db.bm25_indices[coll].corpus) == 2

    # Delete collection removes BM25 index
    vector_db.delete_collection(coll)
    assert coll not in vector_db.bm25_indices


@pytest.mark.asyncio
async def test_citation_provenance_from_chunk_metadata(db):
    """Test that chat citations are derived directly from chunk metadata (page_number, version, filename)"""
    user = create_test_user(db, 104, "gate2_citations@study.ai", "Citation User")
    doc = create_test_document(db, user.id, "os_concepts.pdf")
    chat_service = ChatService()
    
    # Add indexed chunk for document in vector DB
    vector_db = VectorDB()
    coll = f"doc_{doc.id}_{user.id}"
    doc.vector_db_id = coll
    db.commit()

    docs = ["A page fault is an interrupt raised by hardware when a program accesses a page not mapped in RAM."]
    metas = [{
        "chunk_id": f"doc_{doc.id}_v1_chunk_0",
        "document_id": doc.id,
        "document_version": doc.version,
        "user_id": user.id,
        "page_number": 7,
        "filename": doc.filename
    }]
    vector_db.add_documents(coll, docs, metas, ids=[metas[0]["chunk_id"]])

    response = await chat_service.chat_with_documents(
        user_id=user.id,
        message="What causes a page fault?",
        document_ids=[doc.id],
        language="en",
        db=db
    )

    assert "citations" in response
    citations = response["citations"]
    assert len(citations) >= 1
    cit = citations[0]
    assert cit["document_id"] == doc.id
    assert cit["page_number"] == 7
    assert cit["filename"] == doc.filename
    assert cit["chunk_id"] == f"doc_{doc.id}_v1_chunk_0"


def test_quality_gate_filters_unsupported_hallucinated_questions():
    """Test QualityGate rejects questions whose concepts are not grounded in source text (AI-02)"""
    source_text = "Operating systems manage CPU scheduling, memory management, and file systems."
    
    hallucinated_questions = [
        {
            "question": "Who was the Roman emperor during the eruption of Mount Vesuvius?",
            "options": {"A": "Titus", "B": "Nero", "C": "Augustus", "D": "Claudius"},
            "correct_answer": "A",
            "explanation": "Titus was the Roman emperor."
        }
    ]

    valid = QualityGate.validate_quiz_quality(
        questions=hallucinated_questions,
        source_text=source_text,
        min_grounding_score=0.25
    )

    assert len(valid) == 0 # Ungrounded question must be rejected!


def test_quality_gate_accepts_grounded_questions():
    """Test QualityGate accepts questions grounded in source text and returns grounding evidence"""
    source_text = "Operating systems manage CPU scheduling using round robin, memory management with paging, and file systems."
    
    grounded_questions = [
        {
            "question": "What algorithm is used for CPU scheduling in operating systems?",
            "options": {"A": "Round Robin", "B": "Bubble Sort", "C": "Dijkstra", "D": "Binary Search"},
            "correct_answer": "A",
            "explanation": "Operating systems use round robin for CPU scheduling."
        }
    ]

    valid = QualityGate.validate_quiz_quality(
        questions=grounded_questions,
        source_text=source_text,
        min_grounding_score=0.25
    )

    assert len(valid) == 1
    assert valid[0]["grounding_score"] >= 0.25
    assert "grounding_score" in valid[0]


def test_quality_gate_filters_invalid_options_and_keys():
    """Test QualityGate discards questions with missing options or invalid answer keys"""
    invalid_questions = [
        {
            # Missing Option D
            "question": "What is an operating system kernel?",
            "options": {"A": "Core component", "B": "Browser", "C": "Display"},
            "correct_answer": "A"
        },
        {
            # Invalid answer key 'E'
            "question": "What is virtual memory?",
            "options": {"A": "RAM extension", "B": "GPU", "C": "Disk", "D": "Cache"},
            "correct_answer": "E"
        }
    ]

    valid = QualityGate.validate_quiz_quality(questions=invalid_questions, source_text="Operating systems kernel and virtual memory.")
    assert len(valid) == 0


def test_quality_gate_deduplicates_flashcards_and_questions():
    """Test QualityGate eliminates duplicate questions and flashcards"""
    duplicate_cards = [
        {"question": "Kernel", "answer": "Core of the operating system."},
        {"question": "kernel", "answer": "Core part of OS."}, # Duplicate
        {"question": "Semaphore", "answer": "Synchronization tool."}
    ]

    valid = QualityGate.validate_flashcard_quality(
        flashcards=duplicate_cards,
        source_text="The kernel is the core of the operating system. A semaphore is a synchronization tool."
    )

    assert len(valid) == 2
    front_terms = [c["question"].lower() for c in valid]
    assert front_terms.count("kernel") == 1
