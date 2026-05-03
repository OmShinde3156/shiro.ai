import fitz  # PyMuPDF
import sys
import os
try:
    import pytesseract
    if sys.platform.startswith('win'):
        default_tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        if os.path.exists(default_tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = default_tesseract_path
except ImportError:
    pytesseract = None

from PIL import Image
import docx
from typing import Tuple
import io
import tempfile
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor

class DocumentProcessor:

    @staticmethod
    async def extract_text_from_pdf(file_content: bytes) -> str:
        """Extract text from PDF using PyMuPDF with OCR fallback for scanned pages"""
        try:
            # Run blocking PDF operations in a thread pool
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, DocumentProcessor._process_pdf_sync, file_content)
        except Exception as e:
            raise Exception(f"Error extracting PDF text: {str(e)}")

    @staticmethod
    def _process_pdf_sync(file_content: bytes) -> str:
        """Synchronous PDF processing logic"""
        doc = fitz.Document(stream=file_content, filetype="pdf")
        text = ""
        for page in doc:
            page_text = page.get_text()
            # If page has very little text, it might be a scanned image
            if len(page_text.strip()) < 50 and pytesseract:
                try:
                    # Convert page to image for OCR
                    pix = page.get_pixmap()
                    img_data = pix.tobytes("png")
                    image = Image.open(io.BytesIO(img_data))
                    ocr_text = pytesseract.image_to_string(image)
                    page_text += "\n" + ocr_text
                except Exception:
                    pass # OCR failed, just use what we have
            text += page_text + "\n"
        doc.close()
        return text.strip()

    @staticmethod
    async def extract_text_from_image(file_content: bytes) -> str:
        """Extract text from image using OCR"""
        if not pytesseract:
            raise Exception("Tesseract OCR library (pytesseract) is not installed.")

        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, DocumentProcessor._process_image_sync, file_content)
        except Exception as e:
            if "TesseractNotFoundError" in str(type(e)):
                 raise Exception("Tesseract OCR binary not found. Please install Tesseract-OCR.")
            raise Exception(f"Error extracting image text: {str(e)}")

    @staticmethod
    def _process_image_sync(file_content: bytes) -> str:
        image = Image.open(io.BytesIO(file_content))
        text = pytesseract.image_to_string(image)
        return text.strip()

    @staticmethod
    async def extract_text_from_docx(file_content: bytes) -> str:
        """Extract text from DOCX file without writing to disk"""
        try:
            bio = io.BytesIO(file_content)
            doc = docx.Document(bio)
            text = "\n".join([p.text for p in doc.paragraphs])
            return text.strip()
        except Exception as e:
            raise Exception(f"Error extracting DOCX text: {str(e)}")

    @staticmethod
    async def process_document(file_content: bytes, filename: str) -> Tuple[str, str]:
        """Process document and extract text based on file type"""
        file_extension = filename.lower().split('.')[-1]

        if file_extension == 'pdf':
            text = await DocumentProcessor.extract_text_from_pdf(file_content)
            return text, 'pdf'
        elif file_extension in ['jpg', 'jpeg', 'png', 'bmp', 'tiff']:
            text = await DocumentProcessor.extract_text_from_image(file_content)
            return text, 'image'
        elif file_extension in ['docx', 'doc']:
            text = await DocumentProcessor.extract_text_from_docx(file_content)
            return text, 'docx'
        else:
            # Try to decode as text
            try:
                text = file_content.decode('utf-8')
                return text, 'text'
            except:
                raise Exception(f"Unsupported file type: {file_extension}")