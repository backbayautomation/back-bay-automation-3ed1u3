/**
 * TypeScript type definitions and interfaces for document-related data structures.
 * Provides comprehensive type safety for document processing, metadata, and API interactions.
 * @version 1.0.0
 */

import { 
    BaseEntity, 
    UUID, 
    Timestamp, 
    PaginatedResponse, 
    ApiResponse 
} from './common';

/**
 * Supported document types with corresponding MIME type mapping
 */
export type DocumentType = 'pdf' | 'docx' | 'xlsx' | 'txt';

/**
 * Document processing states with detailed status tracking
 */
export type ProcessingStatus = 
    | 'pending'    // Initial state after upload
    | 'queued'     // In processing queue
    | 'processing' // Currently being processed
    | 'completed'  // Successfully processed
    | 'failed'     // Processing failed
    | 'cancelled'; // Processing cancelled by user

/**
 * Available document sorting fields
 */
export type DocumentSortField = 
    | 'filename'
    | 'created_at'
    | 'processed_at'
    | 'file_size'
    | 'page_count';

/**
 * Comprehensive interface for document metadata properties
 */
export interface DocumentMetadata {
    page_count: number;
    file_size_bytes: number;
    mime_type: string;
    languages: string[];
    encoding: string;
    has_text_content: boolean;
    requires_ocr: boolean;
    additional_metadata: Record<string, any>;
}

/**
 * Primary document interface with complete metadata and processing information
 */
export interface Document extends BaseEntity {
    client_id: UUID;
    filename: string;
    type: DocumentType;
    status: ProcessingStatus;
    metadata: DocumentMetadata;
    processed_at: Timestamp | null;
    error_message: string | null;
}

/**
 * Interface for document upload request payload with validation constraints
 */
export interface DocumentUploadRequest {
    file: File;
    client_id: UUID;
    type: DocumentType;
    metadata: Record<string, any>;
    tags: string[];
    priority_processing: boolean;
}

/**
 * Interface for document list metadata including filtering and sorting information
 */
export interface DocumentListMetadata {
    type_counts: Record<DocumentType, number>;
    status_counts: Record<ProcessingStatus, number>;
    available_languages: string[];
}

/**
 * Interface for paginated document list response with sorting and filtering metadata
 */
export interface DocumentListResponse extends PaginatedResponse<Document> {
    items: Document[];
    total_count: number;
    page_size: number;
    current_page: number;
    metadata: DocumentListMetadata;
}

/**
 * Type for document API response with error handling
 */
export type DocumentApiResponse = ApiResponse<Document>;

/**
 * Type for document list API response with pagination
 */
export type DocumentListApiResponse = ApiResponse<DocumentListResponse>;

/**
 * Type guard to check if a value is a valid DocumentType
 */
export function isDocumentType(value: string): value is DocumentType {
    return ['pdf', 'docx', 'xlsx', 'txt'].includes(value as DocumentType);
}

/**
 * Type guard to check if a value is a valid ProcessingStatus
 */
export function isProcessingStatus(value: string): value is ProcessingStatus {
    return [
        'pending',
        'queued',
        'processing',
        'completed',
        'failed',
        'cancelled'
    ].includes(value as ProcessingStatus);
}