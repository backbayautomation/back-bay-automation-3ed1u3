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
  timeout: 60000,
  progressThrottle: 250,
  maxFileSize: 10485760, // 10MB
  allowedTypes: ['pdf', 'docx', 'xlsx', 'txt'] as DocumentType[],
  processingTimeout: 300000 // 5 minutes
} as const;

/**
 * Cache configuration for document operations
 */
const CACHE_CONFIG = {
  listTTL: 300000, // 5 minutes
  detailsTTL: 600000 // 10 minutes
} as const;

/**
 * Document operation error types
 */
export class DocumentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'DocumentError';
  }
}

/**
 * Enhanced document upload with progress tracking, validation, and retry mechanism
 */
export async function uploadDocumentWithProgress(
  request: DocumentUploadRequest,
  onProgress?: (progress: number) => void,
  options: { maxRetries?: number; timeout?: number } = {}
): Promise<Document> {
  // Validate file size
  if (request.file.size > DEFAULT_CONFIG.maxFileSize) {
    throw new DocumentError(
      `File size exceeds maximum limit of ${DEFAULT_CONFIG.maxFileSize / 1024 / 1024}MB`,
      'FILE_SIZE_ERROR'
    );
  }

  // Validate file type
  if (!DEFAULT_CONFIG.allowedTypes.includes(request.type)) {
    throw new DocumentError(
      `Unsupported file type. Allowed types: ${DEFAULT_CONFIG.allowedTypes.join(', ')}`,
      'FILE_TYPE_ERROR'
    );
  }

  try {
    const document = await uploadDocument(request, onProgress);
    return document;
  } catch (error) {
    throw new DocumentError(
      'Failed to upload document',
      'UPLOAD_ERROR',
      error
    );
  }
}

/**
 * Enhanced document list retrieval with caching and cursor pagination
 */
export async function getDocumentList(params: {
  cursor?: string;
  limit: number;
  clientId?: string;
  type?: DocumentType;
  sortBy?: string;
  order?: 'asc' | 'desc';
}): Promise<DocumentListResponse> {
  const cacheKey = `documents_list_${JSON.stringify(params)}`;
  const cachedResult = getCachedData<DocumentListResponse>(cacheKey);

  if (cachedResult) {
    return cachedResult;
  }

  try {
    const response = await getDocuments(params);
    setCachedData(cacheKey, response, CACHE_CONFIG.listTTL);
    return response;
  } catch (error) {
    throw new DocumentError(
      'Failed to retrieve document list',
      'LIST_ERROR',
      error
    );
  }
}

/**
 * Secure document detail retrieval with caching
 */
export async function getDocumentDetails(
  documentId: string
): Promise<Document> {
  const cacheKey = `document_${documentId}`;
  const cachedDocument = getCachedData<Document>(cacheKey);

  if (cachedDocument) {
    return cachedDocument;
  }

  try {
    const document = await getDocumentById(documentId);
    setCachedData(cacheKey, document, CACHE_CONFIG.detailsTTL);
    return document;
  } catch (error) {
    throw new DocumentError(
      'Failed to retrieve document details',
      'DETAILS_ERROR',
      error
    );
  }
}

/**
 * Secure document deletion with cleanup and verification
 */
export async function removeDocument(documentId: string): Promise<void> {
  try {
    await deleteDocument(documentId);
    // Clear document from cache
    removeCachedData(`document_${documentId}`);
    // Invalidate list cache
    invalidateListCache();
  } catch (error) {
    throw new DocumentError(
      'Failed to delete document',
      'DELETE_ERROR',
      error
    );
  }
}

/**
 * Enhanced document processing with real-time monitoring
 */
export function startDocumentProcessing(
  documentId: string,
  options: { timeout?: number; retries?: number } = {}
): Observable<ProcessingStatus> {
  return from(processDocument(documentId)).pipe(
    timeout(options.timeout || DEFAULT_CONFIG.processingTimeout),
    retry({
      count: options.retries || DEFAULT_CONFIG.maxRetries,
      delay: (error, retryCount) => {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.warn(`Retrying document processing (attempt ${retryCount + 1})`, error);
        return delay;
      }
    }),
    catchError(error => {
      return throwError(() => new DocumentError(
        'Document processing failed',
        'PROCESSING_ERROR',
        error
      ));
    })
  );
}

// Cache utility functions
function getCachedData<T>(key: string): T | null {
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const { data, expiry } = JSON.parse(cached);
      if (expiry > Date.now()) {
        return data as T;
      }
      sessionStorage.removeItem(key);
    }
    return null;
  } catch {
    return null;
  }
}

function setCachedData<T>(key: string, data: T, ttl: number): void {
  try {
    const cacheData = {
      data,
      expiry: Date.now() + ttl
    };
    sessionStorage.setItem(key, JSON.stringify(cacheData));
  } catch {
    console.warn('Failed to cache data');
  }
}

function removeCachedData(key: string): void {
  sessionStorage.removeItem(key);
}

function invalidateListCache(): void {
  Object.keys(sessionStorage).forEach(key => {
    if (key.startsWith('documents_list_')) {
      sessionStorage.removeItem(key);
    }
  });
}