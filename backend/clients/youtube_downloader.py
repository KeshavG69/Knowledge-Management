"""
YouTube Downloader Client
Downloads YouTube videos using yt-dlp
"""

import tempfile
import os
from typing import Tuple, Optional
from app.logger import logger

try:
    import yt_dlp
except ImportError:
    raise ImportError("yt-dlp is required. Install it with: pip install yt-dlp")


class YouTubeDownloader:
    """YouTube video downloader using yt-dlp"""

    def __init__(self):
        """Initialize YouTube downloader"""
        self.ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': '%(id)s.%(ext)s',
            'quiet': False,
            'no_warnings': False,
            'extract_flat': False,
        }

    def download_video(self, youtube_url: str) -> Tuple[bytes, str, dict]:
        """
        Download YouTube video and return as bytes

        Args:
            youtube_url: YouTube video URL

        Returns:
            Tuple of (video_bytes, filename, metadata)
            - video_bytes: Video file content as bytes
            - filename: Generated filename (title + .mp4)
            - metadata: Video metadata (title, duration, uploader, etc.)

        Raises:
            Exception: If download fails
        """
        logger.info(f"📥 Downloading YouTube video: {youtube_url}")

        temp_dir = tempfile.mkdtemp()

        try:
            # Configure download options
            ydl_opts = {
                **self.ydl_opts,
                'outtmpl': os.path.join(temp_dir, '%(id)s.%(ext)s'),
            }

            # Download video
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # Extract info first
                info = ydl.extract_info(youtube_url, download=True)

                # Get metadata
                video_id = info.get('id')
                title = info.get('title', 'Untitled')
                duration = info.get('duration', 0)
                uploader = info.get('uploader', 'Unknown')
                upload_date = info.get('upload_date', '')
                description = info.get('description', '')

                metadata = {
                    'video_id': video_id,
                    'title': title,
                    'duration': duration,
                    'uploader': uploader,
                    'upload_date': upload_date,
                    'description': description,
                    'url': youtube_url,
                }

                # Find downloaded file
                downloaded_file = None
                for file in os.listdir(temp_dir):
                    if file.startswith(video_id):
                        downloaded_file = os.path.join(temp_dir, file)
                        break

                if not downloaded_file or not os.path.exists(downloaded_file):
                    raise FileNotFoundError(f"Downloaded video file not found for video ID: {video_id}")

                # Read file content
                with open(downloaded_file, 'rb') as f:
                    video_bytes = f.read()

                # Generate safe filename
                safe_title = self._sanitize_filename(title)
                filename = f"{safe_title}.mp4"

                logger.info(f"✅ Successfully downloaded: {title} ({len(video_bytes) / (1024*1024):.2f} MB)")

                return video_bytes, filename, metadata

        except Exception as e:
            logger.error(f"❌ Failed to download YouTube video: {str(e)}")
            raise Exception(f"Failed to download YouTube video: {str(e)}")

        finally:
            # Cleanup temp directory
            try:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp directory: {str(e)}")

    def _sanitize_filename(self, filename: str) -> str:
        """
        Sanitize filename for safe storage

        Args:
            filename: Original filename

        Returns:
            Sanitized filename
        """
        # Remove or replace unsafe characters
        unsafe_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\n', '\r', '\t']
        safe_name = filename

        for char in unsafe_chars:
            safe_name = safe_name.replace(char, '_')

        # Limit length
        max_length = 200
        if len(safe_name) > max_length:
            safe_name = safe_name[:max_length]

        return safe_name.strip()

    def validate_youtube_url(self, url: str) -> bool:
        """
        Validate if URL is a valid YouTube URL

        Args:
            url: URL to validate

        Returns:
            True if valid YouTube URL
        """
        youtube_domains = [
            'youtube.com',
            'www.youtube.com',
            'youtu.be',
            'm.youtube.com',
        ]

        url_lower = url.lower()
        return any(domain in url_lower for domain in youtube_domains)


# Singleton instance
_youtube_downloader: Optional[YouTubeDownloader] = None


def get_youtube_downloader() -> YouTubeDownloader:
    """Get or create YouTube downloader singleton"""
    global _youtube_downloader
    if _youtube_downloader is None:
        _youtube_downloader = YouTubeDownloader()
    return _youtube_downloader
