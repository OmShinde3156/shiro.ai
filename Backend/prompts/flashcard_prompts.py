from .prompt_registry import PromptDefinition, prompt_registry

FLASHCARD_TEMPLATE_V1 = """Create {num_cards} flashcards strictly grounded in the provided context.

CONTEXT:
{content}

RULES:
1. Every flashcard must represent an essential concept, term, or relationship directly from the context.
2. Front must be a clear, unambiguous question or prompt.
3. Back must be a concise, authoritative answer.

Respond STRICTLY with a JSON object:
{{
  "flashcards": [
    {{
      "question": "string",
      "answer": "string"
    }}
  ]
}}
"""

FLASHCARD_PROMPT_V1 = PromptDefinition(
    name="flashcard_generator",
    version="v1.0",
    feature="flashcards",
    template=FLASHCARD_TEMPLATE_V1,
    temperature=0.3,
    max_output_tokens=2500,
    model_policy="structured_json"
)

prompt_registry.register(FLASHCARD_PROMPT_V1)
