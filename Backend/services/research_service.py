import os
import re
from typing import Tuple, Optional
from youtube_transcript_api import YouTubeTranscriptApi, YouTubeVideoIdExtractor
import trafilatura
import yt_dlp
import logging

logger = logging.getLogger(__name__)

class ResearchService:
    def extract_youtube_id(self, url: str) -> Optional[str]:
        """Extract video ID using the centralized YouTubeVideoIdExtractor"""
        try:
            return YouTubeVideoIdExtractor.extract(url)
        except Exception:
            return None

    def _get_ytdl_opts(self, download=False, video_id=None) -> dict:
        """Production-grade yt-dlp configuration to bypass bot detection"""
        # Path to cookies file - check both project root and Backend folder
        cookies_path = os.path.join(os.getcwd(), "Backend", "cookies", "youtube_cookies.txt")
        if not os.path.exists(cookies_path):
            cookies_path = os.path.join(os.getcwd(), "cookies", "youtube_cookies.txt")
        
        opts = {
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'ignoreerrors': False,
            'logtostderr': False,
            'no_color': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://www.google.com/',
        }

        if os.path.exists(cookies_path):
            opts['cookiefile'] = cookies_path
            logger.info(f"Using cookies from {cookies_path}")
        else:
            logger.warning(f"No YouTube cookies found at {cookies_path}. Bot detection might block requests.")
        
        if download and video_id:
            temp_audio = f"static/temp_yt_{video_id}"
            opts.update({
                'format': 'bestaudio/best',
                'outtmpl': temp_audio,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
        else:
            opts.update({'skip_download': True})
            
        return opts

    async def get_youtube_content(self, url: str) -> Tuple[str, str]:
        """Fetch transcript and metadata for a YouTube video with multi-layer fallback"""
        video_id = self.extract_youtube_id(url)
        if not video_id:
            raise Exception("Invalid YouTube URL. Please provide a standard, shorts, or mobile link.")

        # 1. Fetch Metadata (Title & Description)
        title = f"YouTube Video ({video_id})"
        description = ""
        last_error = ""
        try:
            ydl_opts = self._get_ytdl_opts()
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                title = info.get('title', title)
                description = info.get('description', "")
        except Exception as e:
            last_error = str(e)
            if "Sign in to confirm you’re not a bot" in last_error:
                logger.error("YouTube blocked the request (Bot Detection). Cookies required.")
                title = f"Protected Video ({video_id})"
            else:
                logger.warning(f"Failed to fetch YT metadata: {e}")

        # 2. Layer 1: Fetch Existing Transcripts
        try:
            try:
                # Try common languages
                transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['en', 'hi', 'es', 'fr', 'de'])
            except:
                # Fallback: list all available and pick the first one
                transcript_metadata = YouTubeTranscriptApi().list(video_id)
                transcript = next(iter(transcript_metadata))
                transcript_list = transcript.fetch()
                
            full_text = " ".join([t['text'] for t in transcript_list])
            return title, full_text
        except Exception as e:
            logger.info(f"Transcript API failed for {video_id}: {e}")

        # 3. Layer 2: Audio Download & Whisper Transcription (The "Ultimate Fallback")
        temp_audio = f"static/temp_yt_{video_id}.mp3"
        try:
            from utils.stt_client import stt_client
            ydl_opts = self._get_ytdl_opts(download=True, video_id=video_id)
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            
            if os.path.exists(temp_audio):
                full_text = stt_client.speech_to_text(temp_audio)
                os.remove(temp_audio) # Cleanup
                
                if full_text and "Simulation Mode" not in full_text and "Error" not in full_text:
                    return title, f"AUDIO TRANSCRIBED VIA WHISPER:\n\n{full_text}"
            
        except Exception as audio_err:
            logger.error(f"Audio transcription fallback failed for {video_id}: {audio_err}")
            last_error = str(audio_err)
            if os.path.exists(temp_audio): os.remove(temp_audio)

        # 4. Layer 3: Gemini 2.0 Flash Extraction (The "Super Fallback")
        try:
            from utils.llm_client import llm_client
            gemini_content = await llm_client.get_youtube_transcript_gemini(url)
            if gemini_content and len(gemini_content) > 100:
                return title, f"CONTENT EXTRACTED VIA GEMINI AI:\n\n{gemini_content}"
        except Exception as gemini_err:
            logger.error(f"Gemini extraction failed for {video_id}: {gemini_err}")

        # 5. Layer 4: Final Fallback to Description (Internal Scraper if ytdl fails)
        if not description or len(description) < 50:
             try:
                import requests
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
                response = requests.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    # Look for description in the page source
                    meta_desc = re.search(r'"shortDescription":"(.*?)"', response.text)
                    if meta_desc:
                        description = meta_desc.group(1).replace("\\n", "\n").replace("\\u0026", "&")
                    else:
                        meta_tag = re.search(r'<meta name="description" content="(.*?)">', response.text)
                        if meta_tag:
                            description = meta_tag.group(1)
             except Exception as scraper_err:
                 logger.warning(f"Internal scraper fallback failed: {scraper_err}")

        if description and len(description) > 50:
            return title, f"TRANSCRIPT & AUDIO FAILED (Bot Detection).\n\nContent from Video Description:\n{description}"
        
        # Explicit error message for the UI
        fail_reason = "Bot detection blocked audio extraction." if "bot" in last_error.lower() else "No transcript available."
        raise Exception(f"Ingestion failed: {fail_reason} Please ensure the video has captions or upload a cookies.txt.")

    async def get_web_content(self, url: str) -> Tuple[str, str]:
        """Scrape and clean content from a website with fallback"""
        try:
            downloaded = trafilatura.fetch_url(url)
            if not downloaded:
                # Fallback: Simple requests fetch
                import requests
                resp = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
                downloaded = resp.text
            
            # Extract main text
            result = trafilatura.extract(
                downloaded, 
                include_comments=False, 
                include_tables=True,
                output_format='markdown'
            )
            
            if not result or len(result) < 50:
                # Fallback: extract more aggressively
                result = trafilatura.extract(downloaded, no_fallback=False)
            
            if not result:
                raise Exception("Could not extract meaningful content from this website.")

            # Get Metadata
            metadata = trafilatura.extract_metadata(downloaded)
            title = metadata.title if metadata and metadata.title else url
            
            return title, result
        except Exception as e:
            raise Exception(f"Web ingestion failed: {str(e)}")

research_service = ResearchService()
