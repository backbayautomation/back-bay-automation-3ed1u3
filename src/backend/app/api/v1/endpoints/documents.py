"""
FastAPI router endpoints for document management with enhanced security and monitoring.
Implements multi-tenant document operations with comprehensive validation and tracking.

Version: 1.0.0
"""

import logging
from typing import List, Optional
from uuid import UUID
from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File, 
    status, BackgroundTasks, Query, Path
)
from sqlalchemy.orm import Session
from prometheus_client import Counter, Histogram
from fastapi_limiter import RateLimiter
from fastapi_limiter.depends import RateLimiter

from app.models.document import Document
from app.schemas.document import (
    DocumentCreate, DocumentUpdate, Document as DocumentSchema,
    DocumentProcessingStatus
)
from app.services.document_processor import DocumentProcessor
from app.db.session import get_db
from app.core.security import get_current_client
from app.utils.document_utils import validate_file_type

# Initialize router with prefix and tags
router = APIRouter(prefix="/documents", tags=["documents"])

# Constants
ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx"]
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
RATE_LIMIT_UPLOADS = "100/hour"
PROCESSING_TIMEOUT = 300  # 5 minutes

# Initialize metrics
DOCUMENT_REQUESTS = Counter(
    "document_requests_total",
    "Total number of document requests",
    ["endpoint", "status"]
)
PROCESSING_DURATION = Histogram(
    "document_processing_duration_seconds",
    "Time spent processing documents"
)

# Initialize logger
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[DocumentSchema])
async def get_documents(
    db: Session = Depends(get_db),
    client_id: UUID = Depends(get_current_client),
    status: Optional[str] = Query(None, description="Filter by document status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of records to return")
) -> List[DocumentSchema]:
    """
    Retrieve documents with pagination and filtering.
    
    Args:
        db: Database session
        client_id: Authenticated client ID
        status: Optional status filter
        skip: Pagination offset
        limit: Pagination limit
        
    Returns:
        List of document schemas
    """
    try:
        DOCUMENT_REQUESTS.labels(endpoint="get_documents", status="started").inc()
        
        # Build query with filters
        query = db.query(Document).filter(Document.client_id == client_id)
        if status:
            query = query.filter(Document.status == status)
            
        # Apply pagination
        documents = query.order_by(Document.created_at.desc())\
                        .offset(skip)\
                        .limit(limit)\
                        .all()
        
        DOCUMENT_REQUESTS.labels(endpoint="get_documents", status="success").inc()
        
        logger.info(
            f"Retrieved {len(documents)} documents",
            extra={
                "client_id": str(client_id),
                "status_filter": status,
                "skip": skip,
                "limit": limit
            }
        )
        
        return [DocumentSchema.from_orm(doc) for doc in documents]
        
    except Exception as e:
        DOCUMENT_REQUESTS.labels(endpoint="get_documents", status="error").inc()
        logger.error(
            f"Error retrieving documents: {str(e)}",
            extra={"client_id": str(client_id)},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving documents"
        )

@router.post("/", response_model=DocumentSchema, status_code=status.HTTP_201_CREATED)
@RateLimiter(times=100, hours=1)
async def upload_document(
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    document_data: DocumentCreate = Depends(),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    client_id: UUID = Depends(get_current_client)
) -> DocumentSchema:
    """
    Upload and process a new document with enhanced validation.
    
    Args:
        db: Database session
        file: Uploaded file
        document_data: Document metadata
        background_tasks: Background task manager
        client_id: Authenticated client ID
        
    Returns:
        Created document schema
    """
    try:
        DOCUMENT_REQUESTS.labels(endpoint="upload_document", status="started").inc()
        
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
                detail=f"File size exceeds maximum limit of {MAX_FILE_SIZE} bytes"
            )
            
        # Create document record
        document = Document(
            client_id=client_id,
            filename=file.filename,
            type=file.filename.split(".")[-1].lower(),
            metadata={
                "original_filename": file.filename,
                "content_type": file.content_type,
                "size": file.size
            }
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        # Initialize document processor
        processor = DocumentProcessor(
            ocr_service=None,  # Injected by dependency system
            ai_service=None,   # Injected by dependency system
            vector_search=None # Injected by dependency system
        )
        
        # Schedule background processing
        background_tasks.add_task(
            processor.process_document,
            document=document,
            file_content=await file.read(),
            tenant_id=str(client_id)
        )
        
        DOCUMENT_REQUESTS.labels(endpoint="upload_document", status="success").inc()
        
        logger.info(
            "Document uploaded successfully",
            extra={
                "document_id": str(document.id),
                "client_id": str(client_id),
                "filename": file.filename
            }
        )
        
        return DocumentSchema.from_orm(document)
        
    except HTTPException:
        raise
    except Exception as e:
        DOCUMENT_REQUESTS.labels(endpoint="upload_document", status="error").inc()
        logger.error(
            f"Error uploading document: {str(e)}",
            extra={
                "client_id": str(client_id),
                "filename": file.filename
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error uploading document"
        )

@router.get("/{document_id}", response_model=DocumentSchema)
async def get_document(
    document_id: UUID = Path(..., description="Document ID to retrieve"),
    db: Session = Depends(get_db),
    client_id: UUID = Depends(get_current_client)
) -> DocumentSchema:
    """
    Retrieve a specific document by ID with tenant isolation.
    
    Args:
        document_id: Document ID to retrieve
        db: Database session
        client_id: Authenticated client ID
        
    Returns:
        Document schema
    """
    try:
        DOCUMENT_REQUESTS.labels(endpoint="get_document", status="started").inc()
        
        document = db.query(Document)\
                    .filter(Document.id == document_id)\
                    .filter(Document.client_id == client_id)\
                    .first()
                    
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
            
        DOCUMENT_REQUESTS.labels(endpoint="get_document", status="success").inc()
        
        logger.info(
            "Document retrieved successfully",
            extra={
                "document_id": str(document_id),
                "client_id": str(client_id)
            }
        )
        
        return DocumentSchema.from_orm(document)
        
    except HTTPException:
        raise
    except Exception as e:
        DOCUMENT_REQUESTS.labels(endpoint="get_document", status="error").inc()
        logger.error(
            f"Error retrieving document: {str(e)}",
            extra={
                "document_id": str(document_id),
                "client_id": str(client_id)
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving document"
        )

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID = Path(..., description="Document ID to delete"),
    db: Session = Depends(get_db),
    client_id: UUID = Depends(get_current_client)
) -> None:
    """
    Delete a specific document with tenant isolation.
    
    Args:
        document_id: Document ID to delete
        db: Database session
        client_id: Authenticated client ID
    """
    try:
        DOCUMENT_REQUESTS.labels(endpoint="delete_document", status="started").inc()
        
        document = db.query(Document)\
                    .filter(Document.id == document_id)\
                    .filter(Document.client_id == client_id)\
                    .first()
                    
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
            
        db.delete(document)
        db.commit()
        
        DOCUMENT_REQUESTS.labels(endpoint="delete_document", status="success").inc()
        
        logger.info(
            "Document deleted successfully",
            extra={
                "document_id": str(document_id),
                "client_id": str(client_id)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        DOCUMENT_REQUESTS.labels(endpoint="delete_document", status="error").inc()
        logger.error(
            f"Error deleting document: {str(e)}",
            extra={
                "document_id": str(document_id),
                "client_id": str(client_id)
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting document"
        )