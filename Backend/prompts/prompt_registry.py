from dataclasses import dataclass
from typing import Dict, Optional, Any

@dataclass
class PromptDefinition:
    name: str
    version: str
    feature: str # "quiz", "flashcard", "summary", "rag", "podcast"
    template: str
    temperature: float = 0.7
    max_output_tokens: int = 2048
    model_policy: str = "balanced" # "balanced", "structured_json", "high_grounding", "creative"
    response_schema: Optional[Dict[str, Any]] = None


class PromptRegistry:
    def __init__(self):
        self._prompts: Dict[str, PromptDefinition] = {}

    def register(self, prompt: PromptDefinition):
        key = f"{prompt.feature}:{prompt.version}"
        self._prompts[key] = prompt

    def get(self, feature: str, version: str = "v1.0") -> PromptDefinition:
        key = f"{feature}:{version}"
        if key in self._prompts:
            return self._prompts[key]
        # Fallback to any matching feature
        for k, v in self._prompts.items():
            if k.startswith(f"{feature}:"):
                return v
        raise KeyError(f"Prompt '{feature}' (version {version}) not found in registry.")

prompt_registry = PromptRegistry()
