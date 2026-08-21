import re
import requests
import trafilatura
from youtube_transcript_api import YouTubeTranscriptApi
from typing import Tuple, Optional
import yt_dlp

class ResearchService:
    def __init__(self):
        pass

    def extract_youtube_id(self, url: str) -> Optional[str]:
        """Extract YouTube ID from various URL formats"""
        patterns = [
            r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
            r'youtu\.be\/([0-9A-Za-z_-]{11})',
            r'embed\/([0-9A-Za-z_-]{11})',
            r'shorts\/([0-9A-Za-z_-]{11})'
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    async def get_youtube_content(self, url: str) -> Tuple[str, str]:
        """Fetch title and transcript from YouTube"""
        video_id = self.extract_youtube_id(url)
        if not video_id:
            raise Exception("Invalid YouTube URL")

        # Get Title using yt-dlp (lightweight)
        title = "YouTube Video"
        try:
            with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                info = ydl.extract_info(url, download=False)
                title = info.get('title', 'YouTube Video')
        except Exception:
            pass

        # Get Transcript
        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            content = " ".join([t['text'] for t in transcript_list])
            return title, content
        except Exception as e:
            # Fallback 1: yt-dlp auto-subtitles extraction
            try:
                ydl_opts = {
                    'quiet': True,
                    'skip_download': True,
                    'writesubtitles': True,
                    'writeautomaticsub': True,
                    'subtitleslangs': ['en']
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    subs = info.get('requested_subtitles')
                    if subs and 'en' in subs:
                        sub_url = subs['en'].get('url')
                        if sub_url:
                            import requests
                            sub_res = requests.get(sub_url)
                            if sub_res.status_code == 200:
                                raw_vtt = sub_res.text
                                # Clean VTT tags and timestamps
                                import re
                                text = re.sub(r'<[^>]+>', '', raw_vtt)
                                text = re.sub(r'[\d:\.]+ --> [\d:\.]+', '', text)
                                text = re.sub(r'WEBVTT|Language: en|Kind: captions', '', text)
                                text = re.sub(r'Align:[^\n]+|Position:[^\n]+', '', text)
                                text = ' '.join(text.split())
                                if text.strip():
                                    return title, text.strip()
            except Exception:
                pass
            
            # Fallback 2: Description
            try:
                with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                    info = ydl.extract_info(url, download=False)
                    content = info.get('description', '')
                    if not content:
                        raise Exception("No transcript or description found")
                    return title, content
            except Exception:
                raise Exception(f"Failed to fetch YouTube content: {str(e)}")

    async def get_web_content(self, url: str) -> Tuple[str, str]:
        """Fetch and clean content from a website using trafilatura"""
        try:
            downloaded = trafilatura.fetch_url(url)
            if not downloaded:
                # Fallback to requests
                res = requests.get(url, timeout=10)
                downloaded = res.text
            
            content = trafilatura.extract(downloaded)
            title = trafilatura.extract_metadata(downloaded).title if downloaded else "Web Page"
            
            if not content:
                raise Exception("Could not extract content from the URL")
                
            return title or "Web Page", content
        except Exception as e:
            raise Exception(f"Failed to fetch web content: {str(e)}")

research_service = ResearchService()
