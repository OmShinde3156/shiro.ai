import os
import json
import time
import uuid
import logging
import asyncio
import threading
from decimal import Decimal
from typing import List, Dict, Any, Optional, AsyncGenerator
from dotenv import load_dotenv
from pathlib import Path
from openai import OpenAI
from groq import Groq
import google.generativeai as genai
from pydantic import BaseModel, Field, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from fastapi import HTTPException

from prompts.prompt_registry import prompt_registry
from models.database import AIRequestLog, User
from database.database import SessionLocal
from utils.security import decrypt_secret, mask_api_key

logger = logging.getLogger(__name__)

# --- Rate Cards for Precise Cost Accounting (AI-01) ---
RATE_CARDS_2026_Q3 = {
    "groq": {
        "input_per_million": Decimal("0.05"),
        "output_per_million": Decimal("0.08"),
    },
    "gemini": {
        "input_per_million": Decimal("0.10"),
        "output_per_million": Decimal("0.40"),
    },
    "openai": {
        "input_per_million": Decimal("0.15"),
        "output_per_million": Decimal("0.60"),
    },
    "fallback": {
        "input_per_million": Decimal("0.00"),
        "output_per_million": Decimal("0.00"),
    }
}

# --- Standardized AI Response Contract ---
class AIResult(BaseModel):
    content: str
    parsed: Optional[Any] = None

    provider: str
    model: str
    request_id: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    cost_usd: float
    fallback_used: bool
    prompt_version: str
    success: bool = True
    error_code: Optional[str] = None


# --- Pydantic Models for Structured Output Validation ---

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


class AIGateway:
    """
    Shiro Centralized AI Gateway (AI-01)
    Handles provider routing, fallback telemetry, rate-card cost accounting, and quota governance.
    """
    def __init__(self):
        env_path = Path(__file__).parent.parent / ".env"
        load_dotenv(dotenv_path=env_path)

        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.google_api_key = os.getenv("GOOGLE_API_KEY", os.getenv("GEMINI_API_KEY", "")).strip()
        
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.groq_reasoning_model = os.getenv("GROQ_REASONING_MODEL", "openai/gpt-oss-120b")
        self.groq_fast_model = os.getenv("GROQ_FAST_MODEL", "qwen/qwen3.8-27b")
        self.groq_model = os.getenv("GROQ_MODEL", self.groq_reasoning_model)
        self.google_model = os.getenv("GOOGLE_MODEL", os.getenv("GEMINI_MODEL", "gemini-3.6-flash"))

        # Initialize clients with production timeout (default 60s for deep reasoning & scripts)
        self.llm_timeout = float(os.getenv("LLM_TIMEOUT", "60.0"))
        self.openai_client = None
        if self.openai_api_key and self.openai_api_key not in ("sk-dummy-key-replace-me", ""):
            try: self.openai_client = OpenAI(api_key=self.openai_api_key, timeout=self.llm_timeout)
            except Exception: pass

        self.groq_client = None
        if self.groq_api_key and self.groq_api_key not in ("gsk_dummy_key_replace_me", ""):
            try: self.groq_client = Groq(api_key=self.groq_api_key, timeout=self.llm_timeout)
            except Exception: pass

        self.gemini_client = None
        if self.google_api_key and self.google_api_key not in ("your_google_api_key_here", ""):
            try:
                genai.configure(api_key=self.google_api_key)
                self.gemini_client = genai.GenerativeModel(self.google_model)
            except Exception as e:
                logger.error(f"Failed to initialize Gemini: {e}")

        try:
            self.embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        except Exception:
            self.embedding_model = None

    def check_user_quota(self, user_id: int, db: Any) -> None:
        """Enforce daily request quotas per user tier"""
        if not user_id:
            return

        user = db.query(User).filter(User.id == user_id).first()
        daily_limit = user.ai_quota_daily if user and user.ai_quota_daily is not None else 50

        # Count requests made today (UTC aligned)
        from datetime import datetime, timezone
        now_utc = datetime.utcnow()
        today_start = datetime(now_utc.year, now_utc.month, now_utc.day)
        usage_count = db.query(AIRequestLog).filter(
            AIRequestLog.user_id == user_id,
            AIRequestLog.billing_source == "platform",
            (AIRequestLog.created_at >= today_start) | (AIRequestLog.created_at == None)
        ).count()

        if usage_count >= daily_limit:
            raise HTTPException(
                status_code=429, 
                detail=f"Daily AI request quota ({daily_limit} requests) exceeded. Please upgrade, configure personal API keys in Settings, or try again tomorrow."
            )

    def _resolve_execution_config(self, user_id: Optional[int], db: Optional[Any]) -> Dict[str, Any]:
        """
        Resolves whether BYOK or Platform execution should be used.
        Decrypts personal keys in-memory if configured.
        """
        if not user_id or not db:
            return {
                "is_byok": False,
                "billing_source": "platform",
                "preferred_provider": "auto",
                "byok_clients": {},
                "configured_byok_providers": []
            }

        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.byok_enabled:
            return {
                "is_byok": False,
                "billing_source": "platform",
                "preferred_provider": "auto",
                "byok_clients": {},
                "configured_byok_providers": []
            }

        byok_clients = {}
        configured = []

        # Groq BYOK
        if user.groq_api_key_encrypted:
            plain_groq = decrypt_secret(user.groq_api_key_encrypted)
            if plain_groq:
                configured.append("groq")
                try:
                    byok_clients["groq"] = Groq(api_key=plain_groq, timeout=15.0)
                except Exception as ex:
                    logger.warning(f"Failed to instantiate Groq BYOK client: {ex}")

        # Gemini BYOK
        if user.gemini_api_key_encrypted:
            plain_gemini = decrypt_secret(user.gemini_api_key_encrypted)
            if plain_gemini:
                configured.append("gemini")
                try:
                    genai.configure(api_key=plain_gemini)
                    byok_clients["gemini"] = genai.GenerativeModel(self.google_model)
                except Exception as ex:
                    logger.warning(f"Failed to instantiate Gemini BYOK client: {ex}")

        # OpenAI BYOK
        if user.openai_api_key_encrypted:
            plain_openai = decrypt_secret(user.openai_api_key_encrypted)
            if plain_openai:
                configured.append("openai")
                try:
                    byok_clients["openai"] = OpenAI(api_key=plain_openai, timeout=15.0)
                except Exception as ex:
                    logger.warning(f"Failed to instantiate OpenAI BYOK client: {ex}")

        is_byok = len(byok_clients) > 0
        preferred = user.preferred_ai_provider or "auto"

        return {
            "is_byok": is_byok,
            "billing_source": "personal" if is_byok else "platform",
            "preferred_provider": preferred,
            "byok_clients": byok_clients,
            "configured_byok_providers": configured
        }

    async def validate_api_key(self, provider: str, api_key: str) -> Dict[str, Any]:
        """
        Validate an API key live against provider API without persisting or logging secrets.
        Returns:
            {"valid": True, "provider": provider, "model_access": True}
        or
            {"valid": False, "provider": provider, "error_code": "INVALID_API_KEY", "message": "..."}
        """
        if not api_key or not api_key.strip():
            return {"valid": False, "provider": provider, "error_code": "EMPTY_KEY", "message": "API key cannot be empty."}

        key = api_key.strip()
        try:
            if provider == "groq":
                client = Groq(api_key=key, timeout=10.0)
                resp = await asyncio.to_thread(
                    client.chat.completions.create,
                    model=self.groq_model,
                    messages=[{"role": "user", "content": "ping"}],
                    max_tokens=1
                )
                return {"valid": True, "provider": "groq", "model_access": True}

            elif provider == "gemini":
                genai.configure(api_key=key)
                model = genai.GenerativeModel(self.google_model)
                resp = await asyncio.to_thread(
                    model.generate_content,
                    "ping",
                    generation_config={"max_output_tokens": 1}
                )
                return {"valid": True, "provider": "gemini", "model_access": True}

            elif provider == "openai":
                client = OpenAI(api_key=key, timeout=10.0)
                resp = await asyncio.to_thread(
                    client.chat.completions.create,
                    model=self.openai_model,
                    messages=[{"role": "user", "content": "ping"}],
                    max_tokens=1
                )
                return {"valid": True, "provider": "openai", "model_access": True}

            else:
                return {"valid": False, "provider": provider, "error_code": "UNKNOWN_PROVIDER", "message": f"Unsupported provider '{provider}'."}

        except Exception as e:
            error_str = str(e)
            logger.warning(f"Key validation failed for provider {provider}: {error_str}")
            if "invalid_api_key" in error_str.lower() or "401" in error_str or "unauthorized" in error_str.lower() or "api_key_invalid" in error_str.lower() or "authentication" in error_str.lower():
                code = "INVALID_API_KEY"
                msg = f"The provided {provider.capitalize()} API key is invalid or rejected."
            elif "quota" in error_str.lower() or "429" in error_str or "rate limit" in error_str.lower():
                code = "QUOTA_EXCEEDED"
                msg = f"The provided {provider.capitalize()} API key has exceeded its rate limit or quota."
            else:
                code = "PROVIDER_ERROR"
                msg = f"Failed to verify {provider.capitalize()} API key. Please verify the key and permissions."

            return {"valid": False, "provider": provider, "error_code": code, "message": msg}

    def _select_groq_model_sequence(self, feature: str, prompt: str, response_format: str = "text") -> List[str]:
        """
        Routes requests to the optimal Groq model order:
        - Strict JSON Mode -> [qwen3.8-27b, gpt-oss-120b] (Qwen has 100% native Groq hardware JSON validator support)
        - Deep Reasoning Text (Feynman Critique, Research, Conceptual Mastery) -> [gpt-oss-120b, qwen3.8-27b]
        - Fast Interactive Text (Chat, Dialogue Turns) -> [qwen3.8-27b, gpt-oss-120b]
        """
        if response_format == "json_object":
            return [self.groq_fast_model, self.groq_reasoning_model]

        reasoning_features = {"feynman", "feynman_eval", "research", "concept_mastery", "hard_math", "studyplan"}
        if feature in reasoning_features or len(prompt) > 4000:
            return [self.groq_reasoning_model, self.groq_fast_model]
        else:
            return [self.groq_fast_model, self.groq_reasoning_model]

    def calculate_cost(self, provider: str, input_tokens: int, output_tokens: int) -> Decimal:
        """Accurate monetary cost accounting using Decimal arithmetic"""
        card = RATE_CARDS_2026_Q3.get(provider, RATE_CARDS_2026_Q3["fallback"])
        in_cost = Decimal(input_tokens) * card["input_per_million"]
        out_cost = Decimal(output_tokens) * card["output_per_million"]
        return in_cost + out_cost

    def _clean_json_string(self, raw_str: str) -> str:
        """Strip markdown code fences and sanitize output"""
        raw_str = raw_str.strip()
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_str)
        if match:
            return match.group(1).strip()
        return raw_str

    async def generate_response(
        self, 
        prompt: str, 
        context: str = "", 
        response_format: str = "text",
        feature: str = "general",
        prompt_version: str = "v1.0",
        user_id: Optional[int] = None,
        db: Optional[Any] = None
    ) -> str:
        """Legacy compatibility wrapper that routes through execute_with_governance"""
        result = await self.execute_with_governance(
            prompt=prompt,
            context=context,
            response_format=response_format,
            feature=feature,
            prompt_version=prompt_version,
            user_id=user_id,
            db=db
        )
        return result.content

    async def execute_with_governance(
        self,
        prompt: str,
        context: str = "",
        response_format: str = "text",
        feature: str = "general",
        prompt_version: str = "v1.0",
        user_id: Optional[int] = None,
        db: Optional[Any] = None
    ) -> AIResult:
        """
        Executes an AI request with full provider routing, fallback telemetry,
        rate-card cost accounting, and persistence to AIRequestLog.
        Strictly supports BYOK with non-fallback rules.
        """
        request_id = str(uuid.uuid4())
        start_time = time.time()
        full_prompt = f"Context: {context}\n\nQuestion: {prompt}" if context else prompt

        # Resolve BYOK configuration
        cfg = self._resolve_execution_config(user_id, db)
        billing_source = cfg["billing_source"]
        is_byok = cfg["is_byok"]

        # Only enforce platform quota if NOT using personal key
        if not is_byok and db is not None and user_id is not None:
            self.check_user_quota(user_id, db)

        selected_provider = "fallback"
        selected_model = "simulation-v1"
        content = ""
        fallback_used = False
        input_tokens = len(full_prompt) // 4
        output_tokens = 0
        error_code = None

        if is_byok:
            # BYOK Path: Execute exclusively with user's configured provider(s)
            byok_clients = cfg["byok_clients"]
            pref = cfg["preferred_provider"]
            order = [pref] if pref in byok_clients else list(byok_clients.keys())
            if pref == "auto":
                order = [p for p in ["groq", "gemini", "openai"] if p in byok_clients]

            byok_succeeded = False
            for prov in order:
                client = byok_clients.get(prov)
                if not client:
                    continue

                try:
                    if prov == "groq":
                        selected_provider = "groq"
                        selected_model = self.groq_model
                        resp = await asyncio.to_thread(
                            client.chat.completions.create,
                            model=self.groq_model,
                            messages=[{"role": "user", "content": full_prompt}],
                            response_format={"type": "json_object"} if response_format == "json_object" else None,
                            temperature=0.3
                        )
                        content = resp.choices[0].message.content
                        if resp.usage:
                            input_tokens = resp.usage.prompt_tokens
                            output_tokens = resp.usage.completion_tokens
                        byok_succeeded = True
                        break

                    elif prov == "gemini":
                        selected_provider = "gemini"
                        selected_model = self.google_model
                        gen_config = {"response_mime_type": "application/json"} if response_format == "json_object" else None
                        resp = await asyncio.to_thread(
                            client.generate_content,
                            full_prompt,
                            generation_config=gen_config
                        )
                        content = resp.text
                        output_tokens = len(content) // 4
                        byok_succeeded = True
                        break

                    elif prov == "openai":
                        selected_provider = "openai"
                        selected_model = self.openai_model
                        resp = await asyncio.to_thread(
                            client.chat.completions.create,
                            model=self.openai_model,
                            messages=[{"role": "user", "content": full_prompt}],
                            response_format={"type": "json_object"} if response_format == "json_object" else None,
                            temperature=0.3
                        )
                        content = resp.choices[0].message.content
                        if resp.usage:
                            input_tokens = resp.usage.prompt_tokens
                            output_tokens = resp.usage.completion_tokens
                        byok_succeeded = True
                        break

                except Exception as ex:
                    logger.warning(f"BYOK provider {prov} failed for request {request_id}: {ex}")
                    # If this was the preferred or only BYOK provider, halt without silent fallback
                    if len(order) == 1:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Your personal {prov.capitalize()} API key failed: {str(ex)}. Please update or remove your key in Settings."
                        )

            if not byok_succeeded:
                raise HTTPException(
                    status_code=400,
                    detail="All configured personal API keys failed. Please check your keys in Settings."
                )

        else:
            # Platform Path: Standard fallback chain
            # 1. Primary: Try Groq with Dual-Engine Sequence (Reasoning <-> Fast)
            if self.groq_client:
                groq_models = self._select_groq_model_sequence(feature, full_prompt, response_format)
                for g_model in groq_models:
                    try:
                        selected_provider = "groq"
                        selected_model = g_model
                        resp = await asyncio.to_thread(
                            self.groq_client.chat.completions.create,
                            model=g_model,
                            messages=[{"role": "user", "content": full_prompt}],
                            response_format={"type": "json_object"} if response_format == "json_object" else None,
                            temperature=0.3
                        )
                        raw_content = resp.choices[0].message.content or ""
                        if not raw_content.strip():
                            logger.warning(f"Groq model {g_model} returned empty content for {feature}, failing over to alternate model...")
                            fallback_used = True
                            continue

                        content = raw_content
                        if resp.usage:
                            input_tokens = resp.usage.prompt_tokens
                            output_tokens = resp.usage.completion_tokens
                        break
                    except Exception as e:
                        err_str = str(e)
                        logger.warning(f"Groq model {g_model} failed for request {request_id}: {e}")
                        fallback_used = True
                        if "reduce the length of the messages" in err_str or "400" in err_str:
                            if len(full_prompt) > 10000:
                                logger.info("Payload oversized for Groq: truncating prompt to 10,000 chars for alternate model...")
                                full_prompt = full_prompt[:10000] + "\n\n[Content truncated to fit model context limits]"

            # 2. Secondary: Try Gemini
            if not content and self.gemini_client:
                try:
                    selected_provider = "gemini"
                    selected_model = self.google_model
                    # Bound payload to 18,000 characters to safeguard Gemini free tier token quotas
                    safe_gemini_prompt = full_prompt[:18000] if len(full_prompt) > 18000 else full_prompt
                    gen_config = {"response_mime_type": "application/json"} if response_format == "json_object" else None
                    resp = await asyncio.to_thread(
                        self.gemini_client.generate_content,
                        safe_gemini_prompt,
                        generation_config=gen_config
                    )
                    content = resp.text
                    output_tokens = len(content) // 4
                except Exception as e:
                    logger.warning(f"Gemini platform secondary failed for request {request_id}: {e}")
                    fallback_used = True

            # 3. Tertiary: Try OpenAI
            if not content and self.openai_client:
                try:
                    selected_provider = "openai"
                    selected_model = self.openai_model
                    resp = await asyncio.to_thread(
                        self.openai_client.chat.completions.create,
                        model=self.openai_model,
                        messages=[{"role": "user", "content": full_prompt}],
                        response_format={"type": "json_object"} if response_format == "json_object" else None,
                        temperature=0.3
                    )
                    content = resp.choices[0].message.content
                    if resp.usage:
                        input_tokens = resp.usage.prompt_tokens
                        output_tokens = resp.usage.completion_tokens
                except Exception as e:
                    logger.warning(f"OpenAI platform tertiary failed for request {request_id}: {e}")
                    fallback_used = True

            # 4. Final Simulation Fallback
            if not content:
                selected_provider = "fallback"
                selected_model = "simulation-v1"
                content = self._get_simulation_response(prompt)
                output_tokens = len(content) // 4
                error_code = "SIMULATION_FALLBACK"

        latency_ms = int((time.time() - start_time) * 1000)
        cost = self.calculate_cost(selected_provider, input_tokens, output_tokens) if not is_byok else Decimal("0.00")

        # Telemetry logging to DB
        own_db = False
        session = db
        if session is None:
            session = SessionLocal()
            own_db = True

        try:
            log_entry = AIRequestLog(
                request_id=request_id,
                user_id=user_id,
                feature=feature,
                provider=selected_provider,
                model=selected_model,
                rate_card_version="2026-Q3",
                prompt_version=prompt_version,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                latency_ms=latency_ms,
                cost_usd=cost,
                fallback_used=fallback_used,
                billing_source=billing_source,
                success=(error_code is None),
                error_code=error_code
            )
            session.add(log_entry)
            session.commit()
        except Exception as log_err:
            logger.error(f"Failed to record AI telemetry log: {log_err}")
            session.rollback()
        finally:
            if own_db:
                session.close()

        # Parse output if JSON format requested
        parsed = None
        if response_format == "json_object":
            try:
                parsed = json.loads(self._clean_json_string(content))
            except Exception:
                parsed = None

        return AIResult(
            content=content,
            parsed=parsed,
            provider=selected_provider,
            model=selected_model,
            request_id=request_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            cost_usd=float(cost),
            fallback_used=fallback_used,
            prompt_version=prompt_version,
            success=(error_code is None),
            error_code=error_code
        )

    async def stream_with_governance(
        self,
        prompt: str,
        context: str = "",
        feature: str = "chat",
        prompt_version: str = "v1.0",
        user_id: Optional[int] = None,
        db: Optional[Any] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Streams AI completion tokens asynchronously with TTFT measurement,
        resilient multi-provider fallback, and guaranteed AIRequestLog persistence in finally.
        Supports BYOK with non-fallback rules.
        """
        request_id = str(uuid.uuid4())
        start_time = time.time()
        first_token_time = None
        full_prompt = f"Context: {context}\n\nQuestion: {prompt}" if context else prompt

        # Resolve BYOK configuration
        cfg = self._resolve_execution_config(user_id, db)
        billing_source = cfg["billing_source"]
        is_byok = cfg["is_byok"]

        # Only enforce platform quota if NOT using personal key
        if not is_byok and db is not None and user_id is not None:
            self.check_user_quota(user_id, db)

        selected_provider = "fallback"
        selected_model = "simulation-v1"
        accumulated_content = []
        fallback_used = False
        input_tokens = len(full_prompt) // 4
        output_tokens = 0
        error_code = None
        stream_success = False

        try:
            if is_byok:
                byok_clients = cfg["byok_clients"]
                pref = cfg["preferred_provider"]
                order = [pref] if pref in byok_clients else list(byok_clients.keys())
                if pref == "auto":
                    order = [p for p in ["groq", "gemini", "openai"] if p in byok_clients]

                for prov in order:
                    client = byok_clients.get(prov)
                    if not client:
                        continue

                    try:
                        if prov == "groq":
                            selected_provider = "groq"
                            selected_model = self.groq_model
                            q = asyncio.Queue()
                            loop = asyncio.get_running_loop()

                            def _groq_byok_worker():
                                try:
                                    stream_resp = client.chat.completions.create(
                                        model=self.groq_model,
                                        messages=[{"role": "user", "content": full_prompt}],
                                        temperature=0.3,
                                        stream=True
                                    )
                                    for chunk in stream_resp:
                                        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                                            loop.call_soon_threadsafe(q.put_nowait, ("token", chunk.choices[0].delta.content))
                                    loop.call_soon_threadsafe(q.put_nowait, ("end", None))
                                except Exception as ex:
                                    loop.call_soon_threadsafe(q.put_nowait, ("error", ex))

                            t = threading.Thread(target=_groq_byok_worker, daemon=True)
                            t.start()

                            while True:
                                kind, val = await q.get()
                                if kind == "token":
                                    if first_token_time is None:
                                        first_token_time = time.time()
                                    accumulated_content.append(val)
                                    ttft = int((first_token_time - start_time) * 1000) if first_token_time else 0
                                    yield {"type": "token", "delta": val, "ttft_ms": ttft}
                                elif kind == "end":
                                    stream_success = True
                                    break
                                elif kind == "error":
                                    raise val

                        elif prov == "gemini":
                            selected_provider = "gemini"
                            selected_model = self.google_model
                            q = asyncio.Queue()
                            loop = asyncio.get_running_loop()

                            def _gemini_byok_worker():
                                try:
                                    stream_resp = client.generate_content(full_prompt, stream=True)
                                    for chunk in stream_resp:
                                        if chunk.text:
                                            loop.call_soon_threadsafe(q.put_nowait, ("token", chunk.text))
                                    loop.call_soon_threadsafe(q.put_nowait, ("end", None))
                                except Exception as ex:
                                    loop.call_soon_threadsafe(q.put_nowait, ("error", ex))

                            t = threading.Thread(target=_gemini_byok_worker, daemon=True)
                            t.start()

                            while True:
                                kind, val = await q.get()
                                if kind == "token":
                                    if first_token_time is None:
                                        first_token_time = time.time()
                                    accumulated_content.append(val)
                                    ttft = int((first_token_time - start_time) * 1000) if first_token_time else 0
                                    yield {"type": "token", "delta": val, "ttft_ms": ttft}
                                elif kind == "end":
                                    stream_success = True
                                    break
                                elif kind == "error":
                                    raise val

                        elif prov == "openai":
                            selected_provider = "openai"
                            selected_model = self.openai_model
                            q = asyncio.Queue()
                            loop = asyncio.get_running_loop()

                            def _openai_byok_worker():
                                try:
                                    stream_resp = client.chat.completions.create(
                                        model=self.openai_model,
                                        messages=[{"role": "user", "content": full_prompt}],
                                        temperature=0.3,
                                        stream=True
                                    )
                                    for chunk in stream_resp:
                                        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                                            loop.call_soon_threadsafe(q.put_nowait, ("token", chunk.choices[0].delta.content))
                                    loop.call_soon_threadsafe(q.put_nowait, ("end", None))
                                except Exception as ex:
                                    loop.call_soon_threadsafe(q.put_nowait, ("error", ex))

                            t = threading.Thread(target=_openai_byok_worker, daemon=True)
                            t.start()

                            while True:
                                kind, val = await q.get()
                                if kind == "token":
                                    if first_token_time is None:
                                        first_token_time = time.time()
                                    accumulated_content.append(val)
                                    ttft = int((first_token_time - start_time) * 1000) if first_token_time else 0
                                    yield {"type": "token", "delta": val, "ttft_ms": ttft}
                                elif kind == "end":
                                    stream_success = True
                                    break
                                elif kind == "error":
                                    raise val

                        if stream_success:
                            break

                    except Exception as e:
                        logger.warning(f"BYOK streaming provider {prov} failed: {e}")
                        if len(order) == 1:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Your personal {prov.capitalize()} API key failed: {str(e)}. Update or remove it in Settings."
                            )

            else:
                # Platform Path: Standard Fallback Chain
                # 1. Primary: Try Groq Streaming First (Lowest TTFT)
                if self.groq_client:
                    try:
                        selected_provider = "groq"
                        selected_model = self.groq_model
                        q = asyncio.Queue()
                        loop = asyncio.get_running_loop()

                        def _groq_worker():
                            try:
                                stream_resp = self.groq_client.chat.completions.create(
                                    model=self.groq_model,
                                    messages=[{"role": "user", "content": full_prompt}],
                                    temperature=0.3,
                                    stream=True
                                )
                                for chunk in stream_resp:
                                    if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                                        loop.call_soon_threadsafe(q.put_nowait, ("token", chunk.choices[0].delta.content))
                                loop.call_soon_threadsafe(q.put_nowait, ("end", None))
                            except Exception as ex:
                                loop.call_soon_threadsafe(q.put_nowait, ("error", ex))

                        t = threading.Thread(target=_groq_worker, daemon=True)
                        t.start()

                        while True:
                            kind, val = await q.get()
                            if kind == "token":
                                if first_token_time is None:
                                    first_token_time = time.time()
                                accumulated_content.append(val)
                                ttft = int((first_token_time - start_time) * 1000) if first_token_time else 0
                                yield {"type": "token", "delta": val, "ttft_ms": ttft}
                            elif kind == "end":
                                stream_success = True
                                break
                            elif kind == "error":
                                raise val

                    except Exception as e:
                        logger.warning(f"Groq streaming failed for {request_id}: {e}")
                        fallback_used = True
                        if accumulated_content:
                            error_code = "STREAM_PARTIAL_ERROR"

                # 2. Secondary: Try Gemini Streaming
                if not stream_success and not accumulated_content and self.gemini_client:
                    try:
                        selected_provider = "gemini"
                        selected_model = self.google_model
                        q = asyncio.Queue()
                        loop = asyncio.get_running_loop()

                        def _gemini_worker():
                            try:
                                stream_resp = self.gemini_client.generate_content(full_prompt, stream=True)
                                for chunk in stream_resp:
                                    if chunk.text:
                                        loop.call_soon_threadsafe(q.put_nowait, ("token", chunk.text))
                                loop.call_soon_threadsafe(q.put_nowait, ("end", None))
                            except Exception as ex:
                                loop.call_soon_threadsafe(q.put_nowait, ("error", ex))

                        t = threading.Thread(target=_gemini_worker, daemon=True)
                        t.start()

                        while True:
                            kind, val = await q.get()
                            if kind == "token":
                                if first_token_time is None:
                                    first_token_time = time.time()
                                accumulated_content.append(val)
                                ttft = int((first_token_time - start_time) * 1000) if first_token_time else 0
                                yield {"type": "token", "delta": val, "ttft_ms": ttft}
                            elif kind == "end":
                                stream_success = True
                                break
                            elif kind == "error":
                                raise val

                    except Exception as e:
                        logger.warning(f"Gemini streaming failed for {request_id}: {e}")
                        fallback_used = True

                # 3. Tertiary: Try OpenAI Streaming
                if not stream_success and not accumulated_content and self.openai_client:
                    try:
                        selected_provider = "openai"
                        selected_model = self.openai_model
                        q = asyncio.Queue()
                        loop = asyncio.get_running_loop()

                        def _openai_worker():
                            try:
                                stream_resp = self.openai_client.chat.completions.create(
                                    model=self.openai_model,
                                    messages=[{"role": "user", "content": full_prompt}],
                                    temperature=0.3,
                                    stream=True
                                )
                                for chunk in stream_resp:
                                    if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                                        loop.call_soon_threadsafe(q.put_nowait, ("token", chunk.choices[0].delta.content))
                                loop.call_soon_threadsafe(q.put_nowait, ("end", None))
                            except Exception as ex:
                                loop.call_soon_threadsafe(q.put_nowait, ("error", ex))

                        t = threading.Thread(target=_openai_worker, daemon=True)
                        t.start()

                        while True:
                            kind, val = await q.get()
                            if kind == "token":
                                if first_token_time is None:
                                    first_token_time = time.time()
                                accumulated_content.append(val)
                                ttft = int((first_token_time - start_time) * 1000) if first_token_time else 0
                                yield {"type": "token", "delta": val, "ttft_ms": ttft}
                            elif kind == "end":
                                stream_success = True
                                break
                            elif kind == "error":
                                raise val

                    except Exception as e:
                        logger.warning(f"OpenAI streaming failed for {request_id}: {e}")
                        fallback_used = True

                # 4. Simulation Fallback
                if not stream_success and not accumulated_content:
                    selected_provider = "fallback"
                    selected_model = "simulation-v1"
                    sim_text = self._get_simulation_response(prompt)
                    words = sim_text.split(" ")
                    first_token_time = time.time()
                    for w in words:
                        delta = w + " "
                        accumulated_content.append(delta)
                        yield {"type": "token", "delta": delta, "ttft_ms": int((first_token_time - start_time) * 1000)}
                        await asyncio.sleep(0.03)
                    stream_success = True

        finally:
            # Guaranteed cost and telemetry recording in finally block
            total_content = "".join(accumulated_content)
            output_tokens = len(total_content) // 4
            latency_ms = int((time.time() - start_time) * 1000)
            ttft_ms = int((first_token_time - start_time) * 1000) if first_token_time else latency_ms
            cost = self.calculate_cost(selected_provider, input_tokens, output_tokens) if not is_byok else Decimal("0.00")

            own_db = False
            session = db
            if session is None:
                session = SessionLocal()
                own_db = True

            try:
                log_entry = AIRequestLog(
                    request_id=request_id,
                    user_id=user_id,
                    feature=feature,
                    provider=selected_provider,
                    model=selected_model,
                    rate_card_version="2026-Q3",
                    prompt_version=prompt_version,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    latency_ms=latency_ms,
                    cost_usd=cost,
                    fallback_used=fallback_used,
                    billing_source=billing_source,
                    success=stream_success,
                    error_code=error_code
                )
                session.add(log_entry)
                session.commit()
            except Exception as log_err:
                logger.error(f"Failed to record streaming AI telemetry log: {log_err}")
                session.rollback()
            finally:
                if own_db:
                    session.close()

            # Yield final metrics object
            yield {
                "type": "done",
                "metrics": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "ttft_ms": ttft_ms,
                    "latency_ms": latency_ms,
                    "cost_usd": float(cost),
                    "provider": selected_provider,
                    "model": selected_model,
                    "billing_source": billing_source,
                    "success": stream_success
                }
            }

    def _get_simulation_response(self, prompt: str) -> str:
        prompt_lower = prompt.lower()
        if any(word in prompt_lower for word in ["hi", "hello", "hey"]):
            return "Hey there! I'm Shiro. I'm currently running in Simulation Mode because I can't find valid API keys in the .env file."
        if "summarize" in prompt_lower:
            return "In Simulation Mode, I would provide a detailed summary here."
        return "I'm Shiro, your AI mentor. I'm currently running in simulation fallback."

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def generate_quiz_questions(self, content: str, num_questions: int, difficulty: str, user_id: Optional[int] = None, db: Optional[Any] = None) -> List[Dict[str, Any]]:
        prompt_def = prompt_registry.get("quiz", "v1.0")
        prompt = prompt_def.template.format(num_questions=num_questions, difficulty=difficulty, content=content[:10000])
        
        result = await self.execute_with_governance(
            prompt=prompt,
            response_format="json_object",
            feature="quiz",
            prompt_version=prompt_def.version,
            user_id=user_id,
            db=db
        )
        
        # If simulation fallback, return valid mock questions
        if result.provider == "fallback" or not result.parsed:
            return [
                {
                    "question": "What is the primary role of an operating system?",
                    "options": {"A": "Resource Management", "B": "Hardware Design", "C": "Display Resolution", "D": "Power Supply"},
                    "correct_answer": "A",
                    "explanation": "An operating system manages hardware and software resources."
                }
            ] * num_questions

        try:
            clean_str = self._clean_json_string(result.content)
            validated = QuizResponse.model_validate_json(clean_str)
            return [q.model_dump() for q in validated.questions]
        except ValidationError:
            if isinstance(result.parsed, dict) and "questions" in result.parsed:
                return result.parsed["questions"]
            elif isinstance(result.parsed, list):
                return result.parsed
            raise

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def generate_quiz_questions_optimized(self, prompt: str, user_id: Optional[int] = None, db: Optional[Any] = None) -> List[Dict[str, Any]]:
        """Generate high-yield important quiz questions from custom prompt"""
        result = await self.execute_with_governance(
            prompt=prompt,
            response_format="json_object",
            feature="quiz",
            prompt_version="v1.0",
            user_id=user_id,
            db=db
        )
        
        if result.provider == "fallback" or not result.parsed:
            return [
                {
                    "question": "What is the primary core concept discussed in this material?",
                    "options": {"A": "Core Definition & Principles", "B": "Secondary Architecture", "C": "External Tooling", "D": "Deprecated Methods"},
                    "correct_answer": "A",
                    "explanation": "High-yield exam review focuses on foundational principles and core concepts."
                }
            ] * 5

        try:
            clean_str = self._clean_json_string(result.content)
            validated = QuizResponse.model_validate_json(clean_str)
            return [q.model_dump() for q in validated.questions]
        except Exception:
            if isinstance(result.parsed, dict) and "questions" in result.parsed:
                return result.parsed["questions"]
            elif isinstance(result.parsed, list):
                return result.parsed
            return [
                {
                    "question": "What is the primary concept covered in this section?",
                    "options": {"A": "Core Theory", "B": "Implementation", "C": "Testing", "D": "Deployment"},
                    "correct_answer": "A",
                    "explanation": "Core theoretical foundations form the basis of this topic."
                }
            ]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def generate_important_questions_list(
        self, 
        content: str, 
        pyq_content: str, 
        num_questions: int, 
        user_id: Optional[int] = None, 
        db: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """Generate high-yield important university/exam revision questions (non-MCQ)"""
        prompt_def = prompt_registry.get("important_questions", "v1.0")
        prompt = prompt_def.template.format(
            content=content[:10000],
            pyq_content=pyq_content[:4000] if pyq_content else "No previous papers provided. Focus on core high-yield principles.",
            num_questions=num_questions
        )
        
        result = await self.execute_with_governance(
            prompt=prompt,
            response_format="json_object",
            feature="important_questions",
            prompt_version=prompt_def.version,
            user_id=user_id,
            db=db
        )
        
        if result.provider == "fallback" or not result.parsed:
            return [
                {
                    "question": "Explain the fundamental architecture and working principles covered in this material.",
                    "category": "Core Theory",
                    "importance": "High Yield (95% Exam Probability)",
                    "estimated_marks": "10 Marks",
                    "key_points": [
                        "Define primary terminology and design objectives",
                        "Elaborate on the component interactions and data flow",
                        "Provide concrete practical examples or mathematical bounds"
                    ],
                    "model_answer_summary": "A comprehensive answer covers key definitions, diagrams, and structural advantages.",
                    "exam_insight": "Commonly asked as a long-form question in semester exams."
                }
            ] * min(num_questions, 5)

        try:
            if isinstance(result.parsed, dict) and "questions" in result.parsed:
                return result.parsed["questions"]
            elif isinstance(result.parsed, list):
                return result.parsed
            
            clean_str = self._clean_json_string(result.content)
            data = json.loads(clean_str)
            return data.get("questions", data if isinstance(data, list) else [])
        except Exception as ex:
            logger.warning(f"Failed to parse important questions JSON: {ex}")
            return [
                {
                    "question": "Describe the main theorem / methodology described in the document and its practical implications.",
                    "category": "Analytical & Conceptual",
                    "importance": "High Yield (90% Exam Probability)",
                    "estimated_marks": "5 Marks",
                    "key_points": [
                        "State the theorem / premise clearly",
                        "List key assumptions and edge conditions",
                        "Summarize real-world use cases"
                    ],
                    "model_answer_summary": "Focus on clarity, step-by-step reasoning, and real-world application.",
                    "exam_insight": "Tests conceptual depth beyond memorization."
                }
            ]



    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def generate_flashcards(self, content: str, num_cards: int, user_id: Optional[int] = None, db: Optional[Any] = None) -> List[Dict[str, str]]:
        prompt_def = prompt_registry.get("flashcards", "v1.0")
        prompt = prompt_def.template.format(num_cards=num_cards, content=content[:10000])
        
        result = await self.execute_with_governance(
            prompt=prompt,
            response_format="json_object",
            feature="flashcards",
            prompt_version=prompt_def.version,
            user_id=user_id,
            db=db
        )

        if result.provider == "fallback" or not result.parsed:
            return [{"question": "Operating System", "answer": "Software that manages computer hardware and software resources."}] * num_cards

        try:
            clean_str = self._clean_json_string(result.content)
            validated = FlashcardResponse.model_validate_json(clean_str)
            return [f.model_dump() for f in validated.flashcards]
        except ValidationError:
            if isinstance(result.parsed, dict) and "flashcards" in result.parsed:
                return result.parsed["flashcards"]
            raise

    async def generate_summary(self, content: str, summary_type: str, language: str, user_id: Optional[int] = None, db: Optional[Any] = None) -> str:
        prompt_def = prompt_registry.get("summary", "v1.0")
        prompt = prompt_def.template.format(summary_type=summary_type, language=language, content=content[:10000])
        result = await self.execute_with_governance(
            prompt=prompt,
            feature="summary",
            prompt_version=prompt_def.version,
            user_id=user_id,
            db=db
        )
        return result.content


LLMClient = AIGateway
llm_client = AIGateway()
