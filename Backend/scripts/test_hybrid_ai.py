import os
import sys
import asyncio
from dotenv import load_dotenv

# Ensure utf-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

load_dotenv('Backend/.env')
sys.path.insert(0, 'Backend')
from utils.llm_client import AIGateway

gateway = AIGateway()

async def run_tests():
    print("==================================================")
    print("SHIRO HYBRID AI GATEWAY: FULL MATRIX VERIFICATION")
    print("==================================================")

    # 1. Reasoning Task
    print("\n--- 1. Reasoning Feature (podcast_plan) ---")
    res1 = await gateway.execute_with_governance(
        prompt="Draft an episodic outline for Quantum Superposition. Output 2 bullet points.",
        feature="podcast_plan"
    )
    print(f"Provider : {res1.provider}")
    print(f"Model    : {res1.model}")
    print(f"Tokens   : {res1.input_tokens} in / {res1.output_tokens} out")
    print(f"Snippet  : {res1.content[:150].strip()}...")
    assert res1.provider == "groq"
    assert "gpt-oss-120b" in res1.model

    # 2. Fast Interactive Task
    print("\n--- 2. High-Speed Interactive Feature (chat) ---")
    res2 = await gateway.execute_with_governance(
        prompt="Explain inertia in one concise sentence.",
        feature="chat"
    )
    print(f"Provider : {res2.provider}")
    print(f"Model    : {res2.model}")
    print(f"Tokens   : {res2.input_tokens} in / {res2.output_tokens} out")
    print(f"Content  : {res2.content.strip()}")
    assert res2.provider == "groq"
    assert "qwen" in res2.model

    # 3. Feynman Technique Evaluation
    print("\n--- 3. Deep Feynman Critique (feynman) ---")
    res3 = await gateway.execute_with_governance(
        prompt="Critique this student explanation: 'Entropy means things get messier over time.'",
        feature="feynman"
    )
    print(f"Provider : {res3.provider}")
    print(f"Model    : {res3.model}")
    print(f"Tokens   : {res3.input_tokens} in / {res3.output_tokens} out")
    print(f"Snippet  : {res3.content[:150].strip()}...")
    assert res3.provider == "groq"
    assert "gpt-oss-120b" in res3.model

    # 4. Structured Output Task (flashcards / quiz)
    print("\n--- 4. Fast Structured JSON (flashcard) ---")
    res4 = await gateway.execute_with_governance(
        prompt='Return JSON: {"front": "What is ATP?", "back": "Adenosine Triphosphate, energy currency."}',
        feature="flashcard",
        response_format="json_object"
    )
    print(f"Provider : {res4.provider}")
    print(f"Model    : {res4.model}")
    print(f"Content  : {res4.content.strip()}")
    assert res4.provider == "groq"
    assert "qwen" in res4.model

    # 5. Intra-Groq Failover Simulation
    print("\n--- 5. Intra-Groq Failover Simulation ---")
    # Temporarily set reasoning model to non-existent to verify automatic failover to fast model
    orig_reasoning = gateway.groq_reasoning_model
    gateway.groq_reasoning_model = "non-existent-reasoning-model"
    res5 = await gateway.execute_with_governance(
        prompt="Calculate 15 * 12 and answer in 1 word.",
        feature="podcast_plan"
    )
    gateway.groq_reasoning_model = orig_reasoning
    print(f"Provider : {res5.provider}")
    print(f"Model    : {res5.model} (Failed over within Groq!)")
    print(f"Content  : {res5.content.strip()}")
    assert res5.provider == "groq"
    assert "qwen" in res5.model

    # 6. Full Groq Outage -> Gemini Cloud Failover
    print("\n--- 6. Complete Groq Outage -> Gemini Cloud Failover ---")
    orig_groq_client = gateway.groq_client
    gateway.groq_client = None  # Simulate Groq outage
    res6 = await gateway.execute_with_governance(
        prompt="Name the capital of France in one word.",
        feature="chat"
    )
    gateway.groq_client = orig_groq_client
    print(f"Provider : {res6.provider} (Successfully failed over to Google Cloud!)")
    print(f"Model    : {res6.model}")
    print(f"Content  : {res6.content.strip()}")
    assert res6.provider == "gemini"
    assert "gemini" in res6.model

    print("\n==================================================")
    print("ALL 6 MATRIX TESTS PASSED PERFECTLY!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
