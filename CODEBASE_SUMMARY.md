# 🏯 Shiro.ai — Complete Codebase & Architectural Summary

Shiro.ai is an editorial, high-performance AI learning platform designed to turn complex academic study materials into mastery through active recall, neural audio, structured decision engines, and deep pedagogical feedback.

---

## 🌟 Core Feature Architectures

### 1. 🎙️ Audio Lab: Episodic Podcast & Series Engine
* **2-Phase Narrative Synthesis**:
  * **Phase 1: Episodic Blueprint**: The reasoning LLM drafts an overarching $N$-part curriculum with explicit continuity hooks (`opening_hook`, `previous_recap`, `core_focus`, `ending_takeaway`, `next_episode_hook`).
  * **Phase 2: Scriptwriting & Bounded Generation**: Generates dialogue adhering to exact duration word budgets, preventing prompt/token overflow errors on large documents.
* **Duration Controls**:
  * ⚡ **Quick (3–5 min)**: ~450–650 words. Fast revision & core definitions.
  * 🎯 **Standard (8–12 min)**: ~1,100–1,450 words. Balanced inquiry & intuition.
  * 📚 **Masterclass (15–20 min)**: ~2,000–2,500 words. Exhaustive walkthrough with historical & technical depth.
* **Neural Edge-TTS Voices**: High-fidelity Microsoft Neural Speech (`en-US-AndrewNeural` as professorial Host & `en-US-AvaNeural` as insightful Co-Host).
* **Subject Folders & Directory Player**: Organizes audio casts into canonical subject accordions (`Computer Science`, `Physics`, `Mathematics`, `DBMS`) with continuous autoplay and persistent `localStorage` resume.

---

### 2. 📊 Progress + Decision Center
Answers three fundamental questions for every student:
> **How am I doing? → What am I weak at? → What should I do next?**

* **Learning Health Hero**:
  * Dynamic takeaway sentence (e.g. *"You're improving steadily (+6% this month). Your biggest opportunity is Operating Systems."*).
  * 4 compact stat cards: Overall Mastery, Quiz Accuracy, Cards Retained, and Study Streak.
  * Transparent data tagging: New accounts display `[ Demo Sample Mode ]` to preserve telemetry honesty.
* **"What to Study Next" (Dominant Recovery Card)**:
  * High-contrast hero card with adaptive 3-step recovery sequences:
    * *Quiz Errors*: Concept review → 5 targeted MCQs → Feynman gap check.
    * *Overdue Cards*: 3 min refresh → Clear due flashcards → FSRS consolidation.
    * *Conceptual Gap*: Feynman simple explanation challenge → Gap identification → Practice.
  * **"Why this recommendation?"**: Expandable disclosure revealing telemetry justification.
  * **1-Click Execution**: Direct launch into `/quiz`, `/flashcards`, or `/feynman` with topic & document context.
* **Horizontal Subject Mastery Bars**:
  * Color-coded progress bars with status tags (`Mastered`, `Developing`, `Needs Review`) and trend deltas. Click-to-study capability on each row.
* **Multi-Timeframe Performance Area Graph**:
  * Timeframe selectors: `Week (7D)`, `Month (30D)`, `Quarter (90D)`, `Year (1Y)` with full date distributions.
  * AreaChart with Sage green gradient fill, 80% Mastery Benchmark line, milestone badge strip, and dynamic net velocity computation.
* **Study Activity Heatmap & Cognitive Peak**:
  * Habit consistency grid with 4 intensity levels.
  * Evidence-based peak learning window with transparent confidence metrics.

---

### 3. ⚡ Dual-Engine Hybrid AI Gateway (`AIGateway`)
* **Intelligent Provider Routing**:
  * **Deep Reasoning / Curriculum Planning**: Groq `openai/gpt-oss-120b`.
  * **Fast Interactive / Strict JSON Mode**: Groq `qwen/qwen3.8-27b` (100% native hardware JSON validator compatibility).
  * **Secondary Cloud Fallback**: Google Gemini 3.6 Flash (`gemini-3.6-flash`).
  * **Self-Healing Truncation**: Catches oversized payloads, automatically truncates prompts to 10,000 characters, and retries on alternate models.
* **Full Token & Monetary Cost Telemetry**:
  * Micro-dollar accounting recorded in `ai_request_logs` with latency tracking and fallback flags.

---

### 4. 🧠 Feynman Technique & Deep Critique
* Multi-dimensional pedagogical evaluation:
  * Core accuracy score
  * Intuition & simplicity score
  * Knowledge boundary analysis
  * Jargon crutch detection
* Interactive voice chat mode with natural-sounding student interactions.

---

### 5. 🔍 Hybrid RAG & Vector Intelligence
* Local ChromaDB embeddings (`all-MiniLM-L6-v2`) with cosine similarity.
* Semantic chunking preserving mathematical formatting, code snippets, and table structures.
* Answer Planner generating structured exam-ready responses.

---

## 🗂️ Project Directory Topology

```text
study.ai/
├── Backend/
│   ├── database/         # SQLite + WAL concurrency, ChromaDB vector store
│   ├── models/           # SQLAlchemy models & Pydantic validation schemas
│   ├── routers/          # FastAPI routers (features, auth, rooms, progress)
│   ├── services/         # Core business logic (podcast, progress, chat, feynman, quiz)
│   ├── utils/            # Hybrid AIGateway (Groq/Gemini), Neural TTS Client
│   ├── tasks.py          # Background async processor for podcast generation
│   ├── main.py           # Application entrypoint & middleware configuration
│   └── tests/            # Automated Pytest suite (95+ passing unit tests)
│
├── Frontend/
│   ├── src/
│   │   ├── components/   # Atomic UI (Buttons, Badges, Header, Sidebar)
│   │   ├── context/      # AuthContext & global study state Context
│   │   ├── features/
│   │   │   ├── chat/     # Interactive AI tutor chat & conversation persistence
│   │   │   ├── study/    # AudioSummary, Flashcards, Quiz, Feynman, MindMap, PYQs
│   │   │   ├── insights/ # ProgressReport Decision Center, AnswerPlanner, Settings
│   │   │   └── library/  # DocumentsPage & DocumentDetailsPage
│   │   └── api/          # Fetch wrappers & streaming clients
│   └── index.html        # KaTeX & Google Fonts (Inter, Newsreader)
```

---

## 🧪 Testing & Validation Matrix
* **Backend Pytest**: `Backend/tests/` — All test suites passing.
* **AI Gateway Matrix**: `Backend/scripts/test_hybrid_ai.py` — All 6 routing, reasoning, and cloud failover tests passing.
* **Frontend Vite Build**: `npm run build` — 0 errors, compiled in production bundle.
