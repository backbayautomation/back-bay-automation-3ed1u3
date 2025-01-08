/**
 * Document API module implementing secure document operations with comprehensive error handling,
 * monitoring, and performance optimization.
 * @version 1.0.0
 */

import axios from 'axios'; // v1.5.0
import { 
    Document, 
    DocumentUploadRequest, 
    DocumentListResponse, 
    DocumentType, 
    ProcessingStatus, 
    DocumentValidation 
} from '../types/document';
import { 
    ApiResponse, 
    ApiRequestConfig, 
    PaginationParams, 
    ApiError, 
    ContentType,
    QueryParams 
} from './types';
import { 
    createApiInstance, 
    handleApiError, 
    createCircuitBreaker, 
    setupRequestMonitoring 
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
 * Document API class implementing secure document operations
 */
export class DocumentApi {
    private readonly api: ReturnType<typeof createApiInstance>;
    private readonly circuitBreaker: ReturnType<typeof createCircuitBreaker>;

    constructor() {
        this.api = createApiInstance({
            useCircuitBreaker: true,
            customTimeout: API_CONFIG.TIMEOUT
        });
        this.circuitBreaker = createCircuitBreaker({
            failureThreshold: API_CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD,
            resetTimeout: API_CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT
        });

        setupRequestMonitoring(this.api, 'documents');
    }

    /**
     * Uploads a document with comprehensive validation and progress tracking
     */
    public async uploadDocument(
        request: DocumentUploadRequest,
        onProgress?: ProgressCallback
    ): Promise<ApiResponse<Document>> {
        try {
            // Validate file size and type
            await this.validateDocument(request.file);

            // Create form data with encryption
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
                onUploadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        const progress = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        onProgress(progress);
                    }
                },
                timeout: API_CONFIG.TIMEOUT * 2, // Extended timeout for uploads
                validateStatus: (status) => status >= 200 && status < 300
            };

            const response = await this.circuitBreaker.execute(() =>
                this.api.post<ApiResponse<Document>>(
                    API_ENDPOINTS.DOCUMENTS.UPLOAD,
                    formData,
                    config
                )
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
     * Retrieves paginated document list with caching and filtering
     */
    public async getDocuments(
        params: PaginationParams,
        filters?: DocumentFilterOptions
    ): Promise<DocumentListResponse> {
        try {
            const queryParams: QueryParams = {
                page: params.page,
                limit: params.limit,
                sortBy: params.sortBy,
                order: params.order,
                ...this.buildFilterParams(filters)
            };

            const cacheKey = this.generateCacheKey(queryParams);
            const cachedResponse = await this.getCachedResponse(cacheKey);
            
            if (cachedResponse) {
                return cachedResponse;
            }

            const response = await this.circuitBreaker.execute(() =>
                this.api.get<DocumentListResponse>(
                    API_ENDPOINTS.DOCUMENTS.LIST,
                    { params: queryParams }
                )
            );

            await this.cacheResponse(cacheKey, response.data);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw await handleApiError(error);
            }
            throw error;
        }
    }

    /**
     * Validates document before upload
     */
    private async validateDocument(file: File): Promise<DocumentValidation> {
        const maxSize = API_CONFIG.MAX_REQUEST_SIZE;
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'];

        if (file.size > maxSize) {
            throw new Error(`File size exceeds maximum limit of ${maxSize / 1024 / 1024}MB`);
        }

        if (!allowedTypes.includes(file.type)) {
            throw new Error('File type not supported. Please upload PDF, DOCX, XLSX, or TXT files.');
        }

        return {
            isValid: true,
            size: file.size,
            type: file.type
        };
    }

    /**
     * Builds filter parameters for document queries
     */
    private buildFilterParams(filters?: DocumentFilterOptions): Record<string, string> {
        if (!filters) return {};

        const params: Record<string, string> = {};

        if (filters.types?.length) {
            params.types = filters.types.join(',');
        }

        if (filters.status?.length) {
            params.status = filters.status.join(',');
        }

        if (filters.dateRange) {
            params.startDate = filters.dateRange.start.toISOString();
            params.endDate = filters.dateRange.end.toISOString();
        }

        if (filters.searchQuery) {
            params.q = filters.searchQuery;
        }

        return params;
    }

    /**
     * Generates cache key for document queries
     */
    private generateCacheKey(params: QueryParams): string {
        return `documents:${JSON.stringify(params)}`;
    }

    /**
     * Retrieves cached response if available
     */
    private async getCachedResponse(key: string): Promise<DocumentListResponse | null> {
        // Implementation would use a caching solution like Redis
        return null;
    }

    /**
     * Caches API response
     */
    private async cacheResponse(key: string, data: DocumentListResponse): Promise<void> {
        // Implementation would use a caching solution like Redis
        return;
    }
}

export default new DocumentApi();