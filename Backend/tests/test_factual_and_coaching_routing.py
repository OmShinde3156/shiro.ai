# pyrefly: ignore [missing-import]
import pytest
import json
from sqlalchemy.orm import Session
from services.chat_service import ChatService
from models.database import User, Document, ChatHistory


async def _collect_sse_stream(stream_generator):
    events = []
    full_text = []
    async for sse_frame in stream_generator:
        lines = sse_frame.strip().split("\n")
        event_dict = {}
        for line in lines:
            if line.startswith("id:"):
                event_dict["id"] = int(line[3:].strip())
            elif line.startswith("event:"):
                event_dict["event"] = line[6:].strip()
            elif line.startswith("data:"):
                event_dict["data"] = json.loads(line[5:].strip())
        if event_dict:
            events.append(event_dict)
            if event_dict.get("event") == "token":
                full_text.append(event_dict.get("data", {}).get("delta", ""))
    return events, "".join(full_text)


@pytest.fixture(autouse=True)
def ensure_test_user(db: Session):
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        user = User(id=1, email="testuser_routing@shiro.ai", name="Routing Tester", password="hashed_test_password")
        db.add(user)
        db.commit()
    yield user


# ==============================================================================
# TEST A: General Factual (What is DBMS?)
# ==============================================================================
@pytest.mark.asyncio
async def test_a_general_factual_what_is_dbms(db: Session):
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="What is DBMS?",
            db=db,
            mode="human"
        )
    )
    done_event = next(e for e in events if e["event"] == "done")
    debug = done_event["data"]["metrics"].get("debug", {})

    print(f"\n[Test A] INTENT: {debug.get('intent')} | POLICY: {debug.get('refusal_policy')}")
    assert "couldn't verify that from this document" not in full_text.lower()
    assert any(w in full_text.lower() for w in ["database", "data", "management system", "organizes"])
    assert debug.get("document_required") is False
    assert debug.get("refusal_policy") != "document_refusal"


# ==============================================================================
# TEST B: Factual Follow-up (What is normalization in DBMS?)
# ==============================================================================
@pytest.mark.asyncio
async def test_b_factual_followup_normalization(db: Session):
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="What is normalization in DBMS?",
            db=db,
            mode="human"
        )
    )
    assert "couldn't verify that from this document" not in full_text.lower()
    assert any(w in full_text.lower() for w in ["redundancy", "anomaly", "table", "normal form", "organizing"])


# ==============================================================================
# TEST C: Task Action (Give me 5 DBMS questions)
# ==============================================================================
@pytest.mark.asyncio
async def test_c_task_action_give_5_questions(db: Session):
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="Give me 5 DBMS questions.",
            db=db,
            mode="human"
        )
    )
    done_event = next(e for e in events if e["event"] == "done")
    assert done_event["data"]["metrics"]["intent"] == "TASK_ACTION"
    assert "couldn't verify that from this document" not in full_text.lower()
    assert any(p in full_text for p in ["1.", "| 1 |", "1)", "1:"])
    assert any(p in full_text for p in ["5.", "| 5 |", "5)", "5:"])


# ==============================================================================
# TEST D: Explicit Teaching (Teach me normalization like a tutor)
# ==============================================================================
@pytest.mark.asyncio
async def test_d_explicit_teaching_normalization(db: Session):
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="Teach me normalization like a tutor.",
            db=db,
            mode="human"
        )
    )
    done_event = next(e for e in events if e["event"] == "done")
    assert done_event["data"]["metrics"]["intent"] in ["STUDY_COACHING", "EXPLANATION"]
    assert "couldn't verify that from this document" not in full_text.lower()
    assert any(w in full_text.lower() for w in ["normalization", "redundancy", "first normal form", "1nf", "table"])


# ==============================================================================
# TEST E: Explicit Document Query (Safeguard Preserved)
# ==============================================================================
@pytest.mark.asyncio
async def test_e_explicit_document_query_preserves_safeguard(db: Session):
    # Create mock document without DBMS content
    doc = db.query(Document).filter(Document.filename == "quantum_mechanics_intro.pdf").first()
    if not doc:
        doc = Document(
            user_id=1,
            filename="quantum_mechanics_intro.pdf",
            file_url="/mock/quantum.pdf",
            file_type="pdf",
            subject="Physics",
            text_content="Intro to quantum spin and wavefunctions."
        )
        db.add(doc)
        db.commit()

    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="According to this document, what is normalization?",
            document_ids=[doc.id],
            active_document_id=doc.id,
            db=db,
            mode="human"
        )
    )
    done_event = next(e for e in events if e["event"] == "done")
    # Intent MUST be DOCUMENT_QUESTION
    assert done_event["data"]["metrics"]["intent"] == "DOCUMENT_QUESTION"
    # Safeguard active: honestly states document does not contain it
    assert "couldn't verify that from this document" in full_text.lower()


# ==============================================================================
# TEST F: Document attached, but general knowledge question or negation
# ==============================================================================
@pytest.mark.asyncio
async def test_f_attached_document_does_not_gate_general_knowledge(db: Session):
    chat_service = ChatService()
    # Scenario 1: Negation "Ignore the document. What is quantum entanglement?"
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="Ignore the document. What is quantum entanglement?",
            db=db,
            mode="human"
        )
    )
    assert "which document are you referring to" not in full_text.lower()
    assert "couldn't verify that from this document" not in full_text.lower()
    assert any(w in full_text.lower() for w in ["quantum", "particles", "entangled", "state", "physics"])

    # Scenario 2: General question "What is the capital of Japan?" with attached doc
    events2, full_text2 = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="What is the capital of Japan?",
            db=db,
            mode="human"
        )
    )
    assert "couldn't verify that from this document" not in full_text2.lower()
    assert "tokyo" in full_text2.lower()


# ==============================================================================
# TEST G: Multi-turn GATE Exam Coaching Continuation
# ==============================================================================
@pytest.mark.asyncio
async def test_g_multiturn_gate_coaching_continuation(db: Session):
    chat_service = ChatService()
    # Turn 1: Initial query
    events1, full_text1 = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="My GATE exam is in February and my syllabus is huge.",
            db=db,
            mode="human"
        )
    )
    assert "couldn't verify that from this document" not in full_text1.lower()

    # Turn 2: User provides requested details
    events2, full_text2 = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="I can study 3 hours on weekdays and 6 hours on weekends. I'm weak in DBMS and OS but strong in programming.",
            db=db,
            mode="human"
        )
    )
    done_event = next(e for e in events2 if e["event"] == "done")
    debug = done_event["data"]["metrics"].get("debug", {})

    print(f"\n[Test G Turn 2] INTENT: {debug.get('intent')} | STATE: {debug.get('conversation_state')}")
    # Must NOT reset or refuse with document upload
    assert "couldn't verify that from this document" not in full_text2.lower()
    assert not full_text2.startswith("Please upload a file that contains your GATE syllabus")
    assert any(w in full_text2.lower() for w in ["hours", "weekdays", "weekends", "dbms", "os", "schedule", "plan", "programming"])


# ==============================================================================
# TEST H: Hypothetical Simulation (Pretend I took 10 quizzes...)
# ==============================================================================
@pytest.mark.asyncio
async def test_h_hypothetical_simulation_calculation(db: Session):
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="Pretend I took 10 quizzes with scores of 40, 50, 60, 70, 70, 75, 80, 80, 90, and 95. Analyze my performance.",
            db=db,
            mode="human"
        )
    )
    assert "couldn't verify that from this document" not in full_text.lower()
    # Should accurately calculate 71% average or evaluate progression
    assert any(pat in full_text for pat in ["71", "71%", "improving", "trend", "average", "progression"])


# ==============================================================================
# TEST I: Zero History Progress (Truthful without document refusal)
# ==============================================================================
@pytest.mark.asyncio
async def test_i_zero_history_truthful_reporting(db: Session):
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=99999,
            message="What is my current mastery of DBMS?",
            db=db,
            mode="human"
        )
    )
    # Must not say document refusal
    assert "couldn't verify that from this document" not in full_text.lower()
    assert any(w in full_text.lower() for w in ["recorded", "quiz history", "mastery data", "don't have any", "no recorded", "complete a quiz", "record of"])


# ==============================================================================
# TEST J: State Non-Contamination Sequence
# ==============================================================================
@pytest.mark.asyncio
async def test_j_conversation_state_non_contamination(db: Session):
    chat_service = ChatService()
    # Step 1: Tutor request
    await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="Teach me DBMS normalization.",
            db=db,
            mode="human"
        )
    )

    # Step 2: Factual query should not be forced into document refusal
    events2, full_text2 = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="What's the capital of Japan?",
            db=db,
            mode="human"
        )
    )
    assert "couldn't verify that from this document" not in full_text2.lower()
    assert "tokyo" in full_text2.lower()

    # Step 3: Next technical explanation
    events3, full_text3 = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="Now explain indexing.",
            db=db,
            mode="human"
        )
    )
    assert "couldn't verify that from this document" not in full_text3.lower()
    assert any(w in full_text3.lower() for w in ["index", "b-tree", "search", "lookup", "speed", "table", "pointer"])
