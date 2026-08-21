import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from pathlib import Path
from openai import OpenAI
from groq import Groq
import google.generativeai as genai
from sentence_transformers import SentenceTransformer
from pydantic import BaseModel, Field, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)

# --- Pydantic Models for Structured Output ---

class QuizOption(BaseModel):
    A: str
    B: str
    C: str
    D: str

class QuizQuestion(BaseModel):
    question: str
    options: QuizOption
    correct_answer: str = Field(pattern="^[ABCD]$", description="The correct option key, e.g., 'A'")
    explanation: str

class QuizResponse(BaseModel):
    questions: List[QuizQuestion]

class Flashcard(BaseModel):
    question: str
    answer: str

class FlashcardResponse(BaseModel):
    flashcards: List[Flashcard]

# --- Prompt Management ---

class Prompts:
    @staticmethod
    def quiz_prompt(content: str, num_questions: int, difficulty: str) -> str:
        return f"""
Generate {num_questions} Multiple Choice Questions (MCQs) based on the following content.
Difficulty: {difficulty}

Content:
{content}

Respond EXACTLY with a JSON object containing a "questions" array.
Schema:
{{
  "questions": [
    {{
      "question": "string",
      "options": {{"A": "string", "B": "string", "C": "string", "D": "string"}},
      "correct_answer": "A",
      "explanation": "string"
    }}
  ]
}}
"""

    @staticmethod
    def flashcard_prompt(content: str, num_cards: int) -> str:
        return f"""
Create {num_cards} flashcards based on the following content.

Content:
{content}

Respond EXACTLY with a JSON object containing a "flashcards" array.
Schema:
{{
  "flashcards": [
    {{
      "question": "string",
      "answer": "string"
    }}
  ]
}}
"""

    @staticmethod
    def summary_prompt(content: str, summary_type: str, language: str) -> str:
        return f"""
Summarize the following content in {language} language.
Summary Type: {summary_type}

Content:
{content}
"""


class LLMClient:
    def __init__(self):
        # Load .env from Backend folder
        env_path = Path(__file__).parent.parent / ".env"
        load_dotenv(dotenv_path=env_path)

        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.google_api_key = os.getenv("GOOGLE_API_KEY", os.getenv("GEMINI_API_KEY", "")).strip()
        
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        self.google_model = os.getenv("GOOGLE_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
        
        # Configure Skill-Anything environment variables
        if self.openai_api_key and self.openai_api_key != "sk-dummy-key-replace-me":
            os.environ["SKILL_ANYTHING_API_KEY"] = self.openai_api_key
            os.environ["SKILL_ANYTHING_MODEL"] = self.openai_model
        elif self.groq_api_key and self.groq_api_key != "gsk_dummy_key_replace_me":
            os.environ["SKILL_ANYTHING_API_KEY"] = self.groq_api_key
            os.environ["SKILL_ANYTHING_API_BASE"] = "https://api.groq.com/openai/v1"
            os.environ["SKILL_ANYTHING_MODEL"] = self.groq_model
            

        # Initialize clients ONLY if keys look valid
        self.openai_client = None
        if self.openai_api_key and self.openai_api_key != "sk-dummy-key-replace-me":
             try: self.openai_client = OpenAI(api_key=self.openai_api_key)
             except: pass

        self.groq_client = None
        if self.groq_api_key and self.groq_api_key != "gsk_dummy_key_replace_me": 
             try: self.groq_client = Groq(api_key=self.groq_api_key)
             except: pass

        # Initialize Gemini
        self.gemini_client = None
        if self.google_api_key and self.google_api_key != "your_google_api_key_here":
            try:
                genai.configure(api_key=self.google_api_key)
                self.gemini_client = genai.GenerativeModel(self.google_model)
            except Exception as e:
                logger.error(f"Failed to initialize Gemini: {e}")

        # Initialize embeddings model
        try:
            self.embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        except:
            self.embedding_model = None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10), retry=retry_if_exception_type(Exception))
    async def generate_response(self, prompt: str, context: str = "", response_format: str = "text") -> str:
        """
        Generates a response from the LLM. 
        Supports structured JSON output natively via `response_format="json_object"`.
        Falls back through providers if one fails or returns invalid JSON.
        """
        full_prompt = f"Context: {context}\n\nQuestion: {prompt}" if context else prompt
        
        def _is_valid_json(text: str) -> bool:
            try:
                json.loads(self._clean_json_string(text))
                return True
            except:
                return False

        # 1. Try Groq First (Fastest / Primary for Surgical)
        if self.groq_client:
            try:
                kwargs = {
                    "model": self.groq_model,
                    "messages": [{"role": "user", "content": full_prompt}],
                    "temperature": 0.7,
                }
                if response_format == "json_object":
                    kwargs["response_format"] = {"type": "json_object"}
                    
                response = self.groq_client.chat.completions.create(**kwargs)
                content = response.choices[0].message.content
                if response_format == "json_object" and not _is_valid_json(content):
                    raise Exception("Groq returned invalid JSON")
                return content
            except Exception as e:
                logger.warning(f"Groq failed: {e}")

        # 2. Try OpenAI Second
        if self.openai_client:
            try:
                kwargs = {
                    "model": self.openai_model,
                    "messages": [{"role": "user", "content": full_prompt}],
                    "temperature": 0.7,
                }
                if response_format == "json_object":
                    kwargs["response_format"] = {"type": "json_object"}
                    
                response = self.openai_client.chat.completions.create(**kwargs)
                content = response.choices[0].message.content
                if response_format == "json_object" and not _is_valid_json(content):
                    raise Exception("OpenAI returned invalid JSON")
                return content
            except Exception as e:
                logger.warning(f"OpenAI failed: {e}")

        # 3. Try Gemini Third (Best at complex reasoning & JSON schemas)
        if self.gemini_client:
            try:
                gen_config = {}
                if response_format == "json_object":
                    gen_config["response_mime_type"] = "application/json"
                response = self.gemini_client.generate_content(full_prompt, generation_config=gen_config if gen_config else None)
                content = response.text
                if response_format == "json_object" and not _is_valid_json(content):
                    raise Exception("Gemini returned invalid JSON")
                return content
            except Exception as e:
                logger.warning(f"Gemini failed: {e}")

        if response_format == "json_object":
            raise Exception("All LLM providers (Groq, OpenAI, Gemini) failed to generate a JSON response. API keys might be missing or limits exceeded.")
            
            
        # Final Fallback
        return self._get_simulation_response(prompt)

    def _get_simulation_response(self, prompt: str) -> str:
        prompt_lower = prompt.lower()
        if any(word in prompt_lower for word in ["hi", "hello", "hey"]):
            return "Hey there! I'm Shiro. I'm currently running in Simulation Mode because I can't find valid API keys in the .env file. Once you add them, I can analyze your documents for real!"
        if "summarize" in prompt_lower:
            return "In Simulation Mode, I would provide a detailed summary here. Please add an API key to enable real AI processing."
        return "I'm Shiro, your AI mentor. I'm currently in Simulation Mode. To unlock my full potential, please provide a valid OpenAI, Groq, or Google API key in the Backend/.env file."

    def _clean_json_string(self, raw_str: str) -> str:
        """Strip markdown code block wrappers if the LLM incorrectly adds them."""
        raw_str = raw_str.strip()
        if raw_str.startswith("```"):
            lines = raw_str.split("\n")
            if lines[0].startswith("```"): lines = lines[1:]
            if lines and lines[-1].startswith("```"): lines = lines[:-1]
            raw_str = "\n".join(lines).strip()
        return raw_str

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def generate_quiz_questions(self, content: str, num_questions: int, difficulty: str) -> List[Dict[str, Any]]:
        # If no real client, return sample quiz
        if not (self.openai_client or self.groq_client):
            return [{"question": "What is AI?", "options": {"A": "A robot", "B": "Artificial Intelligence", "C": "A movie", "D": "A fruit"}, "correct_answer": "B", "explanation": "AI stands for Artificial Intelligence."}] * num_questions

        # We relaxed the arbitrary limit slightly, but true dynamic RAG handles size later.
        prompt = Prompts.quiz_prompt(content[:10000], num_questions, difficulty)
        resp = await self.generate_response(prompt, response_format="json_object")
        
        try:
            # Pydantic native schema validation guarantees correctness
            clean_resp = self._clean_json_string(resp)
            validated_data = QuizResponse.model_validate_json(clean_resp)
            return [q.model_dump() for q in validated_data.questions]
        except ValidationError as e:
            logger.error(f"Pydantic Validation failed: {e}. Raw response: {resp}")
            raise # Triggers Tenacity retry!

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def generate_flashcards(self, content: str, num_cards: int) -> List[Dict[str, str]]:
        if not (self.openai_client or self.groq_client):
            return [{"question": "Concept", "answer": "Explanation"}] * num_cards
            
        prompt = Prompts.flashcard_prompt(content[:10000], num_cards)
        resp = await self.generate_response(prompt, response_format="json_object")
        
        try:
            clean_resp = self._clean_json_string(resp)
            validated_data = FlashcardResponse.model_validate_json(clean_resp)
            return [f.model_dump() for f in validated_data.flashcards]
        except ValidationError as e:
            logger.error(f"Pydantic Validation failed: {e}. Raw response: {resp}")
            raise # Triggers Tenacity retry!

    async def generate_summary(self, content: str, summary_type: str, language: str) -> str:
        prompt = Prompts.summary_prompt(content[:10000], summary_type, language)
        return await self.generate_response(prompt)

    async def get_youtube_transcript_gemini(self, video_url: str) -> Optional[str]:
        """
        Extract transcript/content from a YouTube video using Gemini 2.0 Flash's native capabilities.
        Bypasses most bot detection since it runs on Google's infrastructure.
        """
        if not self.gemini_client:
            return None

        prompt = f"Please provide a comprehensive and detailed transcript or a very detailed summary of this YouTube video: {video_url}. If you can't access the transcript directly, describe the content based on what you know about the video."
        
        try:
            # We use a standard generative call; Gemini 2.0 Flash is multimodal-ready
            response = await asyncio.to_thread(self.gemini_client.generate_content, prompt)
            return response.text
        except Exception as e:
            logger.error(f"Gemini YouTube extraction failed: {e}")
            return None

    async def generate_mindmap_data(self, content: str, topic: str) -> Dict[str, Any]:
        # Minimal mock for now. Can be upgraded with Pydantic later.
        return {"nodes": [{"id": "1", "label": topic, "level": 0, "x": 0, "y": 0}], "edges": []}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def generate_quiz_questions_optimized(self, prompt: str) -> List[Dict[str, Any]]:
        """Specialized method for high-yield question generation"""
        if not (self.openai_client or self.groq_client):
            return [{"question": "Optimized Sample Question", "options": {"A":"1","B":"2","C":"3","D":"4"}, "correct_answer":"A", "explanation":"Simulated response"}]

        schema_prompt = prompt + """
        
        Respond EXACTLY with a JSON object containing a "questions" array.
        Schema: { "questions": [ { "question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correct_answer": "A", "explanation": "..." } ] }
        """
        
        resp = await self.generate_response(schema_prompt, response_format="json_object")
        try:
            clean_resp = self._clean_json_string(resp)
            validated_data = QuizResponse.model_validate_json(clean_resp)
            return [q.model_dump() for q in validated_data.questions]
        except ValidationError as e:
            logger.error(f"Pydantic Validation failed: {e}. Raw response: {resp}")
            raise

llm_client = LLMClient()
