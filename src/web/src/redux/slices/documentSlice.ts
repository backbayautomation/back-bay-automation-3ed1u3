import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'; // v1.9.5
import { 
    Document, 
    DocumentType, 
    ProcessingStatus, 
    DocumentMetadata 
} from '../../types/document';
import documentService from '../../services/documents';

/**
 * Interface for document slice state management
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
 * Initial state for document slice
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
            const response = await documentService.uploadDocumentWithProgress(
                file,
                (progress: number) => {
                    // Update progress in a throttled manner
                    setTimeout(() => {
                        store.dispatch(documentSlice.actions.setUploadProgress(progress));
                    }, 100);
                }
            );
            return response;
        } catch (error) {
            return rejectWithValue((error as Error).message);
        }
    }
);

/**
 * Async thunk for fetching paginated document list
 */
export const fetchDocuments = createAsyncThunk(
    'documents/fetchList',
    async (params: { 
        page: number; 
        pageSize: number; 
        sortBy?: string; 
        sortOrder?: 'asc' | 'desc' 
    }, { rejectWithValue }) => {
        try {
            const response = await documentService.getDocumentList(params);
            return response;
        } catch (error) {
            return rejectWithValue((error as Error).message);
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
            const response = await documentService.getDocumentDetails(documentId);
            return response;
        } catch (error) {
            return rejectWithValue((error as Error).message);
        }
    }
);

/**
 * Async thunk for removing a document
 */
export const removeDocument = createAsyncThunk(
    'documents/remove',
    async (documentId: string, { rejectWithValue }) => {
        try {
            await documentService.removeDocument(documentId);
            return documentId;
        } catch (error) {
            return rejectWithValue((error as Error).message);
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
        updateProcessingStatus: (state, action: PayloadAction<{ 
            documentId: string; 
            status: ProcessingStatus;
            error?: string;
        }>) => {
            const { documentId, status, error } = action.payload;
            state.processingStatus[documentId] = status;
            if (error) {
                state.processingErrors[documentId] = error;
            } else {
                delete state.processingErrors[documentId];
            }
        },
        clearError: (state) => {
            state.error = null;
        },
        resetUploadState: (state) => {
            state.uploading = false;
            state.uploadProgress = 0;
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        // Upload document reducers
        builder
            .addCase(uploadDocument.pending, (state) => {
                state.uploading = true;
                state.error = null;
            })
            .addCase(uploadDocument.fulfilled, (state, action) => {
                state.uploading = false;
                state.documents.unshift(action.payload);
                state.totalCount++;
                state.processingStatus[action.payload.id] = 'pending';
                state.documentMetadata[action.payload.id] = action.payload.metadata;
            })
            .addCase(uploadDocument.rejected, (state, action) => {
                state.uploading = false;
                state.error = action.payload as string;
            });

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
                
                // Update processing status and metadata
                action.payload.items.forEach(doc => {
                    state.processingStatus[doc.id] = doc.status;
                    state.documentMetadata[doc.id] = doc.metadata;
                });
            })
            .addCase(fetchDocuments.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });

        // Fetch document details reducers
        builder
            .addCase(fetchDocumentDetails.pending, (state, action) => {
                state.documentLoadingStates[action.meta.arg] = true;
            })
            .addCase(fetchDocumentDetails.fulfilled, (state, action) => {
                state.documentLoadingStates[action.payload.id] = false;
                state.documentMetadata[action.payload.id] = action.payload.metadata;
                
                // Update document in list if exists
                const index = state.documents.findIndex(doc => doc.id === action.payload.id);
                if (index !== -1) {
                    state.documents[index] = action.payload;
                }
            })
            .addCase(fetchDocumentDetails.rejected, (state, action) => {
                state.documentLoadingStates[action.meta.arg] = false;
                state.error = action.payload as string;
            });

        // Remove document reducers
        builder
            .addCase(removeDocument.fulfilled, (state, action) => {
                state.documents = state.documents.filter(doc => doc.id !== action.payload);
                state.totalCount--;
                delete state.processingStatus[action.payload];
                delete state.processingErrors[action.payload];
                delete state.documentMetadata[action.payload];
            })
            .addCase(removeDocument.rejected, (state, action) => {
                state.error = action.payload as string;
            });
    }
});

// Export actions
export const { 
    setUploadProgress, 
    updateProcessingStatus, 
    clearError, 
    resetUploadState 
} = documentSlice.actions;

// Export selectors
export const selectDocuments = (state: { documents: DocumentState }) => state.documents.documents;
export const selectDocumentById = (state: { documents: DocumentState }, id: string) => 
    state.documents.documents.find(doc => doc.id === id);
export const selectProcessingStatus = (state: { documents: DocumentState }, id: string) => 
    state.documents.processingStatus[id];
export const selectUploadProgress = (state: { documents: DocumentState }) => 
    state.documents.uploadProgress;
export const selectPaginationInfo = (state: { documents: DocumentState }) => ({
    currentPage: state.documents.currentPage,
    pageSize: state.documents.pageSize,
    totalCount: state.documents.totalCount
});

// Export reducer
export default documentSlice.reducer;