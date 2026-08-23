from locust import HttpUser, task, between, events
import random
import logging

logger = logging.getLogger(__name__)

class ShiroGuestUser(HttpUser):
    """Simulates prospective and guest students exploring Shiro.ai."""
    wait_time = between(0.5, 2.0)
    weight = 3

    @task(4)
    def check_health(self):
        self.client.get("/health", name="/health")

    @task(3)
    def get_dashboard(self):
        self.client.get("/dashboard", name="/dashboard")

    @task(2)
    def get_activity(self):
        self.client.get("/activity", name="/activity")

    @task(2)
    def get_user_profile(self):
        self.client.get("/users/me", name="/users/me (Guest)")

    @task(1)
    def guest_login_session(self):
        self.client.post("/guest", name="/guest")


class ShiroRegisteredStudent(HttpUser):
    """Simulates active logged-in students conducting study sessions."""
    wait_time = between(1.0, 3.0)
    weight = 2
    token = None

    def on_start(self):
        """Authenticate user on test startup."""
        response = self.client.post(
            "/login",
            json={"email": "test@study.ai", "password": "password123"},
            name="/login"
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token")
        else:
            # Fallback to guest token if test user not found
            guest_res = self.client.post("/guest", name="/guest")
            if guest_res.status_code == 200:
                self.token = guest_res.json().get("access_token")

    @property
    def auth_headers(self):
        if self.token:
            return {"Authorization": f"Bearer {self.token}"}
        return {}

    @task(3)
    def get_user_profile(self):
        self.client.get("/users/me", headers=self.auth_headers, name="/users/me (Auth)")

    @task(3)
    def view_dashboard(self):
        self.client.get("/dashboard", headers=self.auth_headers, name="/dashboard (Auth)")

    @task(2)
    def view_progress(self):
        self.client.get("/progress", headers=self.auth_headers, name="/progress")

    @task(2)
    def list_documents(self):
        self.client.get("/documents", headers=self.auth_headers, name="/documents")

    @task(1)
    def simulate_chat_ping(self):
        """Simulate low-latency chat interaction."""
        self.client.post(
            "/chat",
            json={
                "message": "Give me a quick review of the main concept.",
                "document_ids": [],
                "language": "en",
                "mode": "human"
            },
            headers=self.auth_headers,
            name="/chat"
        )
