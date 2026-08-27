import re
import time
from typing import Dict, Any, Optional, List
from collections import defaultdict


def normalize_path(path: str) -> str:
    """
    Normalizes literal paths into low-cardinality route templates (OBS-01).
    Example: /documents/123 -> /documents/{id}
             /rooms/ws/abc-123 -> /rooms/ws/{id}
    """
    path = re.sub(r'/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '/{id}', path)
    path = re.sub(r'/doc_[0-9a-zA-Z_]+', '/{id}', path)
    path = re.sub(r'/[0-9]+', '/{id}', path)
    return path



class MetricsRegistry:
    """
    In-memory Prometheus-compatible metrics registry (OPS-02).
    Tracks HTTP throughput, latency, AI usage, and worker queue depths.
    """
    def __init__(self):
        self.http_requests: Dict[str, int] = defaultdict(int)
        self.http_durations: Dict[str, List[float]] = defaultdict(list)
        self.ai_requests: Dict[str, int] = defaultdict(int)
        self.ai_costs: Dict[str, float] = defaultdict(float)
        self.celery_tasks: Dict[str, int] = defaultdict(int)
        self.celery_queue_depth: int = 0
        self.active_websockets: int = 0

    def record_http_request(self, method: str, path: str, status_code: int, duration_seconds: float):
        route = normalize_path(path)
        key = f'{method}:{route}:{status_code}'
        self.http_requests[key] += 1
        
        # Keep rolling window of last 1000 latency measurements per route
        route_key = f'{method}:{route}'
        self.http_durations[route_key].append(duration_seconds)
        if len(self.http_durations[route_key]) > 1000:
            self.http_durations[route_key].pop(0)

    def record_ai_request(self, feature: str, provider: str, fallback: bool, cost_usd: float = 0.0):
        key = f'{feature}:{provider}:{"true" if fallback else "false"}'
        self.ai_requests[key] += 1
        cost_key = f'{feature}:{provider}'
        self.ai_costs[cost_key] += cost_usd

    def record_celery_task(self, task_name: str, status: str):
        key = f'{task_name}:{status}'
        self.celery_tasks[key] += 1

    def set_queue_depth(self, depth: int):
        self.celery_queue_depth = max(0, depth)

    def get_latency_percentiles(self, method: str, path: str) -> Dict[str, float]:
        route = normalize_path(path)
        route_key = f'{method}:{route}'
        durations = sorted(self.http_durations.get(route_key, []))
        if not durations:
            return {"p50": 0.0, "p95": 0.0, "p99": 0.0}

        n = len(durations)
        return {
            "p50": durations[int(n * 0.50)],
            "p95": durations[min(n - 1, int(n * 0.95))],
            "p99": durations[min(n - 1, int(n * 0.99))]
        }

    def generate_prometheus_metrics(self) -> str:
        """Outputs standard Prometheus exposition format"""
        lines = []

        # HTTP Requests
        lines.append("# HELP http_requests_total Total number of HTTP requests made.")
        lines.append("# TYPE http_requests_total counter")
        for key, count in self.http_requests.items():
            method, route, status = key.split(':')
            lines.append(f'http_requests_total{{method="{method}",route="{route}",status="{status}"}} {count}')

        # HTTP Latencies
        lines.append("# HELP http_request_duration_seconds HTTP request latencies.")
        lines.append("# TYPE http_request_duration_seconds summary")
        for route_key, durations in self.http_durations.items():
            if durations:
                method, route = route_key.split(':')
                count = len(durations)
                total = sum(durations)
                lines.append(f'http_request_duration_seconds_count{{method="{method}",route="{route}"}} {count}')
                lines.append(f'http_request_duration_seconds_sum{{method="{method}",route="{route}"}} {total:.6f}')

        # AI Metrics
        lines.append("# HELP ai_requests_total Total AI gateway requests.")
        lines.append("# TYPE ai_requests_total counter")
        for key, count in self.ai_requests.items():
            feature, provider, fallback = key.split(':')
            lines.append(f'ai_requests_total{{feature="{feature}",provider="{provider}",fallback="{fallback}"}} {count}')

        lines.append("# HELP ai_cost_usd_total Accumulated AI costs in USD.")
        lines.append("# TYPE ai_cost_usd_total counter")
        for key, cost in self.ai_costs.items():
            feature, provider = key.split(':')
            lines.append(f'ai_cost_usd_total{{feature="{feature}",provider="{provider}"}} {cost:.8f}')

        # Celery Metrics
        lines.append("# HELP celery_tasks_total Background tasks executed.")
        lines.append("# TYPE celery_tasks_total counter")
        for key, count in self.celery_tasks.items():
            task, status = key.split(':')
            lines.append(f'celery_tasks_total{{task="{task}",status="{status}"}} {count}')

        lines.append("# HELP celery_queue_depth Current background job queue depth.")
        lines.append("# TYPE celery_queue_depth gauge")
        lines.append(f'celery_queue_depth {self.celery_queue_depth}')

        return "\n".join(lines) + "\n"

metrics = MetricsRegistry()
