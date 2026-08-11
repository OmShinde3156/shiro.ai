
# PROJECT BLUEPRINT: Shiro.ai (SnapLearn Flow Alignment)

## 1. PRD (Product Requirements Document)
**Vision:** A "Learning Operating System" that transforms passive content into active study tools.

### Core Features (The SnapLearn Loop)
- **Multimodal Input:**
    - YouTube URL ingestion (Transcript extraction).
    - PDF/DOCX/Image uploads (OCR-enabled).
    - *Future:* Live lecture recording & real-time transcription.
- **AI Transformation (The "Big 4"):**
    1. **Concise Notes:** Structured, hierarchical summaries with visual pointers.
    2. **Active Recall Flashcards:** Auto-generated SM-2 backed cards.
    3. **Interactive Quizzes:** Dynamic MCQ/Subjective tests.
    4. **Study Podcasts:** Text-to-speech audio versions for mobile learning.
- **Truth-Aware Chat:** Context-grounded AI tutor (GraphRAG) that answers questions solely based on provided sources.
- **Answer Planner:** (Implemented) 3-stage pipeline (Plan-Write-Verify) for exam responses.

### Success Criteria
- **Grounding:** 0% hallucination rate (AI must only use provided context).
- **Latency:** Transformation from source to "Big 4" in under 30 seconds.
- **Retention:** User-reported mastery improvement through SRS/Feynman challenge.

---

## 2. App Flow (The User Journey)

1. **Onboarding:** User lands on a Bento-style Dashboard.
2. **Ingestion:** User clicks "Add Source" (Modal) -> Chooses PDF or YouTube Link.
3. **Processing:** Shiro background worker extracts text and builds the Epistemic Graph.
4. **Toolbox:** User selects a tool from the "Quick Helps" grid:
    - *Summarize* -> Directs to Notes view.
    - *Quiz* -> Directs to Quiz Arena.
    - *Flashcards* -> Directs to SM-2 Review flow.
    - *Podcast* -> Directs to Audio Hub.
5. **Deep Work:** User enters "Study Room" for focused reading with the AI Tutor and Scratchpad.

---

## 3. Tech Stack (Confirmed)

- **Frontend:** React + Vite + Tailwind (Neon Theme) + Framer Motion.
- **Backend:** FastAPI (Python) + SQLAlchemy.
- **Database:** PostgreSQL (Relational) + ChromaDB (Vector/Graph).
- **Task Queue:** Celery + Redis (Handles Podcast/PDF processing).
- **AI Engine:** Gemini 1.5 Pro/Flash + Whisper (STT) + gTTS (TTS).

---

## 4. Backend Schema (Blueprints)

### Core Entities
- **Users:** Auth, XP, Level, Streaks.
- **Documents:** Source material, Content Hash (Idempotence), Vector Collection IDs.
- **Epistemic Graph:** KnowledgeNodes & KnowledgeEdges (The brain).
- **StudyMaterials:** Quizzes, Flashcards, Summaries, Podcasts (linked to Documents).
- **AnswerPlans:** Structured exam blueprints.

---

## 5. Implementation Plan (v5.0 Evolution)

### Phase 1: Infrastructure (COMPLETED)
- [x] Truth-Aware GraphRAG & CoVe pipeline.
- [x] Idempotent ingestion (SHA-256).
- [x] Redis Fallback logic.

### Phase 2: Core Transformation (IN PROGRESS)
- [x] Multi-Stage Answer Engine.
- [x] Bento Library & Dashboard.
- [ ] *Next:* Refine Audio Podcast generation (ensure high-fidelity scripts).

### Phase 3: Spatial UI & Swarms (ROADMAP)
- [ ] **3D Knowledge Galaxy:** Three.js visualization of cross-doc concepts.
- [ ] **Autonomous Swarms:** Background agents flagging contradictions between different PDFs.
- [ ] **Live Lecture Mode:** Real-time STT to Note transformation.
