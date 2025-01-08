"""
FastAPI router endpoints for document management with enhanced security, monitoring, and error handling.
Implements multi-tenant document operations with comprehensive validation and performance monitoring.

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
from app.core.config import settings
from app.db.session import get_db
from app.utils.document_utils import validate_file_type
from app.api.deps import get_current_client, require_client_access

# Initialize router
router = APIRouter(prefix='/documents', tags=['documents'])

# Constants
ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx']
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
RATE_LIMIT_UPLOADS = '100/hour'
PROCESSING_TIMEOUT = 300  # 5 minutes

# Prometheus metrics
DOCUMENT_REQUESTS = Counter('document_api_requests_total', 'Total document API requests')
UPLOAD_LATENCY = Histogram('document_upload_latency_seconds', 'Document upload latency')
PROCESSING_ERRORS = Counter('document_processing_errors_total', 'Document processing errors')

# Configure logging
logger = logging.getLogger(__name__)

@router.get('/', response_model=List[DocumentSchema])
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
        List[DocumentSchema]: Filtered and paginated list of documents
    """
    DOCUMENT_REQUESTS.inc()
    try:
        # Build query with filters
        query = db.query(Document).filter(Document.client_id == client_id)
        
        if status:
            query = query.filter(Document.status == status)
        
        # Apply pagination
        documents = query.offset(skip).limit(limit).all()
        
        logger.info(
            "Documents retrieved successfully",
            extra={
                'client_id': str(client_id),
                'count': len(documents),
                'status_filter': status
            }
        )
        
        return [DocumentSchema.from_orm(doc) for doc in documents]

    except Exception as e:
        logger.error(
            "Error retrieving documents",
            extra={
                'client_id': str(client_id),
                'error': str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve documents"
        )

@router.post('/', response_model=DocumentSchema, status_code=status.HTTP_201_CREATED)
@RateLimiter(RATE_LIMIT_UPLOADS)
async def upload_document(
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    document_data: DocumentCreate = Depends(),
    background_tasks: BackgroundTasks = None,
    client_id: UUID = Depends(get_current_client)
) -> DocumentSchema:
    """
    Upload and process a new document with enhanced validation and monitoring.

    Args:
        db: Database session
        file: Uploaded file
        document_data: Document metadata
        background_tasks: Background task manager
        client_id: Authenticated client ID

    Returns:
        DocumentSchema: Created document with processing status
    """
    with UPLOAD_LATENCY.time():
        try:
            # Validate client access
            await require_client_access(db, client_id, document_data.client_id)
            
            # Validate file type and size
            is_valid, error_msg = validate_file_type(file.filename)
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid file: {error_msg}"
                )
            
            if file.size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE} bytes"
                )
            
            # Create document record
            document = Document(
                client_id=document_data.client_id,
                filename=file.filename,
                type=file.filename.split('.')[-1].lower(),
                metadata=document_data.metadata
            )
            db.add(document)
            db.commit()
            
            # Initialize document processor
            processor = DocumentProcessor(
                ocr_service=settings.OCR_SERVICE,
                ai_service=settings.AI_SERVICE,
                vector_search=settings.VECTOR_SEARCH,
                config=settings.DOCUMENT_PROCESSING
            )
            
            # Schedule background processing
            if background_tasks:
                background_tasks.add_task(
                    processor.process_document,
                    document=document,
                    tenant_id=str(client_id)
                )
            
            logger.info(
                "Document uploaded successfully",
                extra={
                    'document_id': str(document.id),
                    'client_id': str(client_id),
                    'filename': file.filename
                }
            )
            
            return DocumentSchema.from_orm(document)

        except HTTPException:
            raise
        except Exception as e:
            PROCESSING_ERRORS.inc()
            logger.error(
                "Document upload failed",
                extra={
                    'client_id': str(client_id),
                    'filename': file.filename,
                    'error': str(e)
                }
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process document upload"
            )

@router.get('/{document_id}', response_model=DocumentSchema)
async def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    client_id: UUID = Depends(get_current_client)
) -> DocumentSchema:
    """
    Retrieve a specific document by ID with access control.

    Args:
        document_id: Document UUID
        db: Database session
        client_id: Authenticated client ID

    Returns:
        DocumentSchema: Document details
    """
    DOCUMENT_REQUESTS.inc()
    try:
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.client_id == client_id
        ).first()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        logger.info(
            "Document retrieved successfully",
            extra={
                'document_id': str(document_id),
                'client_id': str(client_id)
            }
        )
        
        return DocumentSchema.from_orm(document)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error retrieving document",
            extra={
                'document_id': str(document_id),
                'client_id': str(client_id),
                'error': str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document"
        )

@router.delete('/{document_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    client_id: UUID = Depends(get_current_client)
):
    """
    Delete a document with security validation.

    Args:
        document_id: Document UUID
        db: Database session
        client_id: Authenticated client ID
    """
    try:
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.client_id == client_id
        ).first()
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        db.delete(document)
        db.commit()
        
        logger.info(
            "Document deleted successfully",
            extra={
                'document_id': str(document_id),
                'client_id': str(client_id)
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error deleting document",
            extra={
                'document_id': str(document_id),
                'client_id': str(client_id),
                'error': str(e)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document"
        )