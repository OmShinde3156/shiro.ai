# Technical Decisions

This document outlines the rationale behind the architectural choices and technologies used in Shiro.ai.

## 1. FastAPI (Backend Framework)
**Why:**
- **Asynchronous by Design**: Perfect for handling multiple concurrent LLM API calls and background task delegations without blocking.
- **Performance**: Built on Starlette and Pydantic, offering excellent throughput and automatic data validation/serialization.
- **Developer Experience**: Auto-generated interactive API documentation (Swagger UI).

## 2. Celery + Redis (Background Tasks)
**Why:**
- **Heavy Processing**: Tasks like podcast generation (TTS), PDF parsing, and mind map creation are computationally expensive and time-consuming.
- **Non-blocking UX**: By offloading these tasks to Celery, the FastAPI server responds immediately, keeping the frontend snappy while the user waits for background jobs.
- **Redis as Broker**: Provides a fast, reliable message broker to distribute tasks between FastAPI and Celery workers.

## 3. ChromaDB (Vector Database)
**Why:**
- **Local & Lightweight**: Easy to embed within a Python environment without needing a separate cloud database during early development.
- **RAG Architecture**: Highly optimized for storing document embeddings and performing semantic similarity searches, crucial for the core "Chat with Document" feature.

## 4. Google Gemini & Groq (AI Models)
**Why:**
- **Gemini**: Excellent context window capabilities and robust multimodal reasoning, making it ideal for deep summarization and extracting interconnected concepts.
- **Groq**: Provides lightning-fast inference for smaller, specialized tasks where latency is critical (e.g., immediate feedback in the Feynman room or quick quiz generation).

## 5. SQLite (Relational Database)
**Why:**
- **Simplicity**: No external database server required, making setup and local development frictionless.
- **Current Needs**: Sufficient for managing user profiles, tracking study progress, and storing structured metadata (quizzes, flashcards) before scaling to a production DB like PostgreSQL.
