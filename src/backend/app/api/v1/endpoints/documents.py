"""
FastAPI router endpoints for document management with enhanced security, monitoring, and error handling.
Implements multi-tenant document operations with comprehensive validation, processing status tracking,
and performance monitoring.

Version: 1.0.0
"""

import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks
from sqlalchemy.orm import Session
from prometheus_client import Counter, Histogram
from fastapi_limiter import RateLimiter

from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentUpdate, Document as DocumentSchema, DocumentProcessingStatus
from app.services.document_processor import DocumentProcessor
from app.db.session import get_db
from app.core.auth import requires_auth, get_current_client
from app.core.monitoring import track_operation_time
from app.utils.document_utils import validate_file_type

# Initialize router with prefix and tags
router = APIRouter(prefix='/documents', tags=['documents'])

# Constants
ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx']
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
RATE_LIMIT_UPLOADS = '100/hour'
PROCESSING_TIMEOUT = 300  # 5 minutes

# Initialize metrics
DOCUMENT_REQUESTS = Counter('document_requests_total', 'Total document requests', ['operation'])
DOCUMENT_ERRORS = Counter('document_errors_total', 'Document operation errors', ['error_type'])
PROCESSING_TIME = Histogram('document_processing_seconds', 'Document processing time')
UPLOAD_SIZE = Histogram('document_upload_bytes', 'Document upload size in bytes')

# Initialize logger
logger = logging.getLogger(__name__)

@router.get('/', response_model=List[DocumentSchema])
@requires_auth
@track_operation_time
async def get_documents(
    db: Session = Depends(get_db),
    client_id: UUID = Depends(get_current_client),
    status: Optional[str] = None,
    skip: Optional[int] = 0,
    limit: Optional[int] = 100
) -> List[DocumentSchema]:
    """
    Retrieve all documents for the authenticated client with filtering and pagination.

    Args:
        db: Database session
        client_id: Authenticated client ID
        status: Optional status filter
        skip: Number of records to skip
        limit: Maximum number of records to return

    Returns:
        List of document schemas with metadata
    """
    try:
        DOCUMENT_REQUESTS.labels(operation='get').inc()

        # Build query with filters
        query = db.query(Document).filter(Document.client_id == client_id)
        if status:
            query = query.filter(Document.status == status)

        # Apply pagination
        total_count = query.count()
        documents = query.offset(skip).limit(limit).all()

        logger.info(
            f"Retrieved {len(documents)} documents",
            extra={
                'client_id': str(client_id),
                'status_filter': status,
                'total_count': total_count
            }
        )

        return [DocumentSchema.from_orm(doc) for doc in documents]

    except Exception as e:
        error_type = type(e).__name__
        DOCUMENT_ERRORS.labels(error_type=error_type).inc()
        logger.error(
            f"Error retrieving documents: {str(e)}",
            extra={'client_id': str(client_id)},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving documents"
        )

@router.post('/', response_model=DocumentSchema, status_code=status.HTTP_201_CREATED)
@requires_auth
@RateLimiter(RATE_LIMIT_UPLOADS)
@track_operation_time
async def upload_document(
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    document_data: DocumentCreate = Depends(),
    background_tasks: BackgroundTasks = BackgroundTasks()
) -> DocumentSchema:
    """
    Upload and process a new document with enhanced validation and monitoring.

    Args:
        db: Database session
        file: Uploaded file
        document_data: Document metadata
        background_tasks: Background task manager

    Returns:
        Created document schema with processing status
    """
    try:
        DOCUMENT_REQUESTS.labels(operation='upload').inc()

        # Validate file type and size
        is_valid, error_msg = await validate_file_type(file.filename)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file: {error_msg}"
            )

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum limit of {MAX_FILE_SIZE // (1024*1024)}MB"
            )

        UPLOAD_SIZE.observe(len(content))

        # Create document record
        document = Document(
            client_id=document_data.client_id,
            filename=file.filename,
            type=file.filename.split('.')[-1].lower(),
            metadata={
                'original_name': file.filename,
                'content_type': file.content_type,
                'size_bytes': len(content)
            }
        )
        db.add(document)
        db.commit()
        db.refresh(document)

        # Initialize document processor
        processor = DocumentProcessor(
            ocr_service=OCRService(),
            ai_service=AIService(),
            vector_search=VectorSearchService(),
            config={'timeout': PROCESSING_TIMEOUT}
        )

        # Schedule background processing
        background_tasks.add_task(
            processor.process_document,
            document=document,
            tenant_id=str(document_data.client_id)
        )

        logger.info(
            f"Document uploaded successfully",
            extra={
                'document_id': str(document.id),
                'client_id': str(document_data.client_id),
                'filename': file.filename,
                'size': len(content)
            }
        )

        return DocumentSchema.from_orm(document)

    except HTTPException:
        raise

    except Exception as e:
        error_type = type(e).__name__
        DOCUMENT_ERRORS.labels(error_type=error_type).inc()
        logger.error(
            f"Error uploading document: {str(e)}",
            extra={'filename': file.filename},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing document upload"
        )