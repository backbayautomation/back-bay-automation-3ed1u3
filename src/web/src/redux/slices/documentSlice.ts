import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'; // v1.9.5
import {
    Document,
    DocumentType,
    ProcessingStatus,
    DocumentMetadata
} from '../../types/document';
import documentService from '../../services/documents';

/**
 * Interface defining the document slice state structure
 */
interface DocumentState {
    documents: Document[];
    loading: boolean;
    uploading: boolean;
    uploadProgress: number;
    error: string | null;
    processingStatus: Record<string, ProcessingStatus>;
    processingErrors: Record<string, string>;
    totalCount: number;
    currentPage: number;
    pageSize: number;
    documentLoadingStates: Record<string, boolean>;
    documentMetadata: Record<string, DocumentMetadata>;
}

/**
 * Initial state for the document slice
 */
const initialState: DocumentState = {
    documents: [],
    loading: false,
    uploading: false,
    uploadProgress: 0,
    error: null,
    processingStatus: {},
    processingErrors: {},
    totalCount: 0,
    currentPage: 1,
    pageSize: 10,
    documentLoadingStates: {},
    documentMetadata: {}
};

/**
 * Async thunk for uploading a document with progress tracking
 */
export const uploadDocument = createAsyncThunk(
    'documents/upload',
    async ({ 
        file, 
        type, 
        metadata 
    }: { 
        file: File; 
        type: DocumentType; 
        metadata: DocumentMetadata 
    }, { rejectWithValue }) => {
        try {
            const document = await documentService.uploadDocumentWithProgress(
                file,
                type,
                metadata,
                (progress: number) => {
                    // Update upload progress in a throttled manner
                    if (progress % 5 === 0) {
                        return { type: 'documents/setUploadProgress', payload: progress };
                    }
                }
            );
            return document;
        } catch (error) {
            if (error instanceof Error) {
                return rejectWithValue(error.message);
            }
            return rejectWithValue('An unknown error occurred during upload');
        }
    }
);

/**
 * Async thunk for fetching paginated document list
 */
export const fetchDocuments = createAsyncThunk(
    'documents/fetchList',
    async ({ 
        page, 
        pageSize, 
        sortBy, 
        sortOrder 
    }: { 
        page: number; 
        pageSize: number; 
        sortBy?: string; 
        sortOrder?: 'asc' | 'desc' 
    }, { rejectWithValue }) => {
        try {
            const response = await documentService.getDocumentList({
                page,
                limit: pageSize,
                sortBy,
                order: sortOrder
            });
            return response;
        } catch (error) {
            if (error instanceof Error) {
                return rejectWithValue(error.message);
            }
            return rejectWithValue('Failed to fetch documents');
        }
    }
);

/**
 * Async thunk for fetching document details
 */
export const fetchDocumentDetails = createAsyncThunk(
    'documents/fetchDetails',
    async (documentId: string, { rejectWithValue }) => {
        try {
            const document = await documentService.getDocumentDetails(documentId);
            return document;
        } catch (error) {
            if (error instanceof Error) {
                return rejectWithValue(error.message);
            }
            return rejectWithValue('Failed to fetch document details');
        }
    }
);

/**
 * Document slice with reducers and actions
 */
const documentSlice = createSlice({
    name: 'documents',
    initialState,
    reducers: {
        setUploadProgress: (state, action: PayloadAction<number>) => {
            state.uploadProgress = action.payload;
        },
        updateProcessingStatus: (
            state,
            action: PayloadAction<{ documentId: string; status: ProcessingStatus }>
        ) => {
            const { documentId, status } = action.payload;
            state.processingStatus[documentId] = status;
            
            // Clear error if status is no longer failed
            if (status !== 'failed') {
                delete state.processingErrors[documentId];
            }
        },
        setProcessingError: (
            state,
            action: PayloadAction<{ documentId: string; error: string }>
        ) => {
            const { documentId, error } = action.payload;
            state.processingErrors[documentId] = error;
            state.processingStatus[documentId] = 'failed';
        },
        updateDocumentMetadata: (
            state,
            action: PayloadAction<{ documentId: string; metadata: DocumentMetadata }>
        ) => {
            const { documentId, metadata } = action.payload;
            state.documentMetadata[documentId] = metadata;
        },
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        // Upload document reducers
        builder
            .addCase(uploadDocument.pending, (state) => {
                state.uploading = true;
                state.error = null;
                state.uploadProgress = 0;
            })
            .addCase(uploadDocument.fulfilled, (state, action) => {
                state.uploading = false;
                state.documents.unshift(action.payload);
                state.totalCount++;
                state.uploadProgress = 100;
                state.processingStatus[action.payload.id] = 'pending';
            })
            .addCase(uploadDocument.rejected, (state, action) => {
                state.uploading = false;
                state.error = action.payload as string;
                state.uploadProgress = 0;
            })

        // Fetch documents reducers
        builder
            .addCase(fetchDocuments.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchDocuments.fulfilled, (state, action) => {
                state.loading = false;
                state.documents = action.payload.items;
                state.totalCount = action.payload.total_count;
                state.currentPage = action.payload.current_page;
                state.pageSize = action.payload.page_size;
                
                // Update processing status for all documents
                action.payload.items.forEach(doc => {
                    state.processingStatus[doc.id] = doc.status;
                    if (doc.metadata) {
                        state.documentMetadata[doc.id] = doc.metadata;
                    }
                });
            })
            .addCase(fetchDocuments.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })

        // Fetch document details reducers
        builder
            .addCase(fetchDocumentDetails.pending, (state, action) => {
                state.documentLoadingStates[action.meta.arg] = true;
            })
            .addCase(fetchDocumentDetails.fulfilled, (state, action) => {
                state.documentLoadingStates[action.payload.id] = false;
                const index = state.documents.findIndex(doc => doc.id === action.payload.id);
                if (index !== -1) {
                    state.documents[index] = action.payload;
                }
                state.documentMetadata[action.payload.id] = action.payload.metadata;
                state.processingStatus[action.payload.id] = action.payload.status;
            })
            .addCase(fetchDocumentDetails.rejected, (state, action) => {
                state.documentLoadingStates[action.meta.arg] = false;
                state.error = action.payload as string;
            });
    }
});

// Export actions
export const {
    setUploadProgress,
    updateProcessingStatus,
    setProcessingError,
    updateDocumentMetadata,
    clearError
} = documentSlice.actions;

// Export selectors
export const selectDocuments = (state: { documents: DocumentState }) => state.documents.documents;
export const selectDocumentById = (state: { documents: DocumentState }, documentId: string) =>
    state.documents.documents.find(doc => doc.id === documentId);
export const selectProcessingStatus = (state: { documents: DocumentState }, documentId: string) =>
    state.documents.processingStatus[documentId];
export const selectUploadProgress = (state: { documents: DocumentState }) =>
    state.documents.uploadProgress;
export const selectPaginationInfo = (state: { documents: DocumentState }) => ({
    currentPage: state.documents.currentPage,
    pageSize: state.documents.pageSize,
    totalCount: state.documents.totalCount
});
export const selectDocumentMetadata = (state: { documents: DocumentState }, documentId: string) =>
    state.documents.documentMetadata[documentId];

// Export reducer
export default documentSlice.reducer;