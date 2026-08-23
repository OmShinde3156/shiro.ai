import pytest
import jwt
from datetime import datetime, timedelta
from utils.auth import create_access_token, hash_password, verify_password, SECRET_KEY, ALGORITHM
from models.database import User

def test_login_success(client):
    """Test standard login with valid credentials."""
    response = client.post("/login", json={"email": "test@study.ai", "password": "password123"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "test@study.ai"

def test_login_invalid_password(client):
    """Test login rejection when an invalid password is provided."""
    response = client.post("/login", json={"email": "test@study.ai", "password": "wrongpassword!"})
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]

def test_guest_login_endpoint(client):
    """Test /guest endpoint provides immediate guest access token."""
    response = client.post("/guest")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["id"] == 1
    assert data["user"]["name"] == "Guest User" or data["user"]["name"] == "Test User"

def test_unauthenticated_request_resolves_guest(client):
    """Test unauthenticated requests resolve to guest without 401 blocker."""
    response = client.get("/users/me")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1

def test_register_new_user_with_bcrypt(client, db):
    """Test new user registration hashes password with bcrypt."""
    new_user_payload = {
        "name": "Jane Doe",
        "email": "jane@study.ai",
        "password": "securepassword123",
        "preferred_language": "en"
    }
    response = client.post("/users", json=new_user_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "jane@study.ai"

    # Verify directly from database that stored password is a bcrypt hash
    db_user = db.query(User).filter(User.email == "jane@study.ai").first()
    assert db_user is not None
    assert db_user.password.startswith(("$2b$", "$2a$"))
    assert verify_password("securepassword123", db_user.password)

def test_duplicate_user_registration_fails(client):
    """Test that registering an existing email returns 400 error."""
    payload = {
        "name": "Duplicate User",
        "email": "test@study.ai",
        "password": "somepassword",
        "preferred_language": "en"
    }
    response = client.post("/users", json=payload)
    assert response.status_code == 400

def test_legacy_plaintext_password_migration(client, db):
    """Test legacy plaintext passwords in SQLite are migrated to bcrypt upon login."""
    # Seed a legacy user with plaintext password
    legacy_user = User(
        name="Legacy User",
        email="legacy@study.ai",
        password="plaintext_legacy_password",
        preferred_language="en"
    )
    db.add(legacy_user)
    db.commit()

    # Login with the legacy password
    response = client.post("/login", json={"email": "legacy@study.ai", "password": "plaintext_legacy_password"})
    assert response.status_code == 200

    # Verify that stored password was migrated to bcrypt
    db.refresh(legacy_user)
    assert legacy_user.password.startswith(("$2b$", "$2a$"))
    assert verify_password("plaintext_legacy_password", legacy_user.password)

def test_valid_token(client):
    """Test /users/me with valid Bearer token."""
    encoded_jwt = create_access_token(data={"sub": "1"})
    response = client.get("/users/me", headers={"Authorization": f"Bearer {encoded_jwt}"})
    assert response.status_code == 200
    assert response.json()["id"] == 1

