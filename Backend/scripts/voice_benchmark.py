import os
import sys
import asyncio
import edge_tts

# Target educational test cases representing Shiro.ai real usage:
TEST_CASES = {
    "technical_math": (
        "Let's look at Einstein's mass-energy equivalence. In the equation, E equals m c squared: "
        "E represents energy, m is the relativistic mass, and c is the speed of light—roughly three hundred thousand kilometers per second. "
        "Notice what this implies: even a tiny amount of mass contains an immense reservoir of latent energy."
    ),
    "indian_academic": (
        "Professor Ramanathan began the lecture at IIT Madras by discussing the foundations of machine learning. "
        "He asked Arjun to explain how gradient descent navigates the loss surface. "
        "Arjun explained that just like water naturally flows down a valley toward equilibrium, the algorithm steps in the direction of steepest descent."
    ),
    "feynman_tutor": (
        "You have a solid intuitive grasp here. You correctly noted that heat flows spontaneously from hotter objects to colder ones. "
        "However, you skipped one key link: why does entropy always increase in an isolated system? "
        "Think of a drop of ink in a glass of water—how would you explain why it disperses and never gathers back together?"
    ),
    "podcast_dialogue": (
        "Host: Welcome back to Shiro Audio Cast. Today we are tackling something students often find counterintuitive—quantum tunneling.\n"
        "Co-Host: That's right! When people first hear about particles passing through solid barriers, it sounds like science fiction.\n"
        "Host: Exactly. But once you understand wave-particle duality, it's not magic at all—it's probability."
    )
}

# Top Candidate Voices for "Friendly, warm, patient university professor":
CANDIDATE_PRIMARY_VOICES = [
    {"name": "en-US-BrianNeural", "gender": "Male", "tone": "Mature, calm, professorial, friendly academic mentor"},
    {"name": "en-US-AndrewNeural", "gender": "Male", "tone": "Warm, natural, approachable modern lecturer"},
    {"name": "en-US-EricNeural", "gender": "Male", "tone": "Thoughtful, patient, grounded educator"},
    {"name": "en-US-GuyNeural", "gender": "Male", "tone": "Conversational, calm, natural cadence"},
    {"name": "en-US-AvaNeural", "gender": "Female", "tone": "Warm, very smooth, patient, conversational educator"},
    {"name": "en-US-EmmaNeural", "gender": "Female", "tone": "Thoughtful, gentle, clear academic tutor"},
    {"name": "en-IN-PrabhatNeural", "gender": "Male", "tone": "Indian English, articulate, natural university instructor"},
    {"name": "en-IN-NeerjaNeural", "gender": "Female", "tone": "Indian English, gentle, reassuring, lucid educator"}
]

# Candidate Podcast Duos (Host + Co-Host):
PODCAST_DUOS = [
    {
        "duo_id": "duo_brian_jenny",
        "name": "Brian (Warm Professor) + Jenny (Curious Co-Host)",
        "host": "en-US-BrianNeural",
        "cohost": "en-US-JennyNeural"
    },
    {
        "duo_id": "duo_andrew_ava",
        "name": "Andrew (Approachable Host) + Ava (Insightful Co-Host)",
        "host": "en-US-AndrewNeural",
        "cohost": "en-US-AvaNeural"
    },
    {
        "duo_id": "duo_prabhat_neerja",
        "name": "Prabhat (Indian Academic Host) + Neerja (Bilingual Co-Host)",
        "host": "en-IN-PrabhatNeural",
        "cohost": "en-IN-NeerjaNeural"
    }
]

async def generate_benchmarks():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "voice_samples")
    os.makedirs(out_dir, exist_ok=True)
    print(f"Generating voice benchmark samples in: {out_dir}")

    # 1. Generate single-voice samples across the 3 primary test cases
    # Using academic pace: rate="-2%" (0.98x), pitch="-1Hz" (warm, grounded)
    for voice_info in CANDIDATE_PRIMARY_VOICES:
        v_name = voice_info["name"]
        print(f"\n--- Synthesizing Candidate: {v_name} ({voice_info['tone']}) ---")
        for test_key, text in TEST_CASES.items():
            if test_key == "podcast_dialogue":
                continue
            filename = f"{v_name}_{test_key}.mp3"
            filepath = os.path.join(out_dir, filename)
            
            comm = edge_tts.Communicate(
                text=text,
                voice=v_name,
                rate="-2%",    # ~0.98x relaxed professorial speed
                pitch="-1Hz"   # slightly warm, grounded
            )
            await comm.save(filepath)
            print(f"  [OK] Saved {filename}")

    # 2. Generate multi-speaker podcast duo samples
    print("\n--- Synthesizing Podcast Duos ---")
    podcast_text = TEST_CASES["podcast_dialogue"]
    for duo in PODCAST_DUOS:
        filename = f"{duo['duo_id']}.mp3"
        filepath = os.path.join(out_dir, filename)
        
        # Parse dialogue turns
        lines = podcast_text.strip().split("\n")
        with open(filepath, "wb") as outfile:
            for line in lines:
                if line.startswith("Host:"):
                    speaker_voice = duo["host"]
                    content = line.replace("Host:", "").strip()
                elif line.startswith("Co-Host:"):
                    speaker_voice = duo["cohost"]
                    content = line.replace("Co-Host:", "").strip()
                else:
                    speaker_voice = duo["host"]
                    content = line.strip()

                if not content:
                    continue

                comm = edge_tts.Communicate(
                    text=content,
                    voice=speaker_voice,
                    rate="-1%",
                    pitch="-1Hz"
                )
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        outfile.write(chunk["data"])

        print(f"  [OK] Saved Podcast Duo: {filename} ({duo['name']})")

    print("\n[SUCCESS] All voice benchmark samples generated successfully!")
    print(f"You can listen to any sample at http://localhost:8000/static/voice_samples/<filename>")

if __name__ == "__main__":
    asyncio.run(generate_benchmarks())
