from gtts import gTTS
import os
import re

class TTSClient:
    def text_to_speech(self, text: str, output_path: str, lang: str = "en"):
        """
        Convert text to real speech and save as MP3.
        Supports multi-speaker formatting: "Host: hello\\nCo-Host: hi"
        """
        try:
            # Check if text is conversational
            if "Host:" in text and "Co-Host:" in text:
                segments = re.split(r'(Host:|Co-Host:)', text)
                
                audio_files = []
                for i in range(1, len(segments), 2):
                    speaker = segments[i].strip(':')
                    content = segments[i+1].strip()
                    
                    if not content:
                        continue
                        
                    # Use different accents to simulate different speakers
                    tld = 'co.uk' if speaker == "Host" else 'com'
                    
                    segment_path = output_path.replace('.mp3', f'_{i}.mp3')
                    tts = gTTS(text=content[:5000], lang=lang, tld=tld)
                    tts.save(segment_path)
                    audio_files.append(segment_path)
                
                # Combine audio files (binary concatenation for MP3)
                with open(output_path, 'wb') as outfile:
                    for f in audio_files:
                        with open(f, 'rb') as infile:
                            outfile.write(infile.read())
                        os.remove(f)
            else:
                truncated_text = text[:5000]
                tts = gTTS(text=truncated_text, lang=lang)
                tts.save(output_path)

        except Exception as e:
            raise Exception(f"TTS generation failed: {str(e)}")

tts_client = TTSClient()

