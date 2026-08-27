# pyrefly: ignore [missing-import]
import pytest
import uuid
import time
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import text

from main import app
from database.database import get_db
from middleware.correlation_middleware import redact_sensitive_data, REQUEST_ID_REGEX
from utils.metrics import metrics, normalize_path


def test_liveness_probe_returns_200_alive(client):
    """Test /health/live is ultra-lightweight and returns 200 alive (OPS-01)"""
    response = client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert "X-Request-ID" in response.headers


def test_readiness_probe_success_on_healthy_database(client):
    """Test /health/ready returns 200 ready when database is connected (OPS-01)"""
    response = client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"


def test_readiness_probe_503_on_db_failure(client):
    """Test /health/ready returns 503 when database is unreachable (OPS-01)"""
    mock_session = MagicMock()
    mock_session.execute.side_effect = Exception("DB Connection Refused")
    app.dependency_overrides[get_db] = lambda: mock_session

    try:
        response = client.get("/health/ready")
        assert response.status_code == 503
        data = response.json()
        assert "detail" in data
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_dependency_health_probe_sanitized_and_fast(client):
    """Test /health/dependencies returns structured dependency diagnostic without exposing secrets (OPS-01)"""
    start = time.time()
    response = client.get("/health/dependencies")
    duration = time.time() - start

    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "dependencies" in data
    
    deps = data["dependencies"]
    assert "database" in deps
    assert "celery" in deps
    assert "chromadb" in deps
    assert "ai_gateway" in deps

    # Zero secrets or hostnames exposed
    raw_text = response.text.lower()
    assert "password" not in raw_text
    assert "secret" not in raw_text
    assert "traceback" not in raw_text

    # Probe must be fast (< 2.0s)
    assert duration < 2.0


def test_correlation_id_middleware_sanitizes_and_propagates(client):
    """Test valid incoming X-Request-ID is preserved and attached to response (OBS-01)"""
    custom_id = "req_test_abc_12345"
    response = client.get("/health/live", headers={"X-Request-ID": custom_id})
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == custom_id


def test_correlation_id_middleware_generates_when_missing_or_malformed(client):
    """Test missing or malformed X-Request-ID is replaced with clean UUID (OBS-01)"""
    # 1. Missing header
    res1 = client.get("/health/live")
    assert "X-Request-ID" in res1.headers
    assert REQUEST_ID_REGEX.match(res1.headers["X-Request-ID"])

    # 2. Malformed header with invalid injection characters
    malformed_id = "invalid/id with spaces and <script>"
    res2 = client.get("/health/live", headers={"X-Request-ID": malformed_id})
    assert res2.headers["X-Request-ID"] != malformed_id
    assert REQUEST_ID_REGEX.match(res2.headers["X-Request-ID"])


def test_exception_response_contains_same_request_id_as_log(client):
    """Test unhandled 500 exceptions return sanitized JSON with reference_id matching X-Request-ID (OBS-01)"""
    custom_id = "req_err_trace_999"
    response = client.get("/test-error-endpoint", headers={"X-Request-ID": custom_id})
    assert response.status_code == 500
    data = response.json()
    assert data["detail"] == "An unexpected error occurred."
    assert data["reference_id"] == custom_id
    assert response.headers["X-Request-ID"] == custom_id
    # Zero traceback exposed to client
    assert "Simulated critical" not in response.text


def test_secret_redaction_utility():
    """Test recursive secret redaction for logging arbitrary dictionaries (OBS-01)"""
    payload = {
        "user": "student_1",
        "authorization": "Bearer eyJhbGciOi...",
        "profile": {
            "password": "supersecretpassword",
            "email": "test@study.ai",
            "api_key": "sk-1234567890"
        },
        "tags": ["os", "exam"]
    }
    redacted = redact_sensitive_data(payload)
    assert redacted["authorization"] == "[REDACTED]"
    assert redacted["profile"]["password"] == "[REDACTED]"
    assert redacted["profile"]["api_key"] == "[REDACTED]"
    assert redacted["profile"]["email"] == "test@study.ai"
    assert redacted["user"] == "student_1"


def test_metrics_endpoint_emits_prometheus_data(client):
    """Test /metrics exposes valid Prometheus text format (OPS-02)"""
    client.get("/health/live")

    response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    text_content = response.text

    assert "http_requests_total" in text_content
    assert "http_request_duration_seconds" in text_content
    assert "celery_queue_depth" in text_content


def test_metrics_route_template_normalization():
    """Test route template normalization prevents high-cardinality label explosions (OPS-02)"""
    p1 = normalize_path("/documents/123")
    p2 = normalize_path("/documents/999")
    p3 = normalize_path("/documents/123e4567-e89b-12d3-a456-426614174000")
    
    assert p1 == "/documents/{id}"
    assert p2 == "/documents/{id}"
    assert p3 == "/documents/{id}"


def test_performance_baseline_latency_headers(client):
    """Test performance latency measurement and calculate p50/p95/p99 baseline (OPS-01)"""
    latencies = []
    for _ in range(10):
        start = time.time()
        res = client.get("/health/live")
        latencies.append((time.time() - start) * 1000)
        assert res.status_code == 200
        assert "X-Process-Time" in res.headers

    latencies.sort()
    p50 = latencies[int(len(latencies) * 0.5)]
    p95 = latencies[int(len(latencies) * 0.95)]
    
    # In-memory test client overhead is fast (< 100ms)
    assert p50 < 100
    assert p95 < 150
