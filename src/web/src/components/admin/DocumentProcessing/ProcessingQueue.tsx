import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  useTheme,
} from '@mui/material'; // v5.14.0
import {
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Replay as RetryIcon,
  Error as ErrorIcon,
} from '@mui/icons-material'; // v5.14.0
import { format } from 'date-fns'; // v2.30.0

import DataTable from '../../common/Tables/DataTable';
import { Document, ProcessingStatus } from '../../../types/document';
import { useWebSocket } from '../../../hooks/useWebSocket';
import documentService from '../../../services/documents';

interface ProcessingQueueProps {
  refreshInterval?: number;
  autoRefresh?: boolean;
  onProcessingComplete?: (document: Document) => void;
  onError?: (error: Error) => void;
}

interface QueueState {
  documents: Document[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  progressMap: Map<string, number>;
}

const ProcessingQueue: React.FC<ProcessingQueueProps> = ({
  refreshInterval = 30000,
  autoRefresh = true,
  onProcessingComplete,
  onError,
}) => {
  const theme = useTheme();
  const [state, setState] = useState<QueueState>({
    documents: [],
    loading: true,
    error: null,
    total: 0,
    page: 1,
    pageSize: 10,
    progressMap: new Map(),
  });

  // WebSocket connection for real-time updates
  const { addListener, removeListener } = useWebSocket({
    baseUrl: `${process.env.VITE_WS_URL}/documents`,
    autoConnect: true,
    monitoringEnabled: true,
  });

  // Fetch documents with pagination and error handling
  const fetchDocuments = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await documentService.getDocumentList({
        page: state.page,
        pageSize: state.pageSize,
        sortBy: 'created_at',
        order: 'desc',
        filters: {
          status: ['pending', 'queued', 'processing'],
        },
      });

      setState(prev => ({
        ...prev,
        documents: response.items,
        total: response.total,
        loading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch documents';
      setState(prev => ({ ...prev, error: errorMessage, loading: false }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [state.page, state.pageSize, onError]);

  // Handle document processing updates via WebSocket
  const handleProcessingUpdate = useCallback((update: { 
    documentId: string; 
    status: ProcessingStatus; 
    progress: number;
    error?: string;
  }) => {
    setState(prev => {
      const newDocs = prev.documents.map(doc => {
        if (doc.id === update.documentId) {
          const updatedDoc = { 
            ...doc, 
            status: update.status,
            error_message: update.error
          };
          
          if (update.status === 'completed') {
            onProcessingComplete?.(updatedDoc);
          }
          
          return updatedDoc;
        }
        return doc;
      });

      const newProgressMap = new Map(prev.progressMap);
      if (update.progress) {
        newProgressMap.set(update.documentId, update.progress);
      }

      return {
        ...prev,
        documents: newDocs,
        progressMap: newProgressMap,
      };
    });
  }, [onProcessingComplete]);

  // Set up WebSocket listeners and auto-refresh
  useEffect(() => {
    addListener('document.processing', handleProcessingUpdate);

    let refreshTimer: NodeJS.Timeout;
    if (autoRefresh) {
      refreshTimer = setInterval(fetchDocuments, refreshInterval);
    }

    return () => {
      removeListener('document.processing', handleProcessingUpdate);
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [addListener, removeListener, handleProcessingUpdate, fetchDocuments, autoRefresh, refreshInterval]);

  // Initial data fetch
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle retry action
  const handleRetry = useCallback(async (documentId: string) => {
    try {
      await documentService.startDocumentProcessing(documentId);
      fetchDocuments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry processing';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [fetchDocuments, onError]);

  // Handle cancel action
  const handleCancel = useCallback(async (documentId: string) => {
    try {
      await documentService.cancelProcessing(documentId);
      fetchDocuments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel processing';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [fetchDocuments, onError]);

  // Table columns configuration
  const columns = useMemo(() => [
    {
      id: 'filename',
      label: 'Document',
      render: (doc: Document) => (
        <Typography variant="body2" component="div">
          {doc.filename}
          {doc.error_message && (
            <Tooltip title={doc.error_message}>
              <ErrorIcon
                sx={{
                  color: theme.palette.error.main,
                  marginLeft: 1,
                  fontSize: 16,
                }}
              />
            </Tooltip>
          )}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (doc: Document) => (
        <Box sx={{ minWidth: 200 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
          </Typography>
          {(doc.status === 'processing' || doc.status === 'queued') && (
            <LinearProgress
              variant="determinate"
              value={state.progressMap.get(doc.id) || 0}
              sx={{ height: 4, borderRadius: 2 }}
            />
          )}
        </Box>
      ),
    },
    {
      id: 'created_at',
      label: 'Created',
      render: (doc: Document) => (
        <Typography variant="body2">
          {format(new Date(doc.createdAt), 'MMM dd, yyyy HH:mm')}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (doc: Document) => (
        <Box>
          {doc.status === 'failed' && (
            <Tooltip title="Retry Processing">
              <IconButton
                size="small"
                onClick={() => handleRetry(doc.id)}
                aria-label="retry processing"
              >
                <RetryIcon />
              </IconButton>
            </Tooltip>
          )}
          {(doc.status === 'processing' || doc.status === 'queued') && (
            <Tooltip title="Cancel Processing">
              <IconButton
                size="small"
                onClick={() => handleCancel(doc.id)}
                aria-label="cancel processing"
              >
                <CancelIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ], [theme, state.progressMap, handleRetry, handleCancel]);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" component="h2">
          Processing Queue
        </Typography>
        <Tooltip title="Refresh Queue">
          <IconButton
            onClick={fetchDocuments}
            disabled={state.loading}
            aria-label="refresh queue"
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {state.error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setState(prev => ({ ...prev, error: null }))}
        >
          {state.error}
        </Alert>
      )}

      <DataTable
        data={state.documents}
        columns={columns}
        page={state.page}
        pageSize={state.pageSize}
        total={state.total}
        loading={state.loading}
        onPageChange={({ page, pageSize }) => {
          setState(prev => ({ ...prev, page, pageSize }));
        }}
        enableVirtualization
        emptyMessage="No documents in processing queue"
        ariaLabel="Document processing queue"
      />
    </Box>
  );
};

export default ProcessingQueue;