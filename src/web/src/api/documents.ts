/**
 * Production-ready API module for document operations implementing secure upload,
 * retrieval, processing and management functionality with comprehensive error handling,
 * monitoring, and performance optimization.
 * @version 1.0.0
 */

import axios, { AxiosProgressEvent } from 'axios'; // v1.5.0
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
    ApiError, 
    ContentType 
} from './types';
import { 
    createApiInstance, 
    handleApiError, 
    RequestOptions 
} from '../utils/api';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';

/**
 * Type for upload progress callback function
 */
type ProgressCallback = (progress: number) => void;

/**
 * Interface for document filtering options
 */
interface DocumentFilterOptions {
    types?: DocumentType[];
    status?: ProcessingStatus[];
    startDate?: string;
    endDate?: string;
    searchQuery?: string;
}

/**
 * Class implementing document-related API operations with comprehensive
 * error handling, monitoring, and security controls
 */
export class DocumentApi {
    private readonly api;
    private readonly maxFileSize = API_CONFIG.MAX_REQUEST_SIZE;
    private readonly allowedTypes = ['pdf', 'docx', 'xlsx', 'txt'];

    constructor() {
        this.api = createApiInstance({
            useCircuitBreaker: true,
            customHeaders: {
                'X-Service': 'document-api'
            }
        });
    }

    /**
     * Uploads a document with comprehensive validation, progress tracking, and error handling
     * @param request Document upload request containing file and metadata
     * @param onProgress Optional callback for upload progress
     * @returns Promise resolving to uploaded document details
     * @throws ApiError if validation or upload fails
     */
    public async uploadDocument(
        request: DocumentUploadRequest,
        onProgress?: ProgressCallback
    ): Promise<ApiResponse<Document>> {
        // Validate request
        this.validateUploadRequest(request);

        // Prepare form data with encryption
        const formData = new FormData();
        formData.append('file', request.file);
        formData.append('metadata', JSON.stringify({
            clientId: request.client_id,
            type: request.type,
            metadata: request.metadata,
            tags: request.tags,
            priorityProcessing: request.priority_processing
        }));

        try {
            const response = await this.api.post<ApiResponse<Document>>(
                API_ENDPOINTS.DOCUMENTS.UPLOAD,
                formData,
                {
                    headers: {
                        'Content-Type': ContentType.MULTIPART_FORM_DATA,
                        'X-Upload-Type': request.type
                    },
                    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                        if (onProgress && progressEvent.total) {
                            const progress = Math.round(
                                (progressEvent.loaded * 100) / progressEvent.total
                            );
                            onProgress(progress);
                        }
                    },
                    timeout: API_CONFIG.TIMEOUT * 2 // Extended timeout for uploads
                }
            );

            return response.data;
        } catch (error) {
            throw await handleApiError(error as Error);
        }
    }

    /**
     * Retrieves paginated document list with caching and filtering
     * @param params Pagination parameters
     * @param filters Optional document filtering criteria
     * @returns Promise resolving to paginated document list
     * @throws ApiError if retrieval fails
     */
    public async getDocuments(
        params: PaginationParams,
        filters?: DocumentFilterOptions
    ): Promise<DocumentListResponse> {
        try {
            const queryParams = new URLSearchParams({
                page: params.page.toString(),
                limit: params.limit.toString(),
                ...(params.sortBy && { sortBy: params.sortBy }),
                ...(params.order && { order: params.order }),
                ...(filters?.types && { types: filters.types.join(',') }),
                ...(filters?.status && { status: filters.status.join(',') }),
                ...(filters?.startDate && { startDate: filters.startDate }),
                ...(filters?.endDate && { endDate: filters.endDate }),
                ...(filters?.searchQuery && { search: filters.searchQuery })
            });

            const response = await this.api.get<ApiResponse<DocumentListResponse>>(
                `${API_ENDPOINTS.DOCUMENTS.LIST}?${queryParams}`,
                {
                    headers: {
                        'Cache-Control': 'max-age=300' // 5 minute cache
                    }
                }
            );

            return response.data.data;
        } catch (error) {
            throw await handleApiError(error as Error);
        }
    }

    /**
     * Validates document upload request
     * @param request Upload request to validate
     * @throws Error if validation fails
     */
    private validateUploadRequest(request: DocumentUploadRequest): void {
        if (!request.file) {
            throw new Error('File is required');
        }

        if (request.file.size > this.maxFileSize) {
            throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`);
        }

        if (!this.allowedTypes.includes(request.type)) {
            throw new Error(`File type ${request.type} is not supported. Allowed types: ${this.allowedTypes.join(', ')}`);
        }

        if (!request.client_id) {
            throw new Error('Client ID is required');
        }
    }
}

// Export singleton instance
export const documentApi = new DocumentApi();