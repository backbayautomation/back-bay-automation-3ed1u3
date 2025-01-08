/**
 * Production-ready API module for document operations with comprehensive security,
 * monitoring, and error handling capabilities.
 * @version 1.0.0
 */

import axios from 'axios'; // v1.5.0
import { 
    Document, 
    DocumentUploadRequest, 
    DocumentListResponse, 
    DocumentType, 
    ProcessingStatus 
} from '../types/document';
import { 
    ApiResponse, 
    ApiRequestConfig, 
    PaginationParams, 
    ContentType 
} from './types';
import { 
    createApiInstance, 
    handleApiError, 
    RequestOptions 
} from '../utils/api';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';

/**
 * Progress callback type for upload tracking
 */
type ProgressCallback = (progress: number) => void;

/**
 * Document filtering options
 */
interface DocumentFilterOptions {
    types?: DocumentType[];
    status?: ProcessingStatus[];
    dateRange?: {
        start: Date;
        end: Date;
    };
    searchQuery?: string;
}

/**
 * Document API class with comprehensive error handling and monitoring
 */
export class DocumentApi {
    private readonly api: ReturnType<typeof createApiInstance>;
    private readonly maxRetries: number = 3;
    private readonly maxFileSize: number = API_CONFIG.MAX_REQUEST_SIZE;
    private readonly allowedTypes: string[] = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ];

    constructor(options: RequestOptions = {}) {
        this.api = createApiInstance({
            ...options,
            useCircuitBreaker: true,
            customHeaders: {
                'X-API-Version': '1.0'
            }
        });
    }

    /**
     * Uploads a document with comprehensive validation and progress tracking
     */
    public async uploadDocument(
        request: DocumentUploadRequest,
        onProgress?: ProgressCallback
    ): Promise<ApiResponse<Document>> {
        try {
            // Validate file size
            if (request.file.size > this.maxFileSize) {
                throw new Error(`File size exceeds maximum limit of ${this.maxFileSize / 1024 / 1024}MB`);
            }

            // Validate file type
            if (!this.allowedTypes.includes(request.file.type)) {
                throw new Error('Unsupported file type');
            }

            // Create form data with metadata
            const formData = new FormData();
            formData.append('file', request.file);
            formData.append('clientId', request.client_id);
            formData.append('type', request.type);
            formData.append('metadata', JSON.stringify(request.metadata));
            formData.append('tags', JSON.stringify(request.tags));
            formData.append('priorityProcessing', String(request.priority_processing));

            const config: ApiRequestConfig = {
                headers: {
                    'Content-Type': ContentType.MULTIPART_FORM_DATA,
                },
                timeout: 60000, // Extended timeout for large files
                onUploadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress(progress);
                    }
                },
                requiresAuth: true,
                skipErrorHandler: false,
                validateStatus: (status) => status === 201
            };

            const response = await this.api.post<ApiResponse<Document>>(
                API_ENDPOINTS.DOCUMENTS.UPLOAD,
                formData,
                config
            );

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw await handleApiError(error);
            }
            throw error;
        }
    }

    /**
     * Retrieves paginated document list with filtering and caching
     */
    public async getDocuments(
        params: PaginationParams,
        filters?: DocumentFilterOptions
    ): Promise<DocumentListResponse> {
        try {
            const queryParams = new URLSearchParams();

            // Add pagination parameters
            queryParams.append('page', params.page.toString());
            queryParams.append('limit', params.limit.toString());
            if (params.sortBy) {
                queryParams.append('sortBy', params.sortBy);
                queryParams.append('order', params.order || 'DESC');
            }

            // Add filter parameters
            if (filters) {
                if (filters.types?.length) {
                    queryParams.append('types', filters.types.join(','));
                }
                if (filters.status?.length) {
                    queryParams.append('status', filters.status.join(','));
                }
                if (filters.dateRange) {
                    queryParams.append('startDate', filters.dateRange.start.toISOString());
                    queryParams.append('endDate', filters.dateRange.end.toISOString());
                }
                if (filters.searchQuery) {
                    queryParams.append('search', filters.searchQuery);
                }
            }

            const config: ApiRequestConfig = {
                params: queryParams,
                headers: {
                    'Cache-Control': 'max-age=300' // 5 minute cache
                },
                requiresAuth: true,
                skipErrorHandler: false
            };

            const response = await this.api.get<DocumentListResponse>(
                API_ENDPOINTS.DOCUMENTS.LIST,
                config
            );

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw await handleApiError(error);
            }
            throw error;
        }
    }

    /**
     * Deletes a document by ID with validation
     */
    public async deleteDocument(documentId: string): Promise<ApiResponse<void>> {
        try {
            const response = await this.api.delete<ApiResponse<void>>(
                API_ENDPOINTS.DOCUMENTS.DELETE.replace('{id}', documentId),
                {
                    requiresAuth: true,
                    validateStatus: (status) => status === 204
                }
            );

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw await handleApiError(error);
            }
            throw error;
        }
    }

    /**
     * Retrieves document processing status
     */
    public async getProcessingStatus(documentId: string): Promise<ApiResponse<ProcessingStatus>> {
        try {
            const response = await this.api.get<ApiResponse<ProcessingStatus>>(
                API_ENDPOINTS.DOCUMENTS.PROCESS.replace('{id}', documentId),
                {
                    requiresAuth: true,
                    skipErrorHandler: false
                }
            );

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw await handleApiError(error);
            }
            throw error;
        }
    }
}

// Export singleton instance
export const documentApi = new DocumentApi();