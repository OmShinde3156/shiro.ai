# 🚀 Shiro.ai Performance & Stress Test Benchmarks

> **Automated Benchmark Verification Suite**  
> Proving high-throughput, low-latency concurrent execution under load.

---

## 📊 Summary Metrics

- **Virtual Concurrency**: `30 concurrent async workers`
- **Total Requests Processed**: `500`
- **Overall Error Rate**: `0.00%`
- **Execution Date**: `2026-08-23 18:24:08 UTC`

---

## ⚡ Endpoint Latency & Throughput Breakdown

| Scenario / Endpoint | Requests | Throughput | Median (p50) | 90th % (p90) | 95th % (p95) | 99th % (p99) | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Health Probe** | `100` | `73.7 req/s` | `163.59 ms` | `451.16 ms` | `496.17 ms` | `566.81 ms` | `0` (0%) |
| **2. User Session** | `100` | `64.1 req/s` | `172.26 ms` | `364.00 ms` | `400.63 ms` | `441.15 ms` | `0` (0%) |
| **3. Dashboard Query** | `100` | `54.9 req/s` | `353.43 ms` | `415.87 ms` | `421.75 ms` | `552.17 ms` | `0` (0%) |
| **4. Activity Feed** | `100` | `47.2 req/s` | `425.27 ms` | `502.49 ms` | `546.97 ms` | `597.15 ms` | `0` (0%) |
| **5. Guest Minting** | `100` | `68.0 req/s` | `166.43 ms` | `478.15 ms` | `576.64 ms` | `648.84 ms` | `0` (0%) |

---

## 🧪 Methodology & Architecture

Shiro.ai is architected for asynchronous, non-blocking I/O using:
1. **FastAPI + Asyncio**: Native asynchronous route handlers and middleware for minimal overhead.
2. **SQLAlchemy Connection Pooling**: Efficient relational query handling with pooled connections.
3. **Stateless JWT + In-Memory Caching**: Fast session and user resolution without blocking I/O.
4. **Celery Distributed Workers**: Heavy computational loads (AI podcasts, summarization, knowledge graph building) are dispatched to background worker queues to ensure the main API remains responsive.

---

## 🏃 How to Reproduce Locally

You can independently verify these benchmarks by running:

### Option 1: Standalone Async Stress Test
```bash
cd Backend
python benchmarks/run_stress_test.py --concurrency 50 --requests 200
```

### Option 2: Locust Interactive Web Dashboard
```bash
cd Backend
locust -f benchmarks/locustfile.py --host http://localhost:8000
```
*Open [http://localhost:8089](http://localhost:8089) in your browser to view real-time charts, RPS, and response times.*
