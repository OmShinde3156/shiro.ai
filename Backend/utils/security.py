import os
import base64
import hashlib
import logging
from typing import Optional
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Derive a deterministic 32-byte Fernet key from JWT_SECRET or fallback
_SECRET_SEED = os.getenv("JWT_SECRET", "shiro-ai-insecure-development-secret-key-change-in-production")
_FERNET_KEY = base64.urlsafe_b64encode(hashlib.sha256(_SECRET_SEED.encode("utf-8")).digest())
_cipher = Fernet(_FERNET_KEY)


def encrypt_secret(plain_text: Optional[str]) -> Optional[str]:
    """Encrypt a secret string using AES-256 (Fernet)"""
    if not plain_text or not plain_text.strip():
        return None
    try:
        encrypted_bytes = _cipher.encrypt(plain_text.strip().encode("utf-8"))
        return encrypted_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"Encryption error: {e}")
        raise ValueError("Failed to securely encrypt secret")


def decrypt_secret(cipher_text: Optional[str]) -> Optional[str]:
    """Decrypt a ciphertext string using AES-256 (Fernet)"""
    if not cipher_text or not cipher_text.strip():
        return None
    try:
        decrypted_bytes = _cipher.decrypt(cipher_text.strip().encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"Decryption error: {e}")
        return None


def mask_api_key(key: Optional[str], provider: str = "general") -> Optional[str]:
    """
    Format a key safely for display without exposing the secret.
    Example: 'gsk_1234567890abcdef' -> 'gsk_••••••••cdef'
    """
    if not key or not key.strip():
        return None
    k = key.strip()
    if len(k) <= 8:
        return "••••••••"
    
    # Preserve provider prefix if recognizable
    if k.startswith("gsk_"):
        prefix = "gsk_"
        body = k[4:]
    elif k.startswith("sk-"):
        prefix = "sk-"
        body = k[3:]
    elif k.startswith("AIza"):
        prefix = "AIza"
        body = k[4:]
    else:
        prefix = k[:3]
        body = k[3:]
        
    last_chars = body[-4:] if len(body) >= 4 else body
    return f"{prefix}••••••••{last_chars}"
