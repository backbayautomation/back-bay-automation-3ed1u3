import pytest
import pytest_asyncio
import uuid
from datetime import datetime, timedelta
from io import BytesIO
from typing import List, Tuple

from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate

class DocumentTestData:
    """Helper class providing test data and utilities for document tests."""
    
    # Test file contents
    TEST_PDF_CONTENT = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type/Pages/Count 1>>\nendobj\nxref\n0 3\n0000000000 65535 f\n0000000015 00000 n\n0000000061 00000 n\ntrailer\n<</Size 3/Root 1 0 R>>\nstartxref\n110\n%%EOF'
    
    TEST_DOCX_CONTENT = b'PK\x03\x04\x14\x00\x00\x00\x08\x00\x00\x00!test document content'
    
    TEST_XLSX_CONTENT = b'PK\x03\x04\x14\x00\x00\x00\x08\x00\x00\x00!test spreadsheet content'
    
    VALID_EXTENSIONS = ['.pdf', '.docx', '.xlsx']
    
    MIME_TYPES = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
    
    MAX_FILE_SIZE = 104857600  # 100MB
    
    @staticmethod
    def create_test_file(extension: str, size: int = 1024, valid: bool = True) -> Tuple[BytesIO, str, str]:
        """Create test file with specified format and validation.
        
        Args:
            extension (str): File extension without dot
            size (int): Desired file size in bytes
            valid (bool): Whether to create valid or invalid file content
            
        Returns:
            tuple: (file_data, filename, mime_type)
            
        Raises:
            ValueError: If invalid extension or size
        """
        if f'.{extension}' not in DocumentTestData.VALID_EXTENSIONS:
            raise ValueError(f"Invalid extension: {extension}")
            
        if size > DocumentTestData.MAX_FILE_SIZE:
            raise ValueError(f"File size exceeds maximum: {size}")
            
        # Generate base content
        if valid:
            content = getattr(DocumentTestData, f'TEST_{extension.upper()}_CONTENT')
        else:
            content = b'Invalid file content'
            
        # Pad to desired size
        if len(content) < size:
            content += b'0' * (size - len(content))
            
        # Create file-like object
        file_data = BytesIO(content)
        filename = f"test_{uuid.uuid4().hex[:8]}.{extension}"
        mime_type = DocumentTestData.MIME_TYPES[extension]
        
        return file_data, filename, mime_type
    
    @staticmethod
    def create_bulk_test_files(count: int, extensions: List[str] = None) -> List[Tuple[BytesIO, str, str]]:
        """Create multiple test files for batch testing.
        
        Args:
            count (int): Number of files to create
            extensions (list): List of extensions to use, defaults to all valid
            
        Returns:
            list: List of (file_data, filename, mime_type) tuples
        """
        if count < 1:
            raise ValueError("Count must be positive")
            
        if not extensions:
            extensions = [ext.lstrip('.') for ext in DocumentTestData.VALID_EXTENSIONS]
            
        files = []
        for _ in range(count):
            ext = extensions[_ % len(extensions)]
            size = 1024 * (_ + 1)  # Vary sizes
            files.append(DocumentTestData.create_test_file(ext, size))
            
        return files

@pytest.mark.asyncio
@pytest.mark.documents
async def test_get_documents(db_session, auth_headers, test_client):
    """Test retrieving documents with pagination, sorting and filtering."""
    
    # Create test documents with various states
    test_files = DocumentTestData.create_bulk_test_files(5)
    documents = []
    
    for file_data, filename, _ in test_files:
        doc = Document(
            client_id=auth_headers['client_id'],
            filename=filename,
            type=filename.split('.')[-1],
            metadata={'size': len(file_data.getvalue())}
        )
        db_session.add(doc)
        documents.append(doc)
    
    # Set different statuses and dates
    for i, doc in enumerate(documents):
        doc.status = ['pending', 'processing', 'completed', 'failed', 'completed'][i]
        doc.created_at = datetime.utcnow() - timedelta(days=i)
        if doc.status == 'completed':
            doc.processed_at = doc.created_at + timedelta(minutes=5)
    
    await db_session.commit()
    
    # Test pagination
    response = await test_client.get(
        "/api/v1/documents?page=1&page_size=2",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data['items']) == 2
    assert data['total'] == 5
    assert data['page'] == 1
    assert data['pages'] == 3
    
    # Test sorting
    response = await test_client.get(
        "/api/v1/documents?sort=created_at&order=desc",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert datetime.fromisoformat(data['items'][0]['created_at']) > \
           datetime.fromisoformat(data['items'][1]['created_at'])
    
    # Test filtering
    response = await test_client.get(
        "/api/v1/documents?status=completed",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert all(doc['status'] == 'completed' for doc in data['items'])
    
    # Test type filtering
    response = await test_client.get(
        "/api/v1/documents?type=pdf",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert all(doc['type'] == 'pdf' for doc in data['items'])
    
    # Test date range filtering
    yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
    response = await test_client.get(
        f"/api/v1/documents?created_after={yesterday}",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert all(datetime.fromisoformat(doc['created_at']) > datetime.fromisoformat(yesterday)
              for doc in data['items'])

@pytest.mark.asyncio
@pytest.mark.documents
async def test_upload_document(db_session, auth_headers, test_client):
    """Test document upload with validation and error handling."""
    
    # Test valid uploads for each supported type
    for extension in ['pdf', 'docx', 'xlsx']:
        file_data, filename, mime_type = DocumentTestData.create_test_file(extension)
        
        files = {'file': (filename, file_data, mime_type)}
        response = await test_client.post(
            "/api/v1/documents",
            headers=auth_headers,
            files=files
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data['filename'] == filename
        assert data['type'] == extension
        assert data['status'] == 'pending'
        assert data['client_id'] == str(auth_headers['client_id'])
        
        # Verify document created in database
        doc = await db_session.get(Document, uuid.UUID(data['id']))
        assert doc is not None
        assert doc.filename == filename
        assert doc.type == extension
        assert doc.status == 'pending'
    
    # Test file size validation
    file_data, filename, mime_type = DocumentTestData.create_test_file(
        'pdf', 
        DocumentTestData.MAX_FILE_SIZE + 1024
    )
    files = {'file': (filename, file_data, mime_type)}
    response = await test_client.post(
        "/api/v1/documents",
        headers=auth_headers,
        files=files
    )
    assert response.status_code == 400
    assert 'file size exceeds' in response.json()['detail'].lower()
    
    # Test invalid file type
    file_data = BytesIO(b'Invalid content')
    files = {'file': ('test.txt', file_data, 'text/plain')}
    response = await test_client.post(
        "/api/v1/documents",
        headers=auth_headers,
        files=files
    )
    assert response.status_code == 400
    assert 'unsupported file type' in response.json()['detail'].lower()
    
    # Test malformed file content
    file_data, filename, mime_type = DocumentTestData.create_test_file('pdf', valid=False)
    files = {'file': (filename, file_data, mime_type)}
    response = await test_client.post(
        "/api/v1/documents",
        headers=auth_headers,
        files=files
    )
    assert response.status_code == 400
    assert 'invalid file content' in response.json()['detail'].lower()
    
    # Test concurrent uploads
    test_files = DocumentTestData.create_bulk_test_files(3)
    responses = await asyncio.gather(*[
        test_client.post(
            "/api/v1/documents",
            headers=auth_headers,
            files={'file': (filename, file_data, mime_type)}
        )
        for file_data, filename, mime_type in test_files
    ])
    assert all(r.status_code == 201 for r in responses)
    
    # Test client isolation
    other_client_headers = auth_headers.copy()
    other_client_headers['client_id'] = str(uuid.uuid4())
    file_data, filename, mime_type = DocumentTestData.create_test_file('pdf')
    files = {'file': (filename, file_data, mime_type)}
    response = await test_client.post(
        "/api/v1/documents",
        headers=other_client_headers,
        files=files
    )
    assert response.status_code == 403