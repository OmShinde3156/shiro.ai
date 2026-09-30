# Shiro.ai System Architecture & Dataflow Specification
*Version 3.5: Validated Learning Intelligence Core*

---

## 1. Overview & Architectural Philosophy

Shiro.ai is designed around a single guiding principle: **Educational AI must be governed by verifiable cognitive and psychometric models, not unstructured prompt engineering.**

Traditional LLM study tools wrap a chat endpoint around student prompts without maintaining an internal mathematical model of the learner. In contrast, Shiro implements a **closed-loop educational intelligence operating system**:

```text
                                  THE SHIRO CLOSED COGNITIVE LOOP
                                  
            ┌─────────────────────────────────────────────────────────────┐
            │                                                             │
            ▼                                                             │
    ┌───────────────┐        ┌───────────────────┐        ┌───────────────┴────────┐
    │  LEARNER ACTS │ ─────> │ EVENT INGESTION   │ ─────> │ STATE RECONCILIATION   │
    │  • Reads Doc  │        │ • Idempotent POST │        │ • BKT Mastery Update   │
    │  • Takes Quiz │        │ • Append-Only DB  │        │ • Rasch Ability θ      │
    │  • Reviews FC │        │ • Raw Observation │        │ • Memory Decay R(t)    │
    └───────────────┘        └───────────────────┘        └───────────────┬────────┘
                                                                          │
                                                                          ▼
    ┌───────────────┐        ┌───────────────────┐        ┌────────────────────────┐
    │  SESSION EXEC │ <───── │ PATHWAY OPTIMIZER │ <───── │ READ-ONLY SNAPSHOT     │
    │  • 15-90m run │        │ • REC-01 Beam K=8 │        │ • Point-in-time state  │
    │  • Real-time  │        │ • Pacing order    │        │ • Zero side-effects    │
    │  • Telemetry  │        │ • Prereq DAG      │        │ • Immutable for audit  │
    └───────────────┘        └───────────────────┘        └────────────────────────┘
```

---

## 2. Core Subsystems

The platform is organized into five tightly decoupled subsystems:

### A. Grounded Document Intelligence (Hybrid RAG)
* **Ingestion Pipeline:** Asynchronous parsing of PDF, DOCX, PPTX, and TXT using semantic sliding-window chunking (500 tokens, 100 token overlap).
* **Dual Indexing:**
  * *Lexical Store:* In-memory BM25 index capturing exact keyword, formula, and acronym occurrences.
  * *Semantic Store:* ChromaDB embedding store utilizing cosine similarity over high-dimensional vector representations.
* **Reciprocal Rank Fusion (RRF):** Merges dense and sparse retrieval ranks with constant $k = 60$.
* **Citation Traceability:** Strict provenance tracing mapping LLM responses to verified document chunk IDs (`[CIT-n]`).

### B. Knowledge Tracing Engine (KT-01)
* **Algorithm:** 4-parameter Corbett & Anderson Bayesian Knowledge Tracing (BKT).
* **Role:** Estimates the latent posterior probability $P(L_t \mid \text{obs}_{1:t})$ that a student has mastered each concept in the curriculum.
* **Auditability:** Event-sourced ledger (`study_guide.db` / `PostgreSQL`) preserving every observation for historical replay.

### C. Computerized Adaptive Testing (ADAPT-01)
* **Psychometric Framework:** 1-Parameter Logistic (1PL) Rasch Item Response Theory.
* **Item Selection:** Maximizes Fisher Information $I_j(\hat{\theta})$ at the student's current latent ability estimate $\hat{\theta}$.
* **Stopping Criteria:** Terminates dynamically when standard error $\text{SE}(\hat{\theta}) \le 0.35$ or reaches maximum test length $N_{\max} = 12$.

### D. Memory Retention & Spaced Decay (FORGET-01)
* **Decay Model:** Exponential Ebbinghaus formulation:
  $$R(t) = \exp\left(-\frac{t}{\tau}\right)$$
* **Stability Dynamics:** Memory stability $\tau$ increases monotonically with successful reviews and is boosted by diagnostic CAT assessments.
* **Debounce Protection:** 30-minute session debouncing prevents artificial stability inflation during cramming.

### E. Constrained Sequence Optimizer (REC-01)
* **Algorithm:** Pruned Beam Search ($K = 8$) exploring combinatorial study action sequences.
* **Objective:** Maximizes cumulative pedagogical Return-on-Investment (ROI) under hard duration budgets (15m, 30m, 45m, 60m, 90m).
* **Pedagogical Constraints:**
  * Strict cognitive pacing: $\text{Warmup} \prec \text{Core} \prec \text{Consolidation}$.
  * Prerequisite Knowledge Graph dependencies: Unblocks topics only when prerequisite mastery $P(L) \ge 0.50$.
  * Modality anti-repetition: Discourages consecutive identical study activities.

---

## 3. High-Level Service Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER (React 18)                         │
│  • Dashboard  • AI Tutor Chat  • Quiz Arena  • Flashcards  • Model Science   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / WebSocket
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GATEWAY & FASTAPI BACKEND                          │
│  ┌───────────────────────┬─────────────────────────┬─────────────────────┐  │
│  │ Authentication & RBAC │ RAG & Document Services │ Cognitive Routers   │  │
│  │ JWT / BCrypt / OAuth  │ PyPDF / BM25 / ChromaDB │ BKT / CAT / REC-01  │  │
│  └───────────────────────┴─────────────────────────┴─────────────────────┘  │
│                                      │                                      │
│                ┌─────────────────────┴─────────────────────┐                │
│                ▼                                           ▼                │
│   ┌─────────────────────────┐                 ┌─────────────────────────┐   │
│   │ DATABASE (PostgreSQL)   │                 │ CACHE & BROKER (Redis)  │   │
│   │ • Relational tables     │                 │ • Celery task queue     │   │
│   │ • Event-sourced ledger  │                 │ • WebSocket presence    │   │
│   └─────────────────────────┘                 └─────────────────────────┘   │
│                │                                           │                │
│                └─────────────────────┬─────────────────────┘                │
│                                      ▼                                      │
│                        ┌─────────────────────────┐                          │
│                        │ CELERY ASYNC WORKERS    │                          │
│                        │ • PDF OCR & Audio Cast  │                          │
│                        │ • Item Calibration MLOps│                          │
│                        └─────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Architectural Boundaries & Data Flow Guarantees

1. **State Snapshot Immutability:**
   The recommendation engine (`recommendation_service.py`) never mutates student records. It receives a frozen, read-only `LearnerStateSnapshot` projected from the event ledger, ensuring strict mathematical reproducibility.
2. **Deterministic Evaluation:**
   The evaluation suite (`Backend/benchmarks/`) operates in complete isolation from the production database, verifying algorithm correctness against localized synthetic cohorts.
3. **Idempotency:**
   All assessment and study logging endpoints require idempotent keys to prevent duplicate event recording under network retries.
