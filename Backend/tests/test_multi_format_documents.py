import pytest
import io
import zipfile
from utils.document_processor import DocumentProcessor
from models.database import User
from utils.auth import create_access_token


@pytest.mark.asyncio
async def test_extract_txt_and_md():
    """Verify TXT and Markdown multi-encoding extraction"""
    txt_content = b"Operating Systems: CPU Scheduling algorithms include FCFS, SJF, and Round Robin."
    text, file_type = await DocumentProcessor.process_document(txt_content, "lecture1.txt")
    assert "FCFS" in text
    assert file_type == "text"

    md_content = b"# Operating Systems\n\n## Processes & Threads\nA thread is a basic unit of CPU utilization."
    text_md, file_type_md = await DocumentProcessor.process_document(md_content, "notes.md")
    assert "Processes & Threads" in text_md
    assert file_type_md == "text"


@pytest.mark.asyncio
async def test_extract_csv():
    """Verify CSV formatting into structured markdown table"""
    csv_content = b"Student,Subject,Marks\nAlice,Physics,95\nBob,Chemistry,88"
    text, file_type = await DocumentProcessor.process_document(csv_content, "grades.csv")
    assert "| Student | Subject | Marks |" in text
    assert "| Alice | Physics | 95 |" in text
    assert file_type == "spreadsheet"


@pytest.mark.asyncio
async def test_extract_docx_and_xml_fallback():
    """Verify Word document processing with XML stream fallback"""
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, 'w') as z:
        xml = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Quantum Computing and Superposition Principle</w:t></w:r></w:p></w:body></w:document>'
        z.writestr('word/document.xml', xml)
    
    docx_bytes = bio.getvalue()
    text, file_type = await DocumentProcessor.process_document(docx_bytes, "quantum.docx")
    assert "Quantum Computing" in text
    assert file_type == "docx"


@pytest.mark.asyncio
async def test_extract_pptx_slide_structure():
    """Verify PowerPoint extraction ordering slides with slide numbers and titles"""
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, 'w') as z:
        slide1_xml = '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Introduction to Machine Learning</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
        slide2_xml = '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Supervised vs Unsupervised</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
        z.writestr('ppt/slides/slide1.xml', slide1_xml)
        z.writestr('ppt/slides/slide2.xml', slide2_xml)
    
    pptx_bytes = bio.getvalue()
    text, file_type = await DocumentProcessor.process_document(pptx_bytes, "ai_lecture.pptx")
    assert "--- Slide 1:" in text
    assert "Introduction to Machine Learning" in text
    assert "--- Slide 2:" in text
    assert "Supervised vs Unsupervised" in text
    assert file_type == "pptx"


@pytest.mark.asyncio
async def test_extract_image_fallback():
    """Verify image uploads never crash even without Tesseract binary"""
    img_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    text, file_type = await DocumentProcessor.process_document(img_content, "circuit_diagram.png")
    assert "circuit_diagram.png" in text
    assert file_type == "image"


def test_upload_endpoint_routing(client, db):
    """Verify both /upload-document and /documents/upload endpoints work with 'files' and 'file'"""
    user = db.query(User).filter(User.id == 1).first()
    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Test /upload-document with 'files'
    files_payload = [
        ("files", ("test_notes.txt", io.BytesIO(b"Data structures: Binary Trees, Heaps, and Graphs."), "text/plain"))
    ]
    res1 = client.post("/upload-document", files=files_payload, headers=headers)
    assert res1.status_code == 200
    docs1 = res1.json()
    assert len(docs1) >= 1
    assert docs1[0]["filename"] == "test_notes.txt"

    # 2. Test /documents/upload with single 'file'
    file_payload = {
        "file": ("syllabus.md", io.BytesIO(b"# Course Syllabus\n1. Algorithms\n2. Complexity"), "text/markdown")
    }
    res2 = client.post("/documents/upload", files=file_payload, headers=headers)
    assert res2.status_code == 200
    docs2 = res2.json()
    assert len(docs2) >= 1
    assert docs2[0]["filename"] == "syllabus.md"
