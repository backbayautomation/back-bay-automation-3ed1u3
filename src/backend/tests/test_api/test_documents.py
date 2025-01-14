import pytest
import pytest_asyncio
import uuid
import io
from datetime import datetime, timedelta

from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate

class DocumentTestData:
    """Helper class providing test data and utilities for document tests."""
    
    # Test file contents for different formats
    TEST_PDF_CONTENT = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n%%EOF'
    TEST_DOCX_CONTENT = b'PK\x03\x04\x14\x00\x00\x00\x08\x00test document content'
    TEST_XLSX_CONTENT = b'PK\x03\x04\x14\x00\x00\x00\x08\x00test spreadsheet content'
    
    # Valid file extensions and MIME types
    VALID_EXTENSIONS = ['.pdf', '.docx', '.xlsx']
    MIME_TYPES = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
    
    # Maximum file size (100MB)
    MAX_FILE_SIZE = 104857600

    @staticmethod
    def create_test_file(extension: str, size: int = 1024, valid: bool = True) -> tuple[io.BytesIO, str, str]:
        """Create test file with specified format and validation.
        
        Args:
            extension (str): File extension (.pdf, .docx, .xlsx)
            size (int): File size in bytes
            valid (bool): Whether to create valid file content
            
        Returns:
            tuple: (file_data, filename, mime_type)
            
        Raises:
            ValueError: If extension is invalid
        """
        if extension not in DocumentTestData.VALID_EXTENSIONS:
            raise ValueError(f"Invalid extension: {extension}")
            
        # Generate appropriate test content
        if extension == '.pdf':
            content = DocumentTestData.TEST_PDF_CONTENT if valid else b'invalid pdf'
        elif extension == '.docx':
            content = DocumentTestData.TEST_DOCX_CONTENT if valid else b'invalid docx'
        else:
            content = DocumentTestData.TEST_XLSX_CONTENT if valid else b'invalid xlsx'
            
        # Pad content to requested size
        if len(content) < size:
            content += b'0' * (size - len(content))
            
        # Create file data
        file_data = io.BytesIO(content)
        filename = f"test_doc_{uuid.uuid4().hex[:8]}{extension}"
        mime_type = DocumentTestData.MIME_TYPES[extension[1:]]
        
        return file_data, filename, mime_type

    @staticmethod
    def create_bulk_test_files(count: int, extensions: list = None) -> list[tuple[io.BytesIO, str, str]]:
        """Create multiple test files for batch testing.
        
        Args:
            count (int): Number of files to create
            extensions (list): List of extensions to use, defaults to all valid extensions
            
        Returns:
            list: List of (file_data, filename, mime_type) tuples
        """
        if count < 1:
            raise ValueError("Count must be positive")
            
        extensions = extensions or DocumentTestData.VALID_EXTENSIONS
        files = []
        
        for i in range(count):
            ext = extensions[i % len(extensions)]
            size = 1024 * (i + 1)  # Vary sizes
            files.append(DocumentTestData.create_test_file(ext, size))
            
        return files

@pytest.mark.asyncio
@pytest.mark.documents
async def test_get_documents(db_session, auth_headers, test_client):
    """Test retrieving all documents for authenticated client with pagination, sorting and filtering."""
    
    # Create test documents with different statuses and types
    test_docs = []
    client_id = uuid.uuid4()
    
    for i in range(10):
        doc = Document(
            client_id=client_id,
            filename=f"test_doc_{i}.pdf",
            type="pdf",
            status="completed" if i < 5 else "pending"
        )
        test_docs.append(doc)
        db_session.add(doc)
    await db_session.commit()
    
    # Test pagination
    response = await test_client.get(
        "/api/v1/documents?page=1&page_size=5",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 5
    assert data["total"] == 10
    assert data["page"] == 1
    
    # Test sorting
    response = await test_client.get(
        "/api/v1/documents?sort=created_at:desc",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    created_dates = [doc["created_at"] for doc in data["items"]]
    assert created_dates == sorted(created_dates, reverse=True)
    
    # Test filtering
    response = await test_client.get(
        "/api/v1/documents?status=completed",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert all(doc["status"] == "completed" for doc in data["items"])
    assert data["total"] == 5
    
    # Test combined query
    response = await test_client.get(
        "/api/v1/documents?status=pending&sort=filename:asc&page=1&page_size=3",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 3
    assert all(doc["status"] == "pending" for doc in data["items"])
    filenames = [doc["filename"] for doc in data["items"]]
    assert filenames == sorted(filenames)

@pytest.mark.asyncio
@pytest.mark.documents
async def test_upload_document(db_session, auth_headers, test_client):
    """Test document upload with enhanced validation and error handling."""
    
    client_id = uuid.uuid4()
    test_data = DocumentTestData()
    
    # Test valid uploads for each supported format
    for ext in test_data.VALID_EXTENSIONS:
        file_data, filename, mime_type = test_data.create_test_file(ext)
        
        files = {"file": (filename, file_data, mime_type)}
        data = {"client_id": str(client_id)}
        
        response = await test_client.post(
            "/api/v1/documents",
            headers=auth_headers,
            files=files,
            data=data
        )
        
        assert response.status_code == 201
        doc_data = response.json()
        assert doc_data["filename"] == filename
        assert doc_data["type"] == ext[1:]
        assert doc_data["status"] == "pending"
        
        # Verify document in database
        doc = await db_session.get(Document, uuid.UUID(doc_data["id"]))
        assert doc is not None
        assert doc.client_id == client_id
    
    # Test file size validation
    file_data, filename, mime_type = test_data.create_test_file(
        '.pdf',
        size=test_data.MAX_FILE_SIZE + 1
    )
    files = {"file": (filename, file_data, mime_type)}
    data = {"client_id": str(client_id)}
    
    response = await test_client.post(
        "/api/v1/documents",
        headers=auth_headers,
        files=files,
        data=data
    )
    assert response.status_code == 400
    assert "file size exceeds" in response.json()["detail"].lower()
    
    # Test invalid file content
    file_data, filename, mime_type = test_data.create_test_file(
        '.pdf',
        valid=False
    )
    files = {"file": (filename, file_data, mime_type)}
    data = {"client_id": str(client_id)}
    
    response = await test_client.post(
        "/api/v1/documents",
        headers=auth_headers,
        files=files,
        data=data
    )
    assert response.status_code == 400
    assert "invalid file content" in response.json()["detail"].lower()
    
    # Test concurrent uploads
    files_to_upload = test_data.create_bulk_test_files(5)
    tasks = []
    
    for file_data, filename, mime_type in files_to_upload:
        files = {"file": (filename, file_data, mime_type)}
        data = {"client_id": str(client_id)}
        
        task = test_client.post(
            "/api/v1/documents",
            headers=auth_headers,
            files=files,
            data=data
        )
        tasks.append(task)
    
    responses = await asyncio.gather(*tasks)
    assert all(r.status_code == 201 for r in responses)
    
    # Test client isolation
    other_client_id = uuid.uuid4()
    file_data, filename, mime_type = test_data.create_test_file('.pdf')
    files = {"file": (filename, file_data, mime_type)}
    data = {"client_id": str(other_client_id)}
    
    response = await test_client.post(
        "/api/v1/documents",
        headers=auth_headers,
        files=files,
        data=data
    )
    assert response.status_code == 403