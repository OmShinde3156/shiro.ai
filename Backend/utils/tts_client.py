from gtts import gTTS
import os
import textwrap

class TTSClient:
    def text_to_speech(self, text: str, output_path: str, lang: str = "en"):
        """
        Convert text to real speech and save as MP3.
        Simplified to use gTTS directly to avoid pydub/audioop issues in Python 3.13.
        """
        try:
            safe_text = (text or "").strip()
            if not safe_text:
                safe_text = "This is a placeholder audio. The text content was empty."

            # Ensure output directory exists
            out_dir = os.path.dirname(output_path)
            if out_dir:
                os.makedirs(out_dir, exist_ok=True)

            print(f"--- TTS Call ---")
            print(f"Generating audio for: '{safe_text[:60]}...'")
            print(f"Saving to: {output_path}")

            # gTTS can handle relatively long text, but we'll limit it slightly for safety
            # If text is extremely long, gTTS might still work but we take the first 5000 chars
            truncated_text = safe_text[:5000]
            
            tts = gTTS(text=truncated_text, lang=lang)
            tts.save(output_path)

        except Exception as e:
            raise Exception(f"TTS generation failed: {str(e)}")

tts_client = TTSClient()
