from .prompt_registry import PromptDefinition, prompt_registry

QUIZ_TEMPLATE_V1 = """Generate {num_questions} Multiple Choice Questions (MCQs) strictly grounded in the provided context.
Difficulty: {difficulty}

CONTEXT:
{content}

RULES:
1. Every question must be directly supported by the context above.
2. Provide exactly 4 options: A, B, C, D.
3. Mark the exact correct option key ('A', 'B', 'C', or 'D').
4. Provide a clear explanation citing the concept from the context.

Respond STRICTLY with a JSON object:
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

QUIZ_PROMPT_V1 = PromptDefinition(
    name="quiz_generator",
    version="v1.0",
    feature="quiz",
    template=QUIZ_TEMPLATE_V1,
    temperature=0.3,
    max_output_tokens=3000,
    model_policy="structured_json"
)

prompt_registry.register(QUIZ_PROMPT_V1)
