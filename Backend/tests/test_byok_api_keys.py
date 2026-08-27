# pyrefly: ignore [missing-import]
import pytest
from models.database import User, AIRequestLog
from utils.auth import create_access_token
from utils.security import encrypt_secret, decrypt_secret, mask_api_key
from utils.llm_client import llm_client


def test_fernet_encryption_roundtrip():
    """Verify AES-256 Fernet encryption and decryption fidelity"""
    raw_key = "gsk_test1234567890abcdef"
    encrypted = encrypt_secret(raw_key)
    assert encrypted != raw_key
    assert len(encrypted) > 20

    decrypted = decrypt_secret(encrypted)
    assert decrypted == raw_key

    # None and empty checks
    assert encrypt_secret("") is None
    assert encrypt_secret(None) is None
    assert decrypt_secret("") is None
    assert decrypt_secret(None) is None


def test_key_masking():
    """Verify key masking never exposes raw secret bodies"""
    assert mask_api_key("gsk_1234567890abcdef", "groq") == "gsk_••••••••cdef"
    assert mask_api_key("sk-proj-1234567890abcdef", "openai") == "sk-••••••••cdef"
    assert mask_api_key("AIzaSy1234567890abcdef", "gemini") == "AIza••••••••cdef"
    assert mask_api_key(None) is None


def test_byok_endpoints_http(client, db):
    """Verify full CRUD lifecycle of BYOK keys via HTTP API"""
    user = db.query(User).filter(User.id == 1).first()
    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Initial GET
    res = client.get("/api-keys", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "has_groq_key" in data
    assert "preferred_provider" in data

    # 2. POST (Save keys)
    save_payload = {
        "groq_api_key": "gsk_supersecretgroqkey1234",
        "gemini_api_key": "AIzaSySuperSecretGeminiKey1234",
        "preferred_provider": "groq",
        "byok_enabled": True
    }
    save_res = client.post("/api-keys", json=save_payload, headers=headers)
    assert save_res.status_code == 200
    save_data = save_res.json()
    assert save_data["has_groq_key"] is True
    assert save_data["groq_masked"] == "gsk_••••••••1234"
    assert save_data["has_gemini_key"] is True
    assert save_data["gemini_masked"] == "AIza••••••••1234"
    assert "supersecretgroqkey" not in str(save_data)  # Confirm raw key NEVER leaked

    # 3. DELETE (Remove Gemini key)
    del_res = client.delete("/api-keys/gemini", headers=headers)
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["has_gemini_key"] is False
    assert del_data["has_groq_key"] is True

    # 4. Clean up Groq key
    client.delete("/api-keys/groq", headers=headers)


@pytest.mark.asyncio
async def test_validate_api_key_invalid():
    """Verify key validation rejects malformed/invalid keys cleanly"""
    res = await llm_client.validate_api_key("groq", "gsk_invalid_test_key_xyz")
    assert res["valid"] is False
    assert res["provider"] == "groq"
    assert "error_code" in res
    assert "gsk_invalid_test_key_xyz" not in str(res)


@pytest.mark.asyncio
async def test_byok_bypasses_daily_quota(db):
    """Verify that an active BYOK user bypasses platform daily request limits"""
    user_id = 1
    user = db.query(User).filter(User.id == user_id).first()
    user.ai_quota_daily = 2
    user.groq_api_key_encrypted = encrypt_secret("gsk_mock_valid_key")
    user.byok_enabled = True
    user.preferred_ai_provider = "groq"
    db.commit()

    # Seed 5 requests today to exceed quota
    for i in range(5):
        db.add(AIRequestLog(
            request_id=f"req-quota-{i}",
            user_id=user_id,
            feature="chat",
            provider="groq",
            model="llama-3.3-70b-versatile",
            billing_source="platform"
        ))
    db.commit()

    # Resolution config should mark is_byok = True and billing_source = "personal"
    cfg = llm_client._resolve_execution_config(user_id, db)
    assert cfg["is_byok"] is True
    assert cfg["billing_source"] == "personal"

    # Clean up
    user.groq_api_key_encrypted = None
    db.commit()
