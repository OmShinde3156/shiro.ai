from gtts import gTTS
import os

class TTSClient:
    def text_to_speech(self, text: str, output_path: str, lang: str = "en"):
        """
        Convert text to real speech and save as MP3.
        Used primarily for Podcast generation.
        """
        try:
            # Ensure text isn't too long for gTTS single request
            truncated_text = text[:5000]
            
            tts = gTTS(text=truncated_text, lang=lang)
            tts.save(output_path)

        except Exception as e:
            raise Exception(f"TTS generation failed: {str(e)}")

tts_client = TTSClient()
