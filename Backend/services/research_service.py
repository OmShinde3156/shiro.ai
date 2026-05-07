import os
import re
from typing import Tuple, Optional
from youtube_transcript_api import YouTubeTranscriptApi
import trafilatura
import yt_dlp
import logging

logger = logging.getLogger(__name__)

class ResearchService:
    def extract_youtube_id(self, url: str) -> Optional[str]:
        """Extract video ID from various YouTube URL formats (v4.8 updated)"""
        patterns = [
            r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
            r'(?:embed\/|v\/|shorts\/|watch\?v=|youtu\.be\/)([0-9A-Za-z_-]{11})',
            r'^([0-9A-Za-z_-]{11})$'
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    async def get_youtube_content(self, url: str) -> Tuple[str, str]:
        """Fetch transcript and metadata for a YouTube video with multi-layer fallback"""
        video_id = self.extract_youtube_id(url)
        if not video_id:
            raise Exception("Invalid YouTube URL. Please provide a standard, shorts, or mobile link.")

        # 1. Fetch Metadata (Title)
        title = f"YouTube Video ({video_id})"
        description = ""
        try:
            ydl_opts = {'quiet': True, 'skip_download': True, 'no_warnings': True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                title = info.get('title', title)
                description = info.get('description', "")
        except Exception as e:
            logger.warning(f"Failed to fetch YT metadata for {video_id}: {e}")

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
            logger.info(f"Transcript API failed for {video_id}, falling back to Audio Transcription: {e}")

        # 3. Layer 2: Audio Download & Whisper Transcription (The "Ultimate Fallback")
        # This mirrors the logic in alexfdom/youtube-ingest
        temp_audio = f"static/temp_yt_{video_id}.mp3"
        try:
            from utils.stt_client import stt_client
            
            # Download audio stream
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': temp_audio.replace('.mp3', ''), # yt-dlp adds extension
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'quiet': True,
                'no_warnings': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            
            # Transcription via Whisper API
            full_text = stt_client.speech_to_text(temp_audio)
            
            # Cleanup
            if os.path.exists(temp_audio): os.remove(temp_audio)
            
            if full_text and "Simulation Mode" not in full_text and "Error" not in full_text:
                return title, f"AUDIO TRANSCRIBED VIA WHISPER:\n\n{full_text}"
                
        except Exception as audio_err:
            logger.error(f"Ultimate Fallback failed for {video_id}: {audio_err}")
            if os.path.exists(temp_audio): os.remove(temp_audio)

        # 4. Layer 3: Final Fallback to Description
        if description and len(description) > 50:
            return title, f"TRANSCRIPT & AUDIO FAILED.\n\nSummary from Video Description:\n{description}"
        
        raise Exception(f"All ingestion layers failed for this video. Transcripts are disabled and audio processing failed.")

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
