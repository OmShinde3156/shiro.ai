from .prompt_registry import PromptDefinition, prompt_registry

SUMMARY_TEMPLATE_V1 = """Summarize the following document content accurately in {language} language.
Summary Type: {summary_type}

CONTENT:
{content}
"""

SUMMARY_PROMPT_V1 = PromptDefinition(
    name="document_summarizer",
    version="v1.0",
    feature="summary",
    template=SUMMARY_TEMPLATE_V1,
    temperature=0.4,
    max_output_tokens=2048,
    model_policy="balanced"
)

prompt_registry.register(SUMMARY_PROMPT_V1)
