import re
import time
import json
import uuid
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from utils.metrics import metrics

logger = logging.getLogger("shiro.access")

# Regex to validate format of incoming X-Request-ID
REQUEST_ID_REGEX = re.compile(r'^[a-zA-Z0-9_-]{1,64}$')

# Sensitive key names to recursively redact
SENSITIVE_KEYS = {
    "authorization", "password", "token", "access_token", "refresh_token",
    "api_key", "secret", "cookie", "x-api-key", "gemini_api_key", "groq_api_key"
}


def redact_sensitive_data(data: Any) -> Any:
    """Recursively redacts secrets and credentials from dictionary objects"""
    if isinstance(data, dict):
        redacted = {}
        for k, v in data.items():
            if str(k).lower() in SENSITIVE_KEYS:
                redacted[k] = "[REDACTED]"
            else:
                redacted[k] = redact_sensitive_data(v)
        return redacted
    elif isinstance(data, list):
        return [redact_sensitive_data(item) for item in data]
    return data


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Universal Request Correlation and Secret-Safe Structured JSON Logging Middleware (OBS-01).
    1. Validates or generates X-Request-ID.
    2. Attaches request.state.request_id.
    3. Emits JSON access log events (excluding noisy health probes).
    4. Records Prometheus HTTP latency metrics with normalized route templates.
    5. Shields internal tracebacks on unhandled 500s, returning a user-safe reference_id.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Extract and Sanitize or Generate Request ID
        raw_req_id = request.headers.get("X-Request-ID", "").strip()
        if raw_req_id and REQUEST_ID_REGEX.match(raw_req_id):
            request_id = raw_req_id
        else:
            request_id = str(uuid.uuid4())

        request.state.request_id = request_id
        start_time = time.time()

        try:
            response = await call_next(request)
        except Exception as exc:
            # 2. Error Correlation: Log traceback internally with request_id
            latency_ms = round((time.time() - start_time) * 1000, 2)
            logger.error(
                json.dumps({
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "level": "ERROR",
                    "service": "shiro-api",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": 500,
                    "latency_ms": latency_ms,
                    "error": str(exc)
                }),
                exc_info=True
            )
            # Record metric
            metrics.record_http_request(request.method, request.url.path, 500, (time.time() - start_time))

            # Return sanitized 500 JSON without exposing internal traceback
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "An unexpected error occurred.",
                    "reference_id": request_id
                },
                headers={
                    "X-Request-ID": request_id,
                    "X-Process-Time": f"{latency_ms}ms"
                }
            )

        duration = time.time() - start_time
        latency_ms = round(duration * 1000, 2)

        # 3. Attach standard response headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{duration:.4f}"


        # 4. Record Prometheus metrics
        metrics.record_http_request(request.method, request.url.path, response.status_code, duration)

        # 5. Emit Secret-Safe Structured JSON Access Log (Exclude /health/live from noise)
        if request.url.path != "/health/live":
            user_id = getattr(getattr(request, "state", None), "user_id", None)
            log_event = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": "INFO" if response.status_code < 400 else "WARNING",
                "service": "shiro-api",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "latency_ms": latency_ms,
                "user_id": user_id
            }
            logger.info(json.dumps(log_event))

        return response
