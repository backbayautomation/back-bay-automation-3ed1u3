import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  LinearProgress,
  IconButton,
  Tooltip,
  Typography,
  Alert,
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

// Enhanced props interface with accessibility and monitoring support
interface ProcessingQueueProps {
  refreshInterval?: number;
  autoRefresh?: boolean;
  onProcessingComplete?: (document: Document) => void;
  onError?: (error: Error) => void;
  ariaLabel?: string;
}

// Enhanced queue state interface with WebSocket support
interface QueueState {
  documents: Document[];
  loading: boolean;
  error: string | null;
  cursor: string | null;
  pageSize: number;
  progressMap: Map<string, number>;
  totalCount: number;
  currentPage: number;
}

const ProcessingQueue: React.FC<ProcessingQueueProps> = ({
  refreshInterval = 30000,
  autoRefresh = true,
  onProcessingComplete,
  onError,
  ariaLabel = 'Document processing queue'
}) => {
  // Enhanced state management with WebSocket integration
  const [state, setState] = useState<QueueState>({
    documents: [],
    loading: true,
    error: null,
    cursor: null,
    pageSize: 10,
    progressMap: new Map(),
    totalCount: 0,
    currentPage: 1
  });

  // WebSocket connection for real-time updates
  const { isConnected, addListener, removeListener } = useWebSocket({
    baseUrl: `${process.env.VITE_WS_URL}/documents`,
    autoConnect: true,
    monitoringEnabled: true
  });

  // Memoized table columns with accessibility support
  const columns = useMemo(() => [
    {
      id: 'filename',
      label: 'Document Name',
      sortable: true,
      render: (doc: Document) => (
        <Typography variant="body2" component="span">
          {doc.filename}
        </Typography>
      ),
      ariaLabel: 'Document filename'
    },
    {
      id: 'type',
      label: 'Type',
      sortable: true,
      render: (doc: Document) => doc.type.toUpperCase(),
      ariaLabel: 'Document type'
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
              aria-label={`Processing progress: ${state.progressMap.get(doc.id) || 0}%`}
            />
          )}
          <Typography variant="body2" component="span">
            {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
          </Typography>
          {doc.status === 'failed' && doc.error_message && (
            <Tooltip title={doc.error_message}>
              <ErrorIcon color="error" />
            </Tooltip>
          )}
        </Box>
      ),
      ariaLabel: 'Processing status'
    },
    {
      id: 'actions',
      label: 'Actions',
      render: (doc: Document) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {doc.status === 'processing' && (
            <Tooltip title="Cancel processing">
              <IconButton
                onClick={() => handleCancelProcessing(doc.id)}
                size="small"
                aria-label={`Cancel processing for ${doc.filename}`}
              >
                <CancelIcon />
              </IconButton>
            </Tooltip>
          )}
          {doc.status === 'failed' && (
            <Tooltip title="Retry processing">
              <IconButton
                onClick={() => handleRetryProcessing(doc.id)}
                size="small"
                aria-label={`Retry processing for ${doc.filename}`}
              >
                <RetryIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
      ariaLabel: 'Document actions'
    }
  ], [state.progressMap]);

  // Load documents with cursor-based pagination
  const loadDocuments = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await documentService.getDocumentList({
        cursor: state.cursor,
        limit: state.pageSize
      });

      setState(prev => ({
        ...prev,
        documents: response.items,
        totalCount: response.total_count,
        loading: false,
        cursor: response.metadata?.next_cursor || null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: (error as Error).message
      }));
      onError?.(error as Error);
    }
  }, [state.cursor, state.pageSize, onError]);

  // Handle WebSocket document updates
  const handleDocumentUpdate = useCallback((update: any) => {
    setState(prev => {
      const updatedDocs = prev.documents.map(doc => {
        if (doc.id === update.documentId) {
          if (update.status === 'completed' && onProcessingComplete) {
            onProcessingComplete({ ...doc, ...update });
          }
          return { ...doc, ...update };
        }
        return doc;
      });

      const updatedProgress = new Map(prev.progressMap);
      if (update.progress) {
        updatedProgress.set(update.documentId, update.progress);
      }

      return {
        ...prev,
        documents: updatedDocs,
        progressMap: updatedProgress
      };
    });
  }, [onProcessingComplete]);

  // Cancel document processing
  const handleCancelProcessing = async (documentId: string) => {
    try {
      await documentService.cancelProcessing(documentId);
      loadDocuments();
    } catch (error) {
      onError?.(error as Error);
    }
  };

  // Retry failed document processing
  const handleRetryProcessing = async (documentId: string) => {
    try {
      await documentService.retryProcessing(documentId);
      loadDocuments();
    } catch (error) {
      onError?.(error as Error);
    }
  };

  // Handle pagination changes
  const handlePageChange = useCallback(({ page, pageSize }) => {
    setState(prev => ({
      ...prev,
      currentPage: page,
      pageSize,
      cursor: null // Reset cursor on page change
    }));
  }, []);

  // Set up WebSocket listeners and auto-refresh
  useEffect(() => {
    addListener('document.update', handleDocumentUpdate);
    
    let refreshTimer: NodeJS.Timeout;
    if (autoRefresh) {
      refreshTimer = setInterval(loadDocuments, refreshInterval);
    }

    return () => {
      removeListener('document.update', handleDocumentUpdate);
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [addListener, removeListener, handleDocumentUpdate, loadDocuments, autoRefresh, refreshInterval]);

  // Initial load and cursor changes
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments, state.cursor]);

  return (
    <Box
      role="region"
      aria-label={ariaLabel}
      sx={{ width: '100%', overflow: 'hidden' }}
    >
      {!isConnected && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
        >
          Real-time updates are currently unavailable. Trying to reconnect...
        </Alert>
      )}

      {state.error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
        >
          {state.error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Tooltip title="Refresh queue">
          <IconButton
            onClick={() => loadDocuments()}
            disabled={state.loading}
            aria-label="Refresh processing queue"
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <DataTable
        data={state.documents}
        columns={columns}
        loading={state.loading}
        page={state.currentPage}
        pageSize={state.pageSize}
        total={state.totalCount}
        onPageChange={handlePageChange}
        enableVirtualization
        ariaLabel="Document processing queue table"
      />
    </Box>
  );
};

export default ProcessingQueue;