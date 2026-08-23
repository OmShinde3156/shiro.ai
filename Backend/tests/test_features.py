import pytest

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    
def test_get_dashboard_data(client):
    response = client.get("/dashboard")
    assert response.status_code == 200

def test_get_user_activity(client):
    response = client.get("/activity")
    assert response.status_code == 200
    
def test_performance_middleware(client):
    response = client.get("/health")
    assert "x-process-time" in response.headers
    assert float(response.headers["x-process-time"]) >= 0

