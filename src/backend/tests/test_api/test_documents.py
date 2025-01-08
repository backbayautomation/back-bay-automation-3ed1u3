import pytest
import pytest_asyncio
import uuid
from datetime import datetime
from io import BytesIO
from typing import List, Tuple

from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate

# Constants for test data and validation
TEST_PDF_CONTENT = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n'
TEST_DOCX_CONTENT = b'PK\x03\x04\x14\x00\x00\x00\x08\x00\x00\x00!\'
TEST_XLSX_CONTENT = b'PK\x03\x04\x14\x00\x00\x00\x08\x00\x00\x00!\'
VALID_EXTENSIONS = ['.pdf', '.docx', '.xlsx']
MIME_TYPES = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}
MAX_FILE_SIZE = 104857600  # 100MB

class DocumentTestData:
    """Helper class providing test data and utilities for document tests."""
    
    @staticmethod
    def create_test_file(extension: str, size: int = 1024, valid: bool = True) -> Tuple[BytesIO, str, str]:
        """Create test file with specified format and validation.
        
        Args:
            extension (str): File extension without dot
            size (int): Desired file size in bytes
            valid (bool): Whether to create valid file content
            
        Returns:
            tuple: (file_data, filename, mime_type)
            
        Raises:
            ValueError: If extension is not supported
        """
        if f'.{extension}' not in VALID_EXTENSIONS:
            raise ValueError(f"Unsupported file extension: {extension}")
            
        # Generate appropriate test content
        if valid:
            content = {
                'pdf': TEST_PDF_CONTENT,
                'docx': TEST_DOCX_CONTENT,
                'xlsx': TEST_XLSX_CONTENT
            }.get(extension, b'')
        else:
            content = b'Invalid content' * (size // 13)
            
        # Pad content to desired size
        if len(content) < size:
            content += b'0' * (size - len(content))
            
        file_data = BytesIO(content)
        filename = f"test_{uuid.uuid4().hex[:8]}.{extension}"
        mime_type = MIME_TYPES[extension]
        
        return file_data, filename, mime_type
        
    @staticmethod
    def create_bulk_test_files(count: int, extensions: List[str] = None) -> List[Tuple[BytesIO, str, str]]:
        """Create multiple test files for batch testing.
        
        Args:
            count (int): Number of files to create
            extensions (list): List of extensions to use, defaults to all valid extensions
            
        Returns:
            list: List of (file_data, filename, mime_type) tuples
        """
        if count < 1:
            raise ValueError("Count must be positive")
            
        if not extensions:
            extensions = [ext.lstrip('.') for ext in VALID_EXTENSIONS]
            
        files = []
        for i in range(count):
            ext = extensions[i % len(extensions)]
            size = min(1024 * (i + 1), MAX_FILE_SIZE)  # Vary sizes
            files.append(DocumentTestData.create_test_file(ext, size))
            
        return files

@pytest.mark.asyncio
@pytest.mark.documents
async def test_get_documents(db_session, auth_headers, test_client):
    """Test retrieving documents with pagination, sorting and filtering."""
    # Create test documents with various states
    test_docs = []
    client_id = uuid.uuid4()
    
    for i in range(5):
        doc = Document(
            client_id=client_id,
            filename=f"test_doc_{i}.pdf",
            type="pdf",
            status="completed" if i % 2 == 0 else "processing",
            metadata={
                "page_count": i + 1,
                "file_size": f"{i + 1}MB"
            }
        )
        db_session.add(doc)
        test_docs.append(doc)
    
    await db_session.commit()
    
    # Test pagination
    response = await test_client.get(
        "/api/v1/documents",
        headers=auth_headers,
        params={"page": 1, "per_page": 2}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] == 5
    assert data["page"] == 1
    
    # Test sorting
    response = await test_client.get(
        "/api/v1/documents",
        headers=auth_headers,
        params={"sort": "created_at:desc"}
    )
    assert response.status_code == 200
    data = response.json()
    assert datetime.fromisoformat(data["items"][0]["created_at"]) >= \
           datetime.fromisoformat(data["items"][1]["created_at"])
    
    # Test filtering
    response = await test_client.get(
        "/api/v1/documents",
        headers=auth_headers,
        params={"status": "completed"}
    )
    assert response.status_code == 200
    data = response.json()
    assert all(doc["status"] == "completed" for doc in data["items"])
    
    # Test client isolation
    other_client_response = await test_client.get(
        "/api/v1/documents",
        headers={**auth_headers, "X-Client-ID": str(uuid.uuid4())}
    )
    assert other_client_response.status_code == 200
    assert len(other_client_response.json()["items"]) == 0

@pytest.mark.asyncio
@pytest.mark.documents
async def test_upload_document(db_session, auth_headers, test_client):
    """Test document upload with validation and error handling."""
    client_id = uuid.uuid4()
    
    # Test successful upload for each supported format
    for extension in ['pdf', 'docx', 'xlsx']:
        file_data, filename, mime_type = DocumentTestData.create_test_file(extension)
        
        response = await test_client.post(
            "/api/v1/documents",
            headers={**auth_headers, "X-Client-ID": str(client_id)},
            files={"file": (filename, file_data, mime_type)},
            data={"type": extension}
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["filename"] == filename
        assert data["type"] == extension
        assert data["status"] == "pending"
        assert data["client_id"] == str(client_id)
        
        # Verify document created in database
        doc = await db_session.get(Document, uuid.UUID(data["id"]))
        assert doc is not None
        assert doc.status == "pending"
    
    # Test file size validation
    oversized_file = DocumentTestData.create_test_file('pdf', MAX_FILE_SIZE + 1)[0]
    response = await test_client.post(
        "/api/v1/documents",
        headers={**auth_headers, "X-Client-ID": str(client_id)},
        files={"file": ("large.pdf", oversized_file, "application/pdf")},
        data={"type": "pdf"}
    )
    assert response.status_code == 400
    assert "file size" in response.json()["detail"].lower()
    
    # Test invalid file content
    invalid_file = DocumentTestData.create_test_file('pdf', valid=False)[0]
    response = await test_client.post(
        "/api/v1/documents",
        headers={**auth_headers, "X-Client-ID": str(client_id)},
        files={"file": ("invalid.pdf", invalid_file, "application/pdf")},
        data={"type": "pdf"}
    )
    assert response.status_code == 400
    assert "invalid file content" in response.json()["detail"].lower()
    
    # Test concurrent uploads
    files = DocumentTestData.create_bulk_test_files(5)
    tasks = []
    for file_data, filename, mime_type in files:
        tasks.append(
            test_client.post(
                "/api/v1/documents",
                headers={**auth_headers, "X-Client-ID": str(client_id)},
                files={"file": (filename, file_data, mime_type)},
                data={"type": filename.split('.')[-1]}
            )
        )
    
    responses = await asyncio.gather(*tasks)
    assert all(r.status_code == 201 for r in responses)
    assert len(set(r.json()["id"] for r in responses)) == len(responses)

@pytest.mark.asyncio
@pytest.mark.documents
async def test_update_document(db_session, auth_headers, test_client):
    """Test document update operations."""
    # Create test document
    doc = Document(
        client_id=uuid.uuid4(),
        filename="test.pdf",
        type="pdf",
        status="pending"
    )
    db_session.add(doc)
    await db_session.commit()
    
    # Test status update
    update_data = {"status": "processing"}
    response = await test_client.patch(
        f"/api/v1/documents/{doc.id}",
        headers=auth_headers,
        json=update_data
    )
    assert response.status_code == 200
    assert response.json()["status"] == "processing"
    
    # Test metadata update
    update_data = {
        "metadata": {
            "page_count": 10,
            "ocr_confidence": 0.95
        }
    }
    response = await test_client.patch(
        f"/api/v1/documents/{doc.id}",
        headers=auth_headers,
        json=update_data
    )
    assert response.status_code == 200
    assert response.json()["metadata"]["page_count"] == 10
    
    # Test invalid status transition
    update_data = {"status": "completed"}
    response = await test_client.patch(
        f"/api/v1/documents/{doc.id}",
        headers=auth_headers,
        json=update_data
    )
    assert response.status_code == 400
    assert "invalid status transition" in response.json()["detail"].lower()

@pytest.mark.asyncio
@pytest.mark.documents
async def test_delete_document(db_session, auth_headers, test_client):
    """Test document deletion with proper authorization."""
    # Create test document
    doc = Document(
        client_id=uuid.uuid4(),
        filename="test.pdf",
        type="pdf",
        status="completed"
    )
    db_session.add(doc)
    await db_session.commit()
    
    # Test successful deletion
    response = await test_client.delete(
        f"/api/v1/documents/{doc.id}",
        headers=auth_headers
    )
    assert response.status_code == 204
    
    # Verify document deleted
    deleted_doc = await db_session.get(Document, doc.id)
    assert deleted_doc is None
    
    # Test deletion with wrong client
    other_doc = Document(
        client_id=uuid.uuid4(),
        filename="other.pdf",
        type="pdf",
        status="completed"
    )
    db_session.add(other_doc)
    await db_session.commit()
    
    response = await test_client.delete(
        f"/api/v1/documents/{other_doc.id}",
        headers={**auth_headers, "X-Client-ID": str(uuid.uuid4())}
    )
    assert response.status_code == 404