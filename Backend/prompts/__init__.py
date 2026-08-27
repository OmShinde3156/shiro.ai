from .prompt_registry import prompt_registry, PromptDefinition
from .quiz_prompts import QUIZ_PROMPT_V1
from .flashcard_prompts import FLASHCARD_PROMPT_V1
from .summary_prompts import SUMMARY_PROMPT_V1
from .rag_prompts import RAG_ANSWER_PROMPT_V1

__all__ = [
    "prompt_registry",
    "PromptDefinition",
    "QUIZ_PROMPT_V1",
    "FLASHCARD_PROMPT_V1",
    "SUMMARY_PROMPT_V1",
    "RAG_ANSWER_PROMPT_V1"
]
