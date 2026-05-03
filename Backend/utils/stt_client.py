import os
from openai import OpenAI
from pathlib import Path
from dotenv import load_dotenv

class STTClient:
    def __init__(self):
        # Load .env from Backend folder
        env_path = Path(__file__).parent.parent / ".env"
        load_dotenv(dotenv_path=env_path)
        
        self.api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.client = None
        if self.api_key and self.api_key != "sk-dummy-key-replace-me":
            try:
                self.client = OpenAI(api_key=self.api_key)
            except Exception as e:
                print(f"Error initializing OpenAI client for STT: {e}")

    def speech_to_text(self, audio_path: str, language: str = None, task: str = "transcribe", prompt: str = None) -> str:
        """
        Convert speech to text using OpenAI Whisper.
        """
        if not self.client:
            return "Speech-to-Text is in Simulation Mode. Please add a valid OpenAI API key."

        try:
            with open(audio_path, "rb") as audio_file:
                params = {
                    "model": "whisper-1",
                    "file": audio_file,
                }
                if language:
                    params["language"] = language
                if prompt:
                    params["prompt"] = prompt
                
                if task == "translate":
                    response = self.client.audio.translations.create(**params)
                else:
                    response = self.client.audio.transcriptions.create(**params)
                
                return response.text
        except Exception as e:
            print(f"STT Error: {e}")
            return f"Error during transcription: {str(e)}"

stt_client = STTClient()
