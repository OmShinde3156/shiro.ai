import pytest
import time
import jwt
from datetime import datetime, timedelta
from utils.auth import create_access_token, SECRET_KEY, ALGORITHM

def test_login_success(client):
    response = client.post("/login", json={"email": "test@study.ai", "password": "password123"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data

def test_missing_token(client):
    response = client.get("/users/me")
    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}

def test_invalid_token(client):
    response = client.get("/users/me", headers={"Authorization": "Bearer invalid.token.string"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid token"}

def test_expired_token(client):
    # Create an expired token manually
    to_encode = {"sub": "1"}
    expire = datetime.utcnow() - timedelta(minutes=1)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    response = client.get("/users/me", headers={"Authorization": f"Bearer {encoded_jwt}"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Token has expired"}

def test_valid_token(client):
    encoded_jwt = create_access_token(data={"sub": "1"})
    response = client.get("/users/me", headers={"Authorization": f"Bearer {encoded_jwt}"})
    assert response.status_code == 200
    assert response.json()["id"] == 1
