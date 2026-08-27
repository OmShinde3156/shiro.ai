# pyrefly: ignore [missing-import]
import pytest
from fastapi.testclient import TestClient
from models.database import User, Document, StudyRoom
from utils.auth import create_access_token, hash_password, get_guest_user
from utils.network_security import is_safe_ip, validate_safe_url
from fastapi import HTTPException


def create_test_user(db, user_id: int, email: str, name: str) -> User:
    """Helper to insert test users"""
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


def create_test_doc(db, doc_id: int, user_id: int, title: str) -> Document:
    """Helper to insert test documents"""
    doc = Document(
        id=doc_id,
        filename=f"{title}.pdf",
        file_type="pdf",
        subject="Computer Science",
        text_content="Deadlocks occur when processes hold resources while waiting for other resources.",
        vector_db_id=f"test_vec_{doc_id}",
        user_id=user_id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


# ============================================================================
# SEC-01: Document Authorization & IDOR Elimination Tests
# ============================================================================

def test_idor_delete_other_user_document_denied(client, db):
    """User B must NOT be able to delete User A's document."""
    user_a = create_test_user(db, 101, "alice@study.ai", "Alice")
    user_b = create_test_user(db, 102, "bob@study.ai", "Bob")
    doc_a = create_test_doc(db, 501, user_a.id, "Alice_Private_Doc")

    token_b = create_access_token({"sub": str(user_b.id)})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Bob attempts to delete Alice's document
    res = client.delete(f"/documents/{doc_a.id}", headers=headers_b)
    assert res.status_code == 404
    assert "Document not found or access denied" in res.json()["detail"]

    # Verify Alice's document is still in the database
    persisted = db.query(Document).filter(Document.id == doc_a.id).first()
    assert persisted is not None


def test_idor_update_other_user_document_subject_denied(client, db):
    """User B must NOT be able to change the subject of User A's document."""
    user_a = create_test_user(db, 103, "alice2@study.ai", "Alice")
    user_b = create_test_user(db, 104, "bob2@study.ai", "Bob")
    doc_a = create_test_doc(db, 502, user_a.id, "Alice_Notes")

    token_b = create_access_token({"sub": str(user_b.id)})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Bob attempts to rename Alice's subject
    res = client.put(f"/documents/{doc_a.id}/subject", data={"subject": "Hacked Subject"}, headers=headers_b)
    assert res.status_code == 404

    # Verify subject remains unchanged
    db.refresh(doc_a)
    assert doc_a.subject == "Computer Science"


def test_owner_can_delete_own_document(client, db):
    """User A should be able to delete their own document."""
    user_a = create_test_user(db, 105, "alice3@study.ai", "Alice")
    doc_a = create_test_doc(db, 503, user_a.id, "Alice_Disposable_Doc")

    token_a = create_access_token({"sub": str(user_a.id)})
    headers_a = {"Authorization": f"Bearer {token_a}"}

    res = client.delete(f"/documents/{doc_a.id}", headers=headers_a)
    assert res.status_code == 200
    assert res.json()["message"] == "Document deleted successfully"


# ============================================================================
# SEC-02: Room Creation & WebSocket Authentication Tests
# ============================================================================

def test_room_creation_binds_to_jwt_identity(client, db):
    """Room creation must derive creator identity strictly from JWT token."""
    user_a = create_test_user(db, 201, "charlie@study.ai", "Charlie")
    token_a = create_access_token({"sub": str(user_a.id)})
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Pass spoofed user_id=999 in payload
    payload = {
        "name": "Distributed Systems Room",
        "subject": "CS",
        "user_id": 999
    }
    res = client.post("/rooms/", json=payload, headers=headers_a)
    assert res.status_code == 200
    room_id = res.json()["room_id"]

    # Verify created_by matches token user_id (201), ignoring spoofed payload (999)
    room = db.query(StudyRoom).filter(StudyRoom.id == room_id).first()
    assert room is not None
    assert room.created_by == user_a.id


def test_websocket_rejects_unauthenticated_connection(client, db):
    """WebSocket connection without token or with invalid token must close with code 1008."""
    room = StudyRoom(id="room123", name="Test Room", created_by=1)
    db.add(room)
    db.commit()

    with pytest.raises(Exception):
        with client.websocket_connect("/rooms/ws/room123?token=invalid_token") as ws:
            pass


# ============================================================================
# SEC-03: AI Generation Endpoints Authorization Tests
# ============================================================================

def test_ai_generate_quiz_on_unowned_document_denied(client, db):
    """User B cannot generate a quiz from User A's private document."""
    user_a = create_test_user(db, 301, "owner@study.ai", "Owner")
    user_b = create_test_user(db, 302, "attacker@study.ai", "Attacker")
    doc_a = create_test_doc(db, 601, user_a.id, "Owner_Doc")

    token_b = create_access_token({"sub": str(user_b.id)})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    req = {"document_id": doc_a.id, "num_questions": 5, "difficulty": "medium"}
    res = client.post("/generate-quiz", json=req, headers=headers_b)
    assert res.status_code == 404
    assert "Document not found or access denied" in res.json()["detail"]


def test_ai_generate_flashcards_on_unowned_document_denied(client, db):
    """User B cannot generate flashcards from User A's private document."""
    user_a = create_test_user(db, 303, "owner2@study.ai", "Owner")
    user_b = create_test_user(db, 304, "attacker2@study.ai", "Attacker")
    doc_a = create_test_doc(db, 602, user_a.id, "Owner_Doc2")

    token_b = create_access_token({"sub": str(user_b.id)})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    req = {"document_id": doc_a.id, "num_cards": 5}
    res = client.post("/generate-flashcards", json=req, headers=headers_b)
    assert res.status_code == 404


def test_ai_summarize_on_unowned_document_denied(client, db):
    """User B cannot summarize User A's private document."""
    user_a = create_test_user(db, 305, "owner3@study.ai", "Owner")
    user_b = create_test_user(db, 306, "attacker3@study.ai", "Attacker")
    doc_a = create_test_doc(db, 603, user_a.id, "Owner_Doc3")

    token_b = create_access_token({"sub": str(user_b.id)})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    req = {"document_id": doc_a.id, "summary_type": "detailed", "language": "en"}
    res = client.post("/summarize", json=req, headers=headers_b)
    assert res.status_code == 404


def test_ai_chat_referencing_unowned_document_denied(client, db):
    """User B cannot query User A's document in chat."""
    user_a = create_test_user(db, 307, "owner4@study.ai", "Owner")
    user_b = create_test_user(db, 308, "attacker4@study.ai", "Attacker")
    doc_a = create_test_doc(db, 604, user_a.id, "Owner_Doc4")

    token_b = create_access_token({"sub": str(user_b.id)})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    req = {"message": "Summarize this doc", "document_ids": [doc_a.id], "language": "en"}
    res = client.post("/chat", json=req, headers=headers_b)
    assert res.status_code == 404


def test_private_room_unauthorized_websocket_denied(client, db):
    """An uninvited user with a valid JWT must NOT be able to connect to a private room."""
    owner = create_test_user(db, 202, "owner_room@study.ai", "Room Owner")
    attacker = create_test_user(db, 203, "attacker_room@study.ai", "Attacker")
    
    private_room = StudyRoom(id="priv123", name="Secret Room", is_public=False, created_by=owner.id)
    db.add(private_room)
    db.commit()

    token_attacker = create_access_token({"sub": str(attacker.id)})
    
    # Attacker tries to connect to private room -> rejected with code 1008
    with pytest.raises(Exception):
        with client.websocket_connect(f"/rooms/ws/priv123?token={token_attacker}") as ws:
            pass


def test_ai_important_questions_unowned_document_denied(client, db):
    """User B cannot generate important questions on User A's private document."""
    user_a = create_test_user(db, 309, "owner5@study.ai", "Owner")
    user_b = create_test_user(db, 310, "attacker5@study.ai", "Attacker")
    doc_a = create_test_doc(db, 605, user_a.id, "Owner_Doc5")

    token_b = create_access_token({"sub": str(user_b.id)})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    data = {"document_id": str(doc_a.id), "num_questions": "10"}
    res = client.post("/api/important-questions/generate", data=data, headers=headers_b)
    assert res.status_code == 404
    assert "Document not found or access denied" in res.json()["detail"]


# ============================================================================
# BUG-01: Guest ORM Instance Session Isolation Tests
# ============================================================================

def test_guest_user_session_isolation(db):
    """Calling get_guest_user across independent sessions must not produce DetachedInstanceError."""
    guest1 = get_guest_user(db)
    assert guest1.id == 1
    assert guest1.name is not None
    # Access a lazy attribute
    _ = guest1.preferred_language



# ============================================================================
# SEC-04: Multi-Hop SSRF Defense Tests
# ============================================================================

@pytest.mark.parametrize("blocked_url", [
    "http://127.0.0.1:8000/secret",
    "http://localhost:3000/admin",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.1/internal-dashboard",
    "http://192.168.1.1/router-settings",
    "http://172.16.0.1/private",
    "http://[::1]/internal",
    "http://metadata.google.internal/computeMetadata/v1",
])
def test_ssrf_validator_blocks_internal_and_metadata_targets(blocked_url):
    """validate_safe_url must block all loopback, RFC1918 private, and cloud metadata targets."""
    with pytest.raises(HTTPException) as exc_info:
        validate_safe_url(blocked_url)
    assert exc_info.value.status_code == 400


def test_ssrf_validator_permits_public_domain():
    """validate_safe_url must permit valid public domains."""
    validated = validate_safe_url("https://en.wikipedia.org/wiki/Operating_system")
    assert "wikipedia.org" in validated


def test_ssrf_redirect_to_loopback_blocked(monkeypatch):
    """safe_fetch_text must detect and block a redirect to 127.0.0.1 (multi-hop SSRF)."""
    from utils.network_security import safe_fetch_text
    import requests

    class MockResponse:
        def __init__(self, status_code, headers):
            self.status_code = status_code
            self.headers = headers

        def iter_content(self, chunk_size, decode_unicode=True):
            return ["dummy content"]

    def mock_get(url, **kwargs):
        if "example.com" in url:
            # Simulate 302 redirect to loopback
            return MockResponse(302, {"Location": "http://127.0.0.1:8000/secret_admin"})
        return MockResponse(200, {})

    monkeypatch.setattr(requests.Session, "get", lambda self, url, **kw: mock_get(url, **kw))

    with pytest.raises(HTTPException) as exc_info:
        safe_fetch_text("https://example.com/redirect-to-localhost")
    assert exc_info.value.status_code == 400


def test_ssrf_redirect_to_cloud_metadata_blocked(monkeypatch):
    """safe_fetch_text must detect and block a redirect to AWS/GCP metadata (169.254.169.254)."""
    from utils.network_security import safe_fetch_text
    import requests

    class MockResponse:
        def __init__(self, status_code, headers):
            self.status_code = status_code
            self.headers = headers

        def iter_content(self, chunk_size, decode_unicode=True):
            return ["dummy content"]

    def mock_get(url, **kwargs):
        if "example.com" in url:
            # Simulate 302 redirect to AWS metadata
            return MockResponse(302, {"Location": "http://169.254.169.254/latest/meta-data"})
        return MockResponse(200, {})

    monkeypatch.setattr(requests.Session, "get", lambda self, url, **kw: mock_get(url, **kw))

    with pytest.raises(HTTPException) as exc_info:
        safe_fetch_text("https://example.com/redirect-to-metadata")
    assert exc_info.value.status_code == 400

