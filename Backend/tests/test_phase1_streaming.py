import pytest
import json
import asyncio
from models.database import User, Document, ChatHistory, AIRequestLog
from services.chat_service import ChatService
from utils.llm_client import llm_client
from utils.auth import create_access_token


@pytest.mark.asyncio
async def test_stream_with_governance_yields_tokens_and_metrics(db):
    """Test that stream_with_governance yields tokens, computes TTFT, and creates AIRequestLog in finally"""
    prompt = "Explain deadlock in simple terms"
    tokens = []
    done_payload = None

    async for chunk in llm_client.stream_with_governance(prompt=prompt, user_id=1, db=db):
        if chunk["type"] == "token":
            tokens.append(chunk["delta"])
            assert "ttft_ms" in chunk
        elif chunk["type"] == "done":
            done_payload = chunk

    assert len(tokens) > 0
    assert done_payload is not None
    assert done_payload["metrics"]["success"] is True
    assert done_payload["metrics"]["ttft_ms"] >= 0

    # Verify AIRequestLog was durably recorded
    log = db.query(AIRequestLog).filter(AIRequestLog.user_id == 1).order_by(AIRequestLog.created_at.desc()).first()
    assert log is not None
    assert log.input_tokens > 0
    assert log.output_tokens > 0


@pytest.mark.asyncio
async def test_stream_chat_with_documents_event_contract(db):
    """Test that stream_chat_with_documents adheres to the Frozen Event Contract"""
    chat_service = ChatService()
    user_id = 1
    message = "What are the 4 conditions for deadlock?"

    events = []
    async for sse_frame in chat_service.stream_chat_with_documents(
        user_id=user_id,
        message=message,
        document_ids=[],
        language="en",
        db=db,
        mode="surgical"
    ):
        # Parse SSE frame: id, event, data
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

    event_types = [e["event"] for e in events]
    assert "status" in event_types
    assert "token" in event_types
    assert "done" in event_types
    assert "action" in event_types

    # Verify monotonic event IDs
    ids = [e["id"] for e in events]
    assert ids == sorted(ids)
    assert ids[0] == 1

    # Verify action handoff structure
    action_event = next(e for e in events if e["event"] == "action")
    handoff = action_event["data"]["handoff"]
    assert handoff["tool"] in ["quiz", "flashcards", "feynman", "mindmap"]
    assert "topic" in handoff
    assert "summary" in handoff
    assert "difficulty" in handoff

    # Verify history entry in DB
    chat_entry = db.query(ChatHistory).filter(ChatHistory.user_id == user_id).order_by(ChatHistory.timestamp.desc()).first()
    assert chat_entry is not None
    assert chat_entry.status == "completed"
    assert chat_entry.latency_ms > 0


def test_deterministic_context_token_budget(db):
    """Test that _build_deterministic_context respects token constraints"""
    chat_service = ChatService()
    user_id = 1

    # Insert 15 mock chat history turns
    for i in range(15):
        db.add(ChatHistory(
            user_id=user_id,
            message=f"Question {i}: " + ("text " * 30),
            response=f"Answer {i}: " + ("detailed explanation " * 30),
            language="en",
            status="completed"
        ))
    db.commit()

    context_data = chat_service._build_deterministic_context(
        user_id=user_id,
        message="What is paging in operating systems?",
        document_ids=[],
        db=db,
        max_evidence_tokens=1400,
        max_history_tokens=1000,
        max_summary_tokens=600
    )

    context_text = context_data["context_text"]
    total_tokens = chat_service._estimate_tokens(context_text)

    # Must stay within total budget
    assert total_tokens < 3000
    assert "PREVIOUS SESSION TOPIC SUMMARY:" in context_text
    assert "RECENT CONVERSATION TURNS:" in context_text


def test_chat_stream_endpoint_http(client, db):
    """Test POST /chat/stream HTTP endpoint returns text/event-stream"""
    user = db.query(User).filter(User.id == 1).first()
    token = create_access_token({"sub": user.email, "id": user.id})

    payload = {
        "user_id": 1,
        "message": "Give me 3 tips for active recall",
        "document_ids": [],
        "language": "en",
        "mode": "human"
    }

    response = client.post(
        "/chat/stream",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert "id: 1" in response.text
    assert "event: status" in response.text
    assert "event: done" in response.text
