
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from database.vector_db import VectorDB
from utils.llm_client import llm_client
from pydantic import BaseModel, Field
import json
import logging

logger = logging.getLogger(__name__)

class PlannerOutput(BaseModel):
    intro: str
    points: List[Dict[str, str]]
    example: str
    conclusion: str
    word_budget: Dict[str, int]
    claims_to_verify: List[str]

class VerificationResult(BaseModel):
    claim: str
    is_verified: bool
    reason: str

class VerifierOutput(BaseModel):
    verified_answer: str
    verification_results: List[VerificationResult]
    confidence_score: float

class AnswerPlannerService:
    def __init__(self):
        self.vector_db = VectorDB()

    async def get_context(self, question: str, document_id: int, db: Session) -> str:
        from models.database import Document
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc or not doc.vector_db_id:
            return ""
        
        results = self.vector_db.query_documents(doc.vector_db_id, question, n_results=5)
        if results and results.get('documents'):
            return "\n".join(results['documents'][0])
        return ""

    async def generate_plan(self, question: str, marks: int, subject: str, answer_type: str, context: str) -> PlannerOutput:
        prompt = f"""
        STAGE 1 — PLANNER (STRUCTURE ONLY)
        INPUT:
        - question: {question}
        - marks: {marks}
        - subject: {subject}
        - answer_type: {answer_type}
        - retrieved_context: {context}

        TASK: Generate an exam-ready answer structure ONLY.
        MARKING RULES:
        - 1 mark → definition only
        - 2–3 marks → 2–3 key points
        - 5 marks → intro + key points + example + conclusion
        - 8–10 marks → structured headings + detailed points + example + conclusion

        OUTPUT (STRICT JSON ONLY):
        {{
          "intro": "...",
          "points": [{{ "text": "...", "importance": "high | medium | low" }}],
          "example": "...",
          "conclusion": "...",
          "word_budget": {{ "intro": 20, "points_total": 100, "example": 30, "conclusion": 20 }},
          "claims_to_verify": ["..."]
        }}
        """
        resp = await llm_client.generate_response(prompt, response_format="json_object")
        cleaned_resp = resp.strip()
        if cleaned_resp.startswith("```"):
            cleaned_resp = cleaned_resp.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return PlannerOutput.model_validate_json(cleaned_resp)

    async def generate_answer(self, planner_output: PlannerOutput, context: str, question: str) -> str:
        prompt = f"""
        STAGE 2 — WRITER (FOLLOW STRUCTURE STRICTLY)
        INPUT:
        - planner_output: {planner_output.model_dump_json()}
        - retrieved_context: {context}
        - question: {question}

        TASK: Generate FINAL exam answer using ONLY planner_output.
        RULES:
        - MUST follow structure exactly.
        - DO NOT add new points.
        - DO NOT reorder sections.
        - MUST be concise and exam-oriented.
        - Use bullet points where appropriate.
        - If the question involves a process, lifecycle, algorithm, hierarchy, or architecture, include a clean ```mermaid flowchart (graph TD or sequenceDiagram) to secure full diagram marks.

        OUTPUT: Plain markdown final answer with headings and optional mermaid diagram.
        """
        return await llm_client.generate_response(prompt)

    async def verify_answer(self, final_answer: str, context: str, claims: List[str]) -> VerifierOutput:
        prompt = f"""
        STAGE 3 — VERIFIER (CHAIN OF VERIFICATION)
        INPUT:
        - final_answer: {final_answer}
        - retrieved_context: {context}
        - claims_to_verify: {json.dumps(claims)}

        TASK: Validate factual correctness.
        RULES:
        - Check each claim against retrieved_context.
        - If incorrect → correct or remove it.
        - DO NOT change structure unless factually required.

        OUTPUT (STRICT JSON ONLY):
        {{
          "verified_answer": "...",
          "verification_results": [{{ "claim": "...", "is_verified": true, "reason": "..." }}],
          "confidence_score": 0.0
        }}
        """
        resp = await llm_client.generate_response(prompt, response_format="json_object")
        cleaned_resp = resp.strip()
        if cleaned_resp.startswith("```"):
            cleaned_resp = cleaned_resp.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return VerifierOutput.model_validate_json(cleaned_resp)

    async def full_pipeline(self, question: str, marks: int, subject: str, answer_type: str, document_id: int, db: Session) -> Dict[str, Any]:
        context = await self.get_context(question, document_id, db)
        
        # Stage 1: Plan
        plan = await self.generate_plan(question, marks, subject, answer_type, context)
        
        # Stage 2: Write
        raw_answer = await self.generate_answer(plan, context, question)
        
        # Stage 3: Verify
        verified_data = await self.verify_answer(raw_answer, context, plan.claims_to_verify)
        
        return {
            "plan": plan.model_dump(),
            "final_answer": verified_data.verified_answer,
            "verification": verified_data.verification_results,
            "confidence": verified_data.confidence_score
        }
