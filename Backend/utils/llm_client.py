import os
import json
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from pathlib import Path
from openai import OpenAI
from groq import Groq
from sentence_transformers import SentenceTransformer

class LLMClient:
    def __init__(self):
        # Load .env from Backend folder
        env_path = Path(__file__).parent.parent / ".env"
        load_dotenv(dotenv_path=env_path)

        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        
        # Initialize clients ONLY if keys look valid (not placeholders or empty)
        self.openai_client = None
        if self.openai_api_key and not self.openai_api_key.startswith("your-"):
            try:
                self.openai_client = OpenAI(api_key=self.openai_api_key)
            except: pass

        self.groq_client = None
        if self.groq_api_key and not self.groq_api_key.startswith("your-"):
            try:
                self.groq_client = Groq(api_key=self.groq_api_key)
            except: pass

        # Initialize embeddings model
        try:
            self.embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        except:
            self.embedding_model = None

    async def generate_response(self, prompt: str, context: str = "") -> str:
        full_prompt = f"Context: {context}\n\nQuestion: {prompt}" if context else prompt
        
        # 1. Try Groq First
        if self.groq_client:
            try:
                response = self.groq_client.chat.completions.create(
                    model=self.groq_model,
                    messages=[{"role": "user", "content": full_prompt}],
                    temperature=0.7,
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"DEBUG: Groq failed: {e}")

        # 2. Try OpenAI Second
        if self.openai_client:
            try:
                response = self.openai_client.chat.completions.create(
                    model=self.openai_model,
                    messages=[{"role": "user", "content": full_prompt}],
                    temperature=0.7,
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"DEBUG: OpenAI failed: {e}")

        # 3. Final Fallback: Simulation Mode (Ensures UI works for testing)
        return self._get_simulation_response(prompt)

    def _get_simulation_response(self, prompt: str) -> str:
        prompt_lower = prompt.lower()
        if "summarize" in prompt_lower:
            return "Based on your study materials, the main concepts involve personalized learning and AI-driven task management. The material emphasizes efficiency and deep focus."
        if "quiz" in prompt_lower:
            return "I've analyzed your material. You should focus on chapters 2 and 4, as they contain the most critical information for your upcoming test."
        return "I'm currently in Simulation Mode because your API keys are invalid or missing. To get real AI responses, please update your .env file with a valid OpenAI or Groq API key."

    async def generate_quiz_questions(self, content: str, num_questions: int, difficulty: str) -> List[Dict[str, Any]]:
        # If no real client, return sample quiz
        if not (self.openai_client or self.groq_client):
            return [{"question": "What is AI?", "options": {"A": "A robot", "B": "Artificial Intelligence", "C": "A movie", "D": "A fruit"}, "correct_answer": "B", "explanation": "AI stands for Artificial Intelligence."}] * num_questions

        prompt = f"""
        Generate {num_questions} Multiple Choice Questions (MCQs) in JSON format based on the following content:
        {content[:4000]}
        
        Difficulty: {difficulty}
        
        The response MUST be a valid JSON list of objects, each with exactly these fields:
        - "question": string
        - "options": a dictionary with keys "A", "B", "C", "D" and their string values
        - "correct_answer": string (exactly "A", "B", "C", or "D")
        - "explanation": string
        """
        resp = await self.generate_response(prompt)
        try:
            return self._extract_json(resp)
        except Exception as e:
            print(f"DEBUG: Quiz JSON extraction failed: {e}")
            return [{"question": "Sample Question", "options": {"A":"1","B":"2","C":"3","D":"4"}, "correct_answer":"A", "explanation":"Fallback due to AI error"}] * num_questions

    async def generate_flashcards(self, content: str, num_cards: int) -> List[Dict[str, str]]:
        if not (self.openai_client or self.groq_client):
            return [{"question": "Concept", "answer": "Explanation"}] * num_cards
        prompt = f"""
        Create {num_cards} flashcards as a JSON list based on the following content:
        {content[:4000]}
        
        Each flashcard MUST be an object with exactly these fields:
        - "question": string
        - "answer": string
        """
        resp = await self.generate_response(prompt)
        try:
            return self._extract_json(resp)
        except Exception as e:
            print(f"DEBUG: Flashcard JSON extraction failed: {e}")
            return [{"question": "Error", "answer": "Check API keys or AI output format"}]

    async def generate_summary(self, content: str, summary_type: str, language: str) -> str:
        prompt = f"""
        Summarize the following content in {language} language.
        Summary Type: {summary_type}
        
        Content:
        {content[:6000]}
        """
        return await self.generate_response(prompt)

    async def generate_mindmap_data(self, content: str, topic: str) -> Dict[str, Any]:
        return {"nodes": [{"id": "1", "label": topic, "level": 0, "x": 0, "y": 0}], "edges": []}

    def _extract_json(self, text: str) -> Any:
        text = text.strip()
        if "```json" in text: text = text.split("```json")[1].split("```")[0]
        elif "```" in text: text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())

llm_client = LLMClient()
