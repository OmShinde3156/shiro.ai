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
        """Fetch and clean content from a website with SSRF validation"""
        from utils.network_security import validate_safe_url, safe_fetch_text
        
        # 1. Validate initial URL
        validate_safe_url(url)
        
        try:
            # 2. Fetch safely with redirect & payload protection
            final_url, html_content = safe_fetch_text(url)
            
            # 3. Extract text content
            content = trafilatura.extract(html_content)
            title = trafilatura.extract_metadata(html_content).title if html_content else "Web Page"
            
            if not content:
                # Fallback to simple paragraph stripping if trafilatura fails
                import bs4
                soup = bs4.BeautifulSoup(html_content, "html.parser")
                for s in soup(['script', 'style', 'nav', 'footer', 'header']):
                    s.decompose()
                content = soup.get_text(separator=' ', strip=True)
                title = soup.title.string if soup.title else "Web Page"
                
            if not content or not content.strip():
                raise Exception("Could not extract readable text content from the URL")
                
            return title or "Web Page", content.strip()
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise Exception(f"Failed to fetch web content: {str(e)}")

research_service = ResearchService()
