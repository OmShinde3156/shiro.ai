import os
import re
import asyncio
import logging
import concurrent.futures
from typing import Optional, List, Tuple, Union, Dict
from gtts import gTTS

logger = logging.getLogger(__name__)

# Default Voice Profiles for Shiro.ai (Andrew & Ava chosen for natural flow & professorial warmth)
DEFAULT_PRIMARY_VOICE = os.getenv("SHIRO_PRIMARY_VOICE", "en-US-AndrewNeural")
DEFAULT_PODCAST_HOST = os.getenv("SHIRO_PODCAST_HOST", "en-US-AndrewNeural")
DEFAULT_PODCAST_COHOST = os.getenv("SHIRO_PODCAST_COHOST", "en-US-AvaNeural")
DEFAULT_FEYNMAN_VOICE = os.getenv("SHIRO_FEYNMAN_VOICE", "en-US-AndrewNeural")

DEFAULT_RATE = os.getenv("SHIRO_TTS_RATE", "-2%")    # ~0.98x calm, deliberate academic cadence
DEFAULT_PITCH = os.getenv("SHIRO_TTS_PITCH", "-1Hz")  # slightly warm, grounded university mentor timbre

VOICE_PROFILES = {
    "en": {
        "host": DEFAULT_PODCAST_HOST,
        "cohost": DEFAULT_PODCAST_COHOST,
        "feynman": DEFAULT_FEYNMAN_VOICE,
        "default": DEFAULT_PRIMARY_VOICE,
    },
    "en-in": {
        "host": "en-IN-PrabhatNeural",
        "cohost": "en-IN-NeerjaNeural",
        "feynman": "en-IN-PrabhatNeural",
        "default": "en-IN-PrabhatNeural",
    },
    "hi": {
        "host": "hi-IN-MadhurNeural",
        "cohost": "hi-IN-SwaraNeural",
        "feynman": "hi-IN-MadhurNeural",
        "default": "hi-IN-SwaraNeural",
    },
    "en-gb": {
        "host": "en-GB-RyanNeural",
        "cohost": "en-GB-SoniaNeural",
        "feynman": "en-GB-RyanNeural",
        "default": "en-GB-RyanNeural",
    }
}


class TextToSpeechPreprocessor:
    """
    Normalizes educational and pedagogical text for natural neural speech synthesis.
    Eliminates robotic artifacts, handles formulas/equations, and injects human prosody.
    """

    @staticmethod
    def clean_text_for_speech(text: str) -> str:
        if not text:
            return ""

        # 1. Remove citations like [CIT-1], [1], [ref], etc.
        text = re.sub(r'\[CIT-\d+\]', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\[\d+\]', '', text)

        # 2. Clean markdown headers and bullet points
        text = re.sub(r'^#+\s*', '', text, flags=re.MULTILINE)
        text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)

        # 3. Clean bold and italic markdown markers but preserve words
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)
        text = re.sub(r'_(.*?)_', r'\1', text)

        # 4. Normalize common mathematical and scientific expressions
        text = re.sub(r'\$E\s*=\s*mc\^?2\$|E\s*=\s*mc\^?2', 'E equals m c squared', text)
        text = re.sub(r'\$(\w+)\^2\$|(\w+)\^2', r'\1 squared', text)
        text = re.sub(r'\$(\w+)\^3\$|(\w+)\^3', r'\1 cubed', text)
        text = re.sub(r'\\frac\{([^}]+)\}\{([^}]+)\}', r'\1 over \2', text)
        text = re.sub(r'\\approx', 'approximately', text)
        text = re.sub(r'\\neq', 'is not equal to', text)
        text = re.sub(r'\\leq', 'less than or equal to', text)
        text = re.sub(r'\\geq', 'greater than or equal to', text)
        text = re.sub(r'\\Delta', 'Delta', text)
        text = re.sub(r'\\theta', 'theta', text)
        text = re.sub(r'\\alpha', 'alpha', text)
        text = re.sub(r'\\beta', 'beta', text)
        # Strip remaining LaTeX delimiters
        text = re.sub(r'\$([^$]+)\$', r'\1', text)

        # 5. Natural punctuation and cadence:
        # Replace colons after introductory clauses with gentle commas for natural pause
        text = re.sub(r':(?=\s+[A-Z0-9a-z])', ', ', text)
        # Replace em-dashes with comma pauses
        text = re.sub(r'\s*—\s*', ', ', text)
        # Ensure transition phrases have breathing room
        text = re.sub(r'\b(In other words|Notice that|Crucially|For example|Specifically|Therefore|In summary)\b(?!,)', r'\1,', text)

        # 6. Normalize whitespace
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()


def _run_coroutine_sync(coro):
    """Safely runs an async coroutine synchronously, even inside an existing event loop."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(lambda: asyncio.run(coro)).result()
    else:
        return asyncio.run(coro)


class TTSClient:
    """
    Studio-Grade Text-to-Speech Engine for Shiro.ai.
    Target Persona: "A friendly university professor who explains clearly and patiently."
    
    Features:
    - Calm, warm, intelligent professorial pacing (0.98x - 1.0x rate, grounded pitch)
    - Structured & multi-speaker dialogue parsing (Host vs Co-Host) with natural conversational pacing
    - Pedagogical text normalization (LaTeX math, markdown cleaning, pause injection)
    - Resilient per-segment retries with automatic gTTS fallback for 100% reliability
    """

    def _get_voice_for_speaker(
        self, 
        speaker: str, 
        lang: str, 
        explicit_voice: Optional[str] = None
    ) -> str:
        if explicit_voice:
            return explicit_voice

        normalized_lang = (lang or "en").lower().replace("_", "-")
        profile = (
            VOICE_PROFILES.get(normalized_lang) 
            or VOICE_PROFILES.get(normalized_lang.split("-")[0]) 
            or VOICE_PROFILES["en"]
        )

        speaker_lower = str(speaker).lower().replace("-", "").replace(" ", "")
        if "host" in speaker_lower and "co" not in speaker_lower:
            return profile["host"]
        elif "cohost" in speaker_lower or "speaker2" in speaker_lower or "student" in speaker_lower or "guest" in speaker_lower:
            return profile["cohost"]
        elif "feynman" in speaker_lower:
            return profile["feynman"]
        else:
            return profile["default"]

    def _parse_conversational_segments(self, text: str) -> List[Tuple[str, str]]:
        """
        Parses multi-speaker dialogue text into structured (speaker, content) pairs.
        Robustly matches Host / Co-Host across any markdown formatting (e.g. **Host:**, 
        Host (warm):, [Co-Host]:, etc.) and guarantees speaker labels are completely
        stripped so the TTS engine NEVER speaks aloud "Host colon" or "Co-Host colon".
        """
        pattern = re.compile(
            r'^(?:[*\s_#\[]*)(Host|Co-Host|Speaker\s*1|Speaker\s*2|Narrator|Tutor|Student)[^:\n]*:\s*(.*)$',
            re.MULTILINE | re.IGNORECASE
        )
        matches = list(pattern.finditer(text))
        if not matches:
            return [("default", text.strip())]

        segments = []
        # Check if preamble exists before the first speaker
        preamble = text[:matches[0].start()].strip()
        if preamble and not any(kw in preamble.lower() for kw in ["podcast script", "here is", "episode", "transcript"]):
            segments.append(("default", preamble))

        for i, match in enumerate(matches):
            speaker = match.group(1).strip()
            start = match.start(2)
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            content = text[start:end].strip()
            if content:
                segments.append((speaker, content))

        return segments if segments else [("default", text.strip())]

    async def _synthesize_single_segment_with_retry(
        self,
        text: str,
        voice: str,
        rate: str,
        pitch: str,
        max_retries: int = 3
    ) -> bytes:
        """Synthesizes a single speech segment with exponential backoff on transient connection drops."""
        import edge_tts

        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                comm = edge_tts.Communicate(
                    text=text,
                    voice=voice,
                    rate=rate,
                    pitch=pitch
                )
                chunks = []
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        chunks.append(chunk["data"])
                if chunks:
                    return b"".join(chunks)
            except Exception as e:
                last_error = e
                logger.warning(f"Edge TTS segment synthesis attempt {attempt} failed: {e}. Retrying...")
                await asyncio.sleep(0.4 * attempt)

        raise RuntimeError(f"Edge TTS failed after {max_retries} attempts: {last_error}")

    async def text_to_speech_segments_async(
        self,
        segments: List[Union[Tuple[str, str], Dict[str, str]]],
        output_path: str,
        lang: str = "en",
        rate: Optional[str] = None,
        pitch: Optional[str] = None
    ):
        """
        Synthesizes structured multi-speaker segments (Host & Co-Host) directly.
        Zero regex ambiguity. Ensures seamless multi-speaker audio concatenation.
        """
        try:
            speech_rate = rate or DEFAULT_RATE
            speech_pitch = pitch or DEFAULT_PITCH
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

            with open(output_path, "wb") as outfile:
                for seg in segments:
                    if isinstance(seg, dict):
                        speaker = seg.get("speaker", "default")
                        raw_text = seg.get("text", "")
                    else:
                        speaker, raw_text = seg

                    clean_text = TextToSpeechPreprocessor.clean_text_for_speech(raw_text)
                    if not clean_text:
                        continue

                    speaker_voice = self._get_voice_for_speaker(speaker, lang)
                    audio_bytes = await self._synthesize_single_segment_with_retry(
                        text=clean_text,
                        voice=speaker_voice,
                        rate=speech_rate,
                        pitch=speech_pitch
                    )
                    outfile.write(audio_bytes)

            logger.info(f"Successfully generated structured multi-speaker audio at {output_path}")

        except Exception as e:
            logger.error(f"Multi-speaker dual-host synthesis failed: {e}")
            raise RuntimeError(f"Dual-host neural podcast synthesis failed: {e}")

    async def text_to_speech_async(
        self, 
        text: str, 
        output_path: str, 
        lang: str = "en", 
        voice: Optional[str] = None,
        rate: Optional[str] = None,
        pitch: Optional[str] = None
    ):
        """Asynchronous high-definition speech synthesis with multi-speaker support."""
        try:
            speech_rate = rate or DEFAULT_RATE
            speech_pitch = pitch or DEFAULT_PITCH

            segments = self._parse_conversational_segments(text)
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

            with open(output_path, "wb") as outfile:
                for speaker, raw_content in segments:
                    clean_content = TextToSpeechPreprocessor.clean_text_for_speech(raw_content)
                    if not clean_content:
                        continue

                    speaker_voice = self._get_voice_for_speaker(speaker, lang, voice)
                    audio_bytes = await self._synthesize_single_segment_with_retry(
                        text=clean_content,
                        voice=speaker_voice,
                        rate=speech_rate,
                        pitch=speech_pitch
                    )
                    outfile.write(audio_bytes)

            logger.info(f"Successfully generated neural professorial TTS audio at {output_path}")

        except Exception as e:
            logger.warning(f"Edge TTS synthesis failed ({e}), falling back to standard engine.")
            self._gtts_fallback(text, output_path, lang)

    def _gtts_fallback(self, text: str, output_path: str, lang: str = "en"):
        """Reliable fallback to gTTS when neural service is unreachable."""
        try:
            clean_lang = lang.split("-")[0] if "-" in lang else lang
            clean_text = TextToSpeechPreprocessor.clean_text_for_speech(text)[:4000]
            tts = gTTS(text=clean_text, lang=clean_lang if clean_lang in ["en", "hi", "es", "fr", "de"] else "en")
            tts.save(output_path)
            logger.info(f"Fallback gTTS successfully saved to {output_path}")
        except Exception as err:
            logger.error(f"Both primary and fallback TTS engines failed: {err}")
            raise RuntimeError(f"TTS synthesis completely failed: {err}")

    def text_to_speech(
        self, 
        text: str, 
        output_path: str, 
        lang: str = "en", 
        voice: Optional[str] = None,
        rate: Optional[str] = None,
        pitch: Optional[str] = None
    ):
        """Synchronous wrapper for text_to_speech_async for Celery tasks and synchronous callers."""
        _run_coroutine_sync(self.text_to_speech_async(text, output_path, lang, voice, rate, pitch))

    def text_to_speech_segments(
        self,
        segments: List[Union[Tuple[str, str], Dict[str, str]]],
        output_path: str,
        lang: str = "en",
        rate: Optional[str] = None,
        pitch: Optional[str] = None
    ):
        """Synchronous wrapper for text_to_speech_segments_async."""
        _run_coroutine_sync(self.text_to_speech_segments_async(segments, output_path, lang, rate, pitch))


tts_client = TTSClient()
