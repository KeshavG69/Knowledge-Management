"""
Unstructured API Client for complex document extraction
Fresh instance per task for Celery compatibility
"""

from pathlib import Path
from unstructured_client import UnstructuredClient as UnstructuredAPIClient
from unstructured_client.models import shared
from app.logger import logger
from app.settings import settings
from clients.pdf_image_extractor import get_pdf_image_extractor


class UnstructuredClient:
    """Unstructured API client for document extraction (no singleton for Celery)"""

    def __init__(self):
        """Initialize Unstructured API client"""
        self.api_key = settings.UNSTRUCTURED_API_KEY
        self.api_url = settings.UNSTRUCTURED_API_URL

        if not self.api_key:
            raise ValueError("UNSTRUCTURED_API_KEY not configured in settings")

        # Initialize client with default HTTP client (more stable for HI_RES processing)
        self.client = UnstructuredAPIClient(
            api_key_auth=self.api_key,
            server_url=self.api_url if self.api_url else None
        )

        logger.info("✅ Unstructured API client initialized")

    def cleanup(self):
        """Clean up resources"""
        try:
            if hasattr(self, 'client') and self.client:
                # Close the client's internal HTTP client if available
                if hasattr(self.client, 'sdk_configuration') and hasattr(self.client.sdk_configuration, 'client'):
                    self.client.sdk_configuration.client.close()
                logger.info("✅ Closed Unstructured client")
        except Exception as e:
            logger.warning(f"Error cleaning up Unstructured client: {str(e)}")

    def extract_content(self, file_content: bytes, filename: str) -> str:
        """
        Extract content from file using Unstructured API with FAST strategy
        For PDFs: also extracts and analyzes images using PyMuPDF + Vision LLM

        Args:
            file_content: File content as bytes
            filename: Original filename

        Returns:
            Extracted text with image analysis (for PDFs)

        Raises:
            Exception: If extraction fails
        """
        try:
            # Pass bytes directly to Unstructured API — no temp file needed
            req = {
                "partition_parameters": {
                    "files": {
                        "content": file_content,
                        "file_name": filename,
                    },
                    "strategy": shared.Strategy.FAST,
                    "split_pdf_page": False,
                    "split_pdf_allow_failed": False,
                    "split_pdf_concurrency_level": 1,
                }
            }

            res = self.client.general.partition(request=req)

            extracted_text = "\n\n".join([
                element.get("text", "")
                for element in res.elements
                if element.get("text")
            ])

            logger.info(
                f"✅ Unstructured API (fast) extracted {len(extracted_text)} chars from {filename}"
            )

            return extracted_text

        except Exception as e:
            logger.error(f"❌ Unstructured API extraction failed for {filename}: {str(e)}")
            raise Exception(f"Unstructured extraction failed: {str(e)}")

    @staticmethod
    def is_supported(extension: str) -> bool:
        """
        Check if file extension is supported by Unstructured API

        Args:
            extension: File extension with dot (e.g., '.pdf')

        Returns:
            True if supported
        """
        # Unstructured API supported formats (excluding what MarkItDown handles and media files)
        supported_formats = [
            # Documents
            ".pdf", ".dot", ".docm", ".dotm", ".rtf", ".odt",
            # Presentations
            ".ppt", ".pptx", ".pptm", ".pot", ".potx", ".potm",
            # HTML/Web
            ".html", ".htm", ".xml",
            # E-books and other
            ".epub", ".rst", ".org",
            # Email
            ".eml", ".msg", ".p7s",
            # Specialized formats
            ".abw", ".zabw", ".cwk", ".mcw", ".mw", ".hwp",
            # Spreadsheets (non-Excel)
            ".et", ".fods", ".tsv", ".dbf",
            # Other
            ".dif", ".eth", ".pbd", ".sdp", ".sxg", ".prn",
            # Images (Unstructured can extract text from images)
            
        ]
        return extension.lower() in supported_formats


def get_unstructured_client() -> UnstructuredClient:
    """
    Create a fresh UnstructuredClient instance (no caching for Celery)

    Returns:
        UnstructuredClient: Fresh client instance
    """
    return UnstructuredClient()
