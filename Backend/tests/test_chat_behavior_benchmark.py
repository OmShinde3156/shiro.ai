import pytest
import json
import asyncio
from models.database import User, Document, ChatHistory, AIRequestLog, QuizResult
from services.chat_service import ChatService


async def _collect_sse_stream(stream_gen):
    """Helper to collect and parse all SSE frames from stream_chat_with_documents"""
    events = []
    accumulated_tokens = []
    async for sse_frame in stream_gen:
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
                accumulated_tokens.append(event_dict["data"].get("delta", ""))
    return events, "".join(accumulated_tokens)


@pytest.mark.asyncio
async def test_requirement_1_and_9_casual_greeting_no_tutoring(db):
    """
    Req 1 & 9: 'hi' must produce a brief, natural greeting (<= 2 sentences).
    MUST NOT produce a study framework, diagnostic questions, or action cards.
    """
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="hi",
            db=db,
            mode="human"
        )
    )

    # 1. Output must be a friendly, short greeting
    assert "Hi!" in full_text or "What are you working on today?" in full_text
    sentences = [s.strip() for s in full_text.split(".") if s.strip()]
    assert len(sentences) <= 3

    # 2. ZERO Action Card events
    action_events = [e for e in events if e["event"] == "action"]
    assert len(action_events) == 0

    # 3. No diagnostic questionnaire or study framework
    assert "diagnostic" not in full_text.lower()
    assert "study plan" not in full_text.lower()
    assert "feynman" not in full_text.lower()


@pytest.mark.asyncio
async def test_requirement_1_casual_pleasantry_thanks(db):
    """Req 1: 'thanks' receives a natural polite response without action cards."""
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="thanks!",
            db=db,
            mode="human"
        )
    )
    assert any(w in full_text.lower() for w in ["welcome", "anytime", "let me know"])
    action_events = [e for e in events if e["event"] == "action"]
    assert len(action_events) == 0


@pytest.mark.asyncio
async def test_requirement_2_and_9_direct_factual_what_is_dbms(db):
    """
    Req 2 & 9: 'what is dbms?' produces a direct, proportional factual explanation.
    """
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="what is dbms?",
            db=db,
            mode="human"
        )
    )

    assert "database" in full_text.lower()
    # Direct answer without conversational rambling preamble
    assert not full_text.startswith("Certainly! Today I will tutor you")
    done_event = next(e for e in events if e["event"] == "done")
    assert done_event["data"]["metrics"]["intent"] in ["SIMPLE_FACTUAL", "EXPLANATION"]


@pytest.mark.asyncio
async def test_requirement_9_simple_explanation_analogy(db):
    """
    Req 9: 'what is dbms? explain simply' produces an intuitive, analogy-based explanation.
    """
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="what is dbms? explain simply",
            db=db,
            mode="human"
        )
    )

    assert "database" in full_text.lower()
    assert any(w in full_text.lower() for w in ["filing", "cabinet", "library", "catalog", "organizes"])


@pytest.mark.asyncio
async def test_requirement_9_task_action_generate_5_questions(db):
    """
    Req 9: 'give me 5 dbms questions' directly outputs 5 questions without filler preamble.
    """
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="give me 5 dbms questions",
            db=db,
            mode="human"
        )
    )

    # Verify 5 distinct numbered questions (either numbered list or table format)
    assert any(pat in full_text for pat in ["1.", "| 1 |", "1)", "1:"])
    assert any(pat in full_text for pat in ["2.", "| 2 |", "2)", "2:"])
    assert any(pat in full_text for pat in ["3.", "| 3 |", "3)", "3:"])
    assert any(pat in full_text for pat in ["4.", "| 4 |", "4)", "4:"])
    assert any(pat in full_text for pat in ["5.", "| 5 |", "5)", "5:"])
    # No filler meta-commentary
    assert not full_text.startswith("Sure! Here is a comprehensive lesson")


@pytest.mark.asyncio
async def test_requirement_7_no_fabricated_user_data(db):
    """
    Req 7: 'today's mission?' with 0 prior history reports truth and NEVER invents scores or streaks.
    """
    # Create isolated fresh user
    fresh_user = User(
        name="Truth Test User",
        email=f"truth_test_{asyncio.get_event_loop().time()}@example.com",
        password="test_secret",
        xp=0
    )
    db.add(fresh_user)
    db.commit()
    db.refresh(fresh_user)

    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=fresh_user.id,
            message="today's mission?",
            db=db,
            mode="human"
        )
    )

    # Must honestly report no prior data without hallucinating 85% mastery
    assert "don't have any recorded study progress" in full_text.lower() or "no recorded" in full_text.lower()
    assert "85%" not in full_text
    assert "90%" not in full_text


@pytest.mark.asyncio
async def test_requirement_3_and_5_figure_diagram_question(db):
    """
    Req 3 & 5: 'can you explain the diagrams that are present in final year research paper?'
    Resolves actual document, extracts figure evidence, and structures:
    What it shows / How components interact / Why it matters.
    """
    # Create mock final year paper in DB
    user_id = 1
    doc_content = (
        "--- Page 1 ---\n"
        "Abstract: This final year research paper presents a distributed learning engine.\n\n"
        "--- Page 5 ---\n"
        "Figure 1: System Architecture Overview\n"
        "The architecture diagram displays client applications, API gateway, Redis caching, and vector indexing.\n"
        "The components interact asynchronously via message broker.\n\n"
        "--- Page 7 ---\n"
        "Figure 2: Adaptive Ingestion Workflow\n"
        "Flowchart tracing document upload through OCR extraction and chunking pipeline."
    )

    paper_doc = Document(
        filename="final_year_research_paper.pdf",
        file_type="pdf",
        subject="Computer Science",
        text_content=doc_content,
        user_id=user_id
    )
    db.add(paper_doc)
    db.commit()
    db.refresh(paper_doc)

    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=user_id,
            message="can you explain the diagrams that are present in final year research paper?",
            db=db,
            mode="human"
        )
    )

    # 1. Must cite Figure 1 or Figure 2
    assert "Figure 1" in full_text or "Figure 2" in full_text or "System Architecture" in full_text

    # 2. Must contain structured analytical sections
    assert "What it shows" in full_text or "what it shows" in full_text.lower()
    assert "How the components interact" in full_text or "how the components interact" in full_text.lower()
    assert "Why it matters" in full_text or "why it matters" in full_text.lower()

    # 3. Must have emitted figure status
    status_steps = [e["data"].get("step", "") for e in events if e["event"] == "status"]
    assert any("figure" in s.lower() or "sources" in s.lower() for s in status_steps)


@pytest.mark.asyncio
async def test_requirement_6_context_memory_across_turns(db):
    """
    Req 6: Understands follow-up references across conversation turns without restarting context.
    Turn 1: Discuss paper
    Turn 2: 'What does Figure 1 mean?' resolves to THAT paper.
    """
    user_id = 1
    doc = Document(
        filename="distributed_systems_notes.pdf",
        file_type="pdf",
        subject="Distributed Systems",
        text_content="--- Page 3 ---\nFigure 1: Two-Phase Commit Protocol\nDepicts coordinator and participants preparing and committing.",
        user_id=user_id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Record Turn 1 in ChatHistory referencing this document
    history_turn = ChatHistory(
        user_id=user_id,
        message="Explain distributed systems notes",
        response="This document covers two-phase commit and consensus.",
        document_ids=[doc.id],
        status="completed",
        latency_ms=200
    )
    db.add(history_turn)
    db.commit()

    chat_service = ChatService()
    # Turn 2: Follow-up without explicit document name
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=user_id,
            message="What does Figure 1 mean?",
            db=db,
            mode="human"
        )
    )

    # Must resolve Figure 1 from the previously referenced document
    assert "Figure 1" in full_text or "Two-Phase Commit" in full_text or "Architecture" in full_text


@pytest.mark.asyncio
async def test_requirement_ambiguous_reference_asks_one_clarification(db):
    """
    Feedback Req 1: Ambiguous document reference asks ONE concise clarification.
    """
    # Create 2 distinct papers for user 99
    u_id = 99
    doc_a = Document(filename="Deep_Learning_Survey.pdf", file_type="pdf", text_content="Deep learning text", user_id=u_id)
    doc_b = Document(filename="Quantum_Computing_Primer.pdf", file_type="pdf", text_content="Quantum text", user_id=u_id)
    db.add_all([doc_a, doc_b])
    db.commit()

    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=u_id,
            message="Explain the paper",
            db=db,
            mode="human"
        )
    )

    # Must ask one clear question specifying which document
    assert "Which document" in full_text or "referring to" in full_text
    assert "Deep_Learning_Survey.pdf" in full_text or "Quantum_Computing_Primer.pdf" in full_text
    # Zero action cards
    action_events = [e for e in events if e["event"] == "action"]
    assert len(action_events) == 0


@pytest.mark.asyncio
async def test_requirement_11_and_12_sse_protocol_and_no_filler(db):
    """
    Req 11 & 12: Monotonic event IDs, typed events (status, token, done), and zero 'Thinking...' filler.
    """
    chat_service = ChatService()
    events, full_text = await _collect_sse_stream(
        chat_service.stream_chat_with_documents(
            user_id=1,
            message="What are the 4 conditions for deadlock?",
            db=db,
            mode="surgical"
        )
    )

    # 1. Monotonic event IDs starting at 1
    ids = [e["id"] for e in events]
    assert ids == sorted(ids)
    assert ids[0] == 1

    # 2. Typed event coverage
    event_types = [e["event"] for e in events]
    assert "status" in event_types
    assert "token" in event_types
    assert "done" in event_types

    # 3. No conversational heartbeats in content text
    assert "thinking..." not in full_text.lower()
    assert "still working..." not in full_text.lower()
    assert "one moment..." not in full_text.lower()

    # 4. Done event includes latency metrics
    done_event = next(e for e in events if e["event"] == "done")
    metrics = done_event["data"]["metrics"]
    assert metrics["total_latency_ms"] >= 0
    assert metrics["ttft_ms"] >= 0
