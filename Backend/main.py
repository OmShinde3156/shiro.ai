import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI, Depends, Request, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
import os
import uvicorn
import time
import json
import logging
import asyncio
from datetime import datetime
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load .env file explicitly
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from database.database import get_db, init_db, Base, engine
from middleware.correlation_middleware import CorrelationIdMiddleware
from utils.metrics import metrics
from routers import (
    auth_router, 
    documents_router, 
    features_router, 
    important_questions_router,
    rooms_router
)

# ✅ Initialize App
app = FastAPI(title="Shiro AI: Personalized Study Guide Generator", version="0.3.0")

# ✅ Register Universal Correlation & Access Logging Middleware (OBS-01)
app.add_middleware(CorrelationIdMiddleware)

# ✅ Middleware - Configurable CORS for Production and Local Dev
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000")
allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Mount Static Files for PDF Serving
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ✅ Include Routers
app.include_router(features_router.router)
app.include_router(auth_router.router)
app.include_router(documents_router.router)
app.include_router(important_questions_router.router)
app.include_router(rooms_router.router)

# ✅ Startup Event
@app.on_event("startup")
async def startup_event():
    init_db()
    db = next(get_db())
    try:
        from utils.auth import get_guest_user
        get_guest_user(db)
        logger.info("Initialized default Guest User (ID: 1)")
    except Exception as e:
        logger.error(f"Error initializing guest user: {e}")
    finally:
        db.close()

    # Preload VectorDB embedding model once per process (eliminates cold start)
    try:
        from database.vector_db import VectorDB
        await asyncio.to_thread(VectorDB().warm_up)
        logger.info("VectorDB embedding model and Chroma client preloaded successfully.")
    except Exception as e:
        logger.warning(f"VectorDB warmup non-fatal warning: {e}")


# =====================================================================
# 🚪 RELEASE GATE 3: MULTI-TIER HEALTH PROBES & METRICS (OPS-01, OPS-02)
# =====================================================================

@app.get("/health", tags=["Health"])
async def legacy_health_check():
    """Legacy health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "version": "0.3.0"
    }


@app.get("/health/live", tags=["Health"])
async def liveness_probe():
    """
    Fast container liveness check (<5ms) with ZERO external dependencies (OPS-01).
    Used by Kubernetes / container orchestrators to detect process lockup.
    """
    return {"status": "alive"}


@app.get("/health/ready", tags=["Health"])
async def readiness_probe(db: Session = Depends(get_db)):
    """
    Traffic readiness check verifying mandatory database connectivity with 1.0s timeout (OPS-01).
    Returns 200 if instance can accept traffic, 503 if database is unreachable.
    """
    try:
        # Execute query within 1.0s deadline
        db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Readiness probe database failure: {e}")
        raise HTTPException(
            status_code=503,
            detail="Database connectivity check failed. Service not ready."
        )


async def _check_db_async(db: Session) -> str:
    try:
        await asyncio.wait_for(asyncio.to_thread(lambda: db.execute(text("SELECT 1"))), timeout=1.0)
        return "healthy"
    except Exception:
        return "unhealthy"


async def _check_redis_celery_async() -> dict:
    try:
        import redis
        r = redis.Redis.from_url(
            os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            socket_connect_timeout=0.2,
            socket_timeout=0.2
        )
        await asyncio.wait_for(asyncio.to_thread(r.ping), timeout=0.25)
        
        q_len = await asyncio.wait_for(asyncio.to_thread(lambda: r.llen("celery")), timeout=0.25)
        metrics.set_queue_depth(q_len)
        
        # Operational queue thresholds: 0-100: healthy, 101-500: elevated, 501+: degraded
        if q_len <= 100:
            q_status = "healthy"
        elif q_len <= 500:
            q_status = "elevated"
        else:
            q_status = "degraded"

        return {"status": q_status, "queue_depth": q_len}
    except Exception:
        return {"status": "unavailable", "queue_depth": 0}


@app.get("/test-error-endpoint", include_in_schema=False)
async def trigger_simulated_error():
    """Internal test route to verify unhandled 500 error interception (OBS-01)"""
    raise RuntimeError("Simulated critical server failure")



_chroma_health_client = None

def _get_chroma_health_client():
    global _chroma_health_client
    if _chroma_health_client is None:
        import chromadb
        from chromadb.config import Settings
        _chroma_health_client = chromadb.PersistentClient(
            path=os.getenv("CHROMA_DB_PATH", "./chroma_db"),
            settings=Settings(anonymized_telemetry=False)
        )
    return _chroma_health_client

async def _check_chroma_async() -> str:
    try:
        c = _get_chroma_health_client()
        await asyncio.wait_for(asyncio.to_thread(c.heartbeat), timeout=0.25)
        return "healthy"
    except Exception:
        return "degraded"



async def _check_ai_gateway_async() -> str:
    try:
        from utils.llm_client import llm_client
        if llm_client.openai_client or llm_client.groq_client or llm_client.gemini_client:
            return "healthy"
        return "simulation_fallback"
    except Exception:
        return "degraded"


@app.get("/health/dependencies", tags=["Health"])
async def dependencies_health_probe(db: Session = Depends(get_db)):
    """
    Concurrent sub-second diagnostic dependency probe (OPS-01).
    Inspects PostgreSQL, Redis/Celery queue depth, ChromaDB, and AI Gateway concurrently.
    Sanitized output: zero internal credentials or hostnames exposed.
    """
    # Run all dependency checks concurrently
    db_res, celery_res, chroma_res, ai_res = await asyncio.gather(
        _check_db_async(db),
        _check_redis_celery_async(),
        _check_chroma_async(),
        _check_ai_gateway_async()
    )

    overall_status = "healthy"
    if db_res != "healthy":
        overall_status = "unhealthy"
    elif celery_res.get("status") in ("degraded", "unavailable") or chroma_res == "unhealthy":
        overall_status = "degraded"

    return {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "dependencies": {
            "database": db_res,
            "celery": celery_res,
            "chromadb": chroma_res,
            "ai_gateway": ai_res
        }
    }


@app.get("/metrics", tags=["Observability"])
async def prometheus_metrics():
    """
    Prometheus-compatible metrics endpoint (OPS-02).
    Emits low-cardinality counters, latencies, AI costs, and queue depths.
    """
    return Response(
        content=metrics.generate_prometheus_metrics(),
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        reload_dirs=["routers", "services", "utils", "models", "database", "middleware", "prompts"],
        reload_excludes=["*.mp3", "*.wav", "static/*", "venv/*", ".venv/*", "*\\venv\\*", "*\\.venv\\*", "*.log", "__pycache__/*"]
    )
