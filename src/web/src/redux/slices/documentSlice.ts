/**
 * Redux slice for document state management with comprehensive document handling,
 * real-time processing status tracking, and robust error management.
 * @version 1.0.0
 */

import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'; // v1.9.5
import {
  Document,
  DocumentType,
  ProcessingStatus,
  DocumentMetadata
} from '../../types/document';
import documentService from '../../services/documents';

/**
 * Interface for document slice state
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
 * Async thunk for document upload with progress tracking
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
          // Progress callback handled in pending action
        }
      );
      return document;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Upload failed');
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
        pageSize,
        sortBy,
        sortOrder
      });
      return response;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Fetch failed');
    }
  }
);

/**
 * Document slice with comprehensive state management
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
    setDocumentMetadata: (state, action: PayloadAction<{
      documentId: string;
      metadata: DocumentMetadata;
    }>) => {
      const { documentId, metadata } = action.payload;
      state.documentMetadata[documentId] = metadata;
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
        
        // Update processing status and metadata for all documents
        action.payload.items.forEach(doc => {
          state.processingStatus[doc.id] = doc.status;
          state.documentMetadata[doc.id] = doc.metadata;
        });
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

// Export actions
export const {
  setUploadProgress,
  updateProcessingStatus,
  setDocumentMetadata,
  clearError,
  resetUploadState
} = documentSlice.actions;

// Export selectors
export const selectDocuments = (state: { documents: DocumentState }) => state.documents.documents;
export const selectDocumentById = (state: { documents: DocumentState }, id: string) => 
  state.documents.documents.find(doc => doc.id === id);
export const selectProcessingStatus = (state: { documents: DocumentState }, id: string) => 
  state.documents.processingStatus[id];
export const selectDocumentMetadata = (state: { documents: DocumentState }, id: string) => 
  state.documents.documentMetadata[id];
export const selectPaginationInfo = (state: { documents: DocumentState }) => ({
  currentPage: state.documents.currentPage,
  pageSize: state.documents.pageSize,
  totalCount: state.documents.totalCount
});
export const selectUploadState = (state: { documents: DocumentState }) => ({
  uploading: state.documents.uploading,
  progress: state.documents.uploadProgress,
  error: state.documents.error
});

// Export reducer
export default documentSlice.reducer;