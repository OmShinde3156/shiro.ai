from celery import Celery
import os
from dotenv import load_dotenv

load_dotenv()

# Configure Celery to use Redis as the broker and result backend
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "shiro_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "services.podcast_service",
        "services.summarizer_service",
        "services.graph_service"
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600, # 1 hour max for any task
)

if __name__ == "__main__":
    celery_app.start()
