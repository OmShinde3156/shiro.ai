import pytest

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    
def test_get_dashboard_data(client):
    response = client.get("/dashboard/1")
    # Endpoint should return 200 since the user is mocked in conftest
    assert response.status_code == 200

def test_get_user_activity(client):
    response = client.get("/activity/1")
    assert response.status_code == 200
    
def test_performance_middleware(client):
    response = client.get("/health")
    # Verify X-Process-Time is injected by our new middleware
    assert "x-process-time" in response.headers
    assert float(response.headers["x-process-time"]) >= 0
