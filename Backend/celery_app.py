import os
from dotenv import load_dotenv

try:
    from celery import Celery
except ImportError:
    Celery = None

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

if HAS_REDIS and Celery is not None:
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
    # Minimal mock for when Redis/Celery is offline in local environment
    class DummyTask:
        def __init__(self, func):
            self.func = func
        def __call__(self, *args, **kwargs):
            import inspect
            sig = inspect.signature(self.func)
            if "self" in sig.parameters and (len(args) == 0 or args[0] is not self):
                return self.func(self, *args, **kwargs)
            return self.func(*args, **kwargs)
        def delay(self, *args, **kwargs):
            import threading
            t = threading.Thread(target=self.__call__, args=args, kwargs=kwargs)
            t.start()
            class DummyAsyncResult:
                id = "mock-task-id-1234"
            return DummyAsyncResult()
        def retry(self, *args, **kwargs):
            pass
    
    class DummyCelery:
        def task(self, *args, **kwargs):
            def decorator(func):
                return DummyTask(func)
            return decorator
            
    celery_app = DummyCelery()

if __name__ == "__main__" and celery_app and hasattr(celery_app, "start"):
    celery_app.start()

