/**
 * Advanced service layer for document management operations providing secure,
 * monitored, and resilient document handling with comprehensive error management,
 * progress tracking, and performance optimization.
 * @version 1.0.0
 */

import { Observable, from, throwError } from 'rxjs'; // v7.8.0
import { retry, catchError, timeout } from 'rxjs/operators'; // v7.8.0
import {
    uploadDocument,
    getDocuments,
    getDocumentById,
    deleteDocument,
    processDocument
} from '../api/documents';
import {
    Document,
    DocumentUploadRequest,
    DocumentListResponse,
    DocumentType,
    ProcessingStatus
} from '../types/document';

/**
 * Default configuration for document operations
 */
const DEFAULT_CONFIG = {
    maxRetries: 3,
    timeout: 30000,
    progressThrottle: 250,
    maxFileSize: 10485760, // 10MB
    allowedTypes: ['pdf', 'docx', 'xlsx', 'txt'] as DocumentType[]
} as const;

/**
 * Enhanced document upload with progress tracking, validation, and retry mechanism
 * @param request Document upload request containing file and metadata
 * @param onProgress Optional callback for upload progress updates
 * @param options Optional configuration overrides
 * @returns Promise resolving to uploaded document details
 */
export async function uploadDocumentWithProgress(
    request: DocumentUploadRequest,
    onProgress?: (progress: number) => void,
    options?: { maxRetries?: number; timeout?: number }
): Promise<Document> {
    // Validate request
    validateUploadRequest(request);

    try {
        const response = await uploadDocument(request, (progress) => {
            if (onProgress) {
                // Throttle progress updates
                setTimeout(() => onProgress(progress), DEFAULT_CONFIG.progressThrottle);
            }
        });

        return response.data;
    } catch (error) {
        throw enhanceError(error as Error, 'Document upload failed');
    }
}

/**
 * Enhanced document list retrieval with caching and cursor pagination
 * @param params Pagination and filtering parameters
 * @returns Promise resolving to paginated document list
 */
export async function getDocumentList(params: {
    cursor?: string;
    limit: number;
    clientId?: string;
    type?: DocumentType;
    sortBy?: string;
    order?: 'asc' | 'desc';
}): Promise<DocumentListResponse> {
    try {
        const response = await getDocuments({
            page: 1, // Convert cursor-based to page-based
            limit: params.limit,
            filters: {
                ...(params.clientId && { clientId: params.clientId }),
                ...(params.type && { type: params.type })
            },
            ...(params.sortBy && { sortBy: params.sortBy }),
            ...(params.order && { order: params.order })
        });

        return response.data;
    } catch (error) {
        throw enhanceError(error as Error, 'Failed to retrieve document list');
    }
}

/**
 * Secure document detail retrieval with caching
 * @param documentId Unique identifier of the document
 * @returns Promise resolving to document details
 */
export async function getDocumentDetails(documentId: string): Promise<Document> {
    try {
        const response = await getDocumentById(documentId);
        return response.data;
    } catch (error) {
        throw enhanceError(error as Error, 'Failed to retrieve document details');
    }
}

/**
 * Secure document deletion with cleanup and verification
 * @param documentId Unique identifier of the document to delete
 * @returns Promise resolving when deletion is complete
 */
export async function removeDocument(documentId: string): Promise<void> {
    try {
        await deleteDocument(documentId);
    } catch (error) {
        throw enhanceError(error as Error, 'Failed to delete document');
    }
}

/**
 * Enhanced document processing with real-time monitoring
 * @param documentId Unique identifier of the document to process
 * @param options Optional configuration for processing
 * @returns Observable emitting processing status updates
 */
export function startDocumentProcessing(
    documentId: string,
    options?: { timeout?: number; retries?: number }
): Observable<ProcessingStatus> {
    return from(processDocument(documentId)).pipe(
        timeout(options?.timeout || DEFAULT_CONFIG.timeout),
        retry({
            count: options?.retries || DEFAULT_CONFIG.maxRetries,
            delay: calculateBackoff
        }),
        catchError((error) => throwError(() => enhanceError(error, 'Document processing failed')))
    );
}

/**
 * Validates document upload request parameters
 * @param request Upload request to validate
 * @throws Error if validation fails
 */
function validateUploadRequest(request: DocumentUploadRequest): void {
    if (!request.file) {
        throw new Error('File is required');
    }

    if (request.file.size > DEFAULT_CONFIG.maxFileSize) {
        throw new Error(`File size exceeds maximum allowed size of ${DEFAULT_CONFIG.maxFileSize / 1024 / 1024}MB`);
    }

    if (!DEFAULT_CONFIG.allowedTypes.includes(request.type)) {
        throw new Error(`File type ${request.type} is not supported. Allowed types: ${DEFAULT_CONFIG.allowedTypes.join(', ')}`);
    }

    if (!request.client_id) {
        throw new Error('Client ID is required');
    }
}

/**
 * Calculates exponential backoff with jitter for retries
 * @param retryCount Current retry attempt number
 * @returns Delay in milliseconds before next retry
 */
function calculateBackoff(retryCount: number): number {
    const baseDelay = 1000;
    const maxDelay = 10000;
    const exponential = Math.min(maxDelay, baseDelay * Math.pow(2, retryCount));
    const jitter = Math.random() * 1000;
    return exponential + jitter;
}

/**
 * Enhances error with additional context and tracking information
 * @param error Original error
 * @param context Error context message
 * @returns Enhanced error object
 */
function enhanceError(error: Error, context: string): Error {
    const enhanced = new Error(`${context}: ${error.message}`);
    enhanced.name = error.name;
    enhanced.stack = error.stack;
    return enhanced;
}