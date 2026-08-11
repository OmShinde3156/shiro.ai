import os
from celery import Celery
from dotenv import load_dotenv
try:
    import redis
except ImportError:
    redis = None

load_dotenv()

# Configure Redis URL
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

def is_redis_available():
    if not redis: return False
    try:
        r = redis.from_url(REDIS_URL, socket_timeout=1)
        return r.ping()
    except Exception:
        return False

HAS_REDIS = is_redis_available()

if HAS_REDIS:
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
        task_time_limit=3600,
    )
else:
    # Minimal mock for when Redis is offline
    print("[!] REDIS OFFLINE: Shiro will fall back to FastAPI BackgroundTasks.")
    celery_app = None

if __name__ == "__main__" and celery_app:
    celery_app.start()
