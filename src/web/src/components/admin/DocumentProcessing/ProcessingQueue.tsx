import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Tooltip,
  Alert,
  useTheme
} from '@mui/material'; // v5.14.0
import {
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Replay as RetryIcon,
  Error as ErrorIcon
} from '@mui/icons-material'; // v5.14.0
import { format } from 'date-fns'; // v2.30.0

import { DataTable } from '../../common/Tables/DataTable';
import { Document, ProcessingStatus } from '../../../types/document';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { documentService } from '../../../services/documents';

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

const INITIAL_STATE: QueueState = {
  documents: [],
  loading: true,
  error: null,
  total: 0,
  page: 1,
  pageSize: 10,
  progressMap: new Map()
};

const ProcessingQueue: React.FC<ProcessingQueueProps> = ({
  refreshInterval = 30000,
  autoRefresh = true,
  onProcessingComplete,
  onError
}) => {
  const theme = useTheme();
  const [state, setState] = useState<QueueState>(INITIAL_STATE);
  const [retryCount] = useState<Map<string, number>>(new Map());

  // WebSocket setup for real-time updates
  const { isConnected, addListener, removeListener } = useWebSocket({
    baseUrl: `${process.env.VITE_WS_URL}/documents`,
    autoConnect: true,
    monitoringEnabled: true
  });

  // Fetch documents with cursor-based pagination
  const fetchDocuments = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await documentService.getDocumentList({
        page: state.page,
        pageSize: state.pageSize,
        sortBy: 'created_at',
        order: 'desc',
        filters: {
          status: ['pending', 'queued', 'processing'].join(',')
        }
      });

      setState(prev => ({
        ...prev,
        documents: response.items,
        total: response.total,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch documents'
      }));
      onError?.(error as Error);
    }
  }, [state.page, state.pageSize, onError]);

  // Handle WebSocket document updates
  const handleDocumentUpdate = useCallback((update: { 
    documentId: string; 
    status: ProcessingStatus; 
    progress: number;
    error?: string 
  }) => {
    setState(prev => {
      const updatedDocs = prev.documents.map(doc => {
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

      const updatedProgress = new Map(prev.progressMap);
      updatedProgress.set(update.documentId, update.progress);

      return {
        ...prev,
        documents: updatedDocs,
        progressMap: updatedProgress
      };
    });
  }, [onProcessingComplete]);

  // Handle retry processing
  const handleRetry = useCallback(async (documentId: string) => {
    try {
      setState(prev => ({ ...prev, error: null }));
      await documentService.retryProcessing(documentId);
      
      const currentRetries = retryCount.get(documentId) || 0;
      retryCount.set(documentId, currentRetries + 1);
      
      fetchDocuments();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [fetchDocuments, onError, retryCount]);

  // Handle cancel processing
  const handleCancel = useCallback(async (documentId: string) => {
    try {
      setState(prev => ({ ...prev, error: null }));
      await documentService.cancelProcessing(documentId);
      fetchDocuments();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [fetchDocuments, onError]);

  // Table columns configuration
  const columns = useMemo(() => [
    {
      id: 'filename',
      label: 'Document',
      sortable: true,
      render: (doc: Document) => (
        <Typography variant="body2" noWrap>
          {doc.filename}
        </Typography>
      )
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      render: (doc: Document) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {doc.status === 'processing' && (
            <LinearProgress
              variant="determinate"
              value={state.progressMap.get(doc.id) || 0}
              sx={{ width: 100 }}
            />
          )}
          <Typography variant="body2" color={
            doc.status === 'failed' ? 'error' : 'textPrimary'
          }>
            {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
          </Typography>
        </Box>
      )
    },
    {
      id: 'created_at',
      label: 'Created',
      sortable: true,
      render: (doc: Document) => (
        <Typography variant="body2">
          {format(new Date(doc.createdAt), 'MMM dd, yyyy HH:mm')}
        </Typography>
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (doc: Document) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {doc.status === 'failed' && (
            <Tooltip title="Retry Processing">
              <IconButton
                size="small"
                onClick={() => handleRetry(doc.id)}
                disabled={retryCount.get(doc.id) >= 3}
              >
                <RetryIcon />
              </IconButton>
            </Tooltip>
          )}
          {doc.status === 'processing' && (
            <Tooltip title="Cancel Processing">
              <IconButton
                size="small"
                onClick={() => handleCancel(doc.id)}
              >
                <CancelIcon />
              </IconButton>
            </Tooltip>
          )}
          {doc.error_message && (
            <Tooltip title={doc.error_message}>
              <ErrorIcon color="error" />
            </Tooltip>
          )}
        </Box>
      )
    }
  ], [state.progressMap, handleRetry, handleCancel, retryCount]);

  // Set up auto-refresh and WebSocket listeners
  useEffect(() => {
    fetchDocuments();

    if (autoRefresh) {
      const interval = setInterval(fetchDocuments, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchDocuments, autoRefresh, refreshInterval]);

  useEffect(() => {
    addListener('document.processing', handleDocumentUpdate);
    return () => removeListener('document.processing', handleDocumentUpdate);
  }, [addListener, removeListener, handleDocumentUpdate]);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 2 
      }}>
        <Typography variant="h6">Processing Queue</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {!isConnected && (
            <Alert severity="warning" sx={{ py: 0 }}>
              Real-time updates disconnected
            </Alert>
          )}
          <Tooltip title="Refresh Queue">
            <IconButton onClick={fetchDocuments} disabled={state.loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <DataTable
        data={state.documents}
        columns={columns}
        loading={state.loading}
        page={state.page}
        pageSize={state.pageSize}
        total={state.total}
        onPageChange={({ page, pageSize }) => {
          setState(prev => ({ ...prev, page, pageSize }));
        }}
        emptyMessage="No documents in processing queue"
        enableVirtualization
        virtualRowHeight={52}
        ariaLabel="Document processing queue"
      />

      {state.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {state.error}
        </Alert>
      )}
    </Box>
  );
};

export default ProcessingQueue;