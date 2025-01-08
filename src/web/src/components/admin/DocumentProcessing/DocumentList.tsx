import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IconButton, Tooltip, Chip, CircularProgress, Alert } from '@mui/material'; // v5.14.0
import { Delete, Refresh, Download, CheckCircle, Error } from '@mui/icons-material'; // v5.14.0
import { debounce } from 'lodash'; // v4.17.21
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

import { DataTable } from '../../common/Tables/DataTable';
import { Document, DocumentType, ProcessingStatus } from '../../../types/document';
import { getDocumentList, removeDocument } from '../../../services/documents';

// Constants for component configuration
const REFRESH_INTERVAL = 30000; // 30 seconds
const PAGE_SIZE = 10;
const MAX_RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY = 500;
const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Network error occurred while fetching documents',
    PERMISSION_ERROR: 'Permission denied to access documents',
    GENERAL_ERROR: 'An error occurred while processing your request'
} as const;

// Interface for component props
interface DocumentListProps {
    clientId?: string;
    documentType?: DocumentType;
    autoRefresh?: boolean;
    refreshInterval?: number;
    enableBatchOperations?: boolean;
    onDocumentDeleted?: () => void;
    onError?: (error: Error) => void;
    paginationConfig?: {
        initialPage?: number;
        pageSize?: number;
    };
}

// Status chip colors mapping
const statusColors: Record<ProcessingStatus, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
    pending: 'default',
    queued: 'primary',
    processing: 'warning',
    completed: 'success',
    failed: 'error',
    cancelled: 'error'
};

const DocumentList: React.FC<DocumentListProps> = ({
    clientId,
    documentType,
    autoRefresh = true,
    refreshInterval = REFRESH_INTERVAL,
    enableBatchOperations = false,
    onDocumentDeleted,
    onError,
    paginationConfig = {}
}) => {
    // State management
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(paginationConfig.initialPage || 1);
    const [total, setTotal] = useState(0);
    const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

    // Refs for cleanup and optimization
    const refreshTimeoutRef = useRef<NodeJS.Timeout>();
    const abortControllerRef = useRef<AbortController>();

    // Memoized fetch function with debouncing
    const fetchDocuments = useCallback(
        debounce(async (currentPage: number) => {
            try {
                // Cancel previous request if exists
                abortControllerRef.current?.abort();
                abortControllerRef.current = new AbortController();

                setLoading(true);
                setError(null);

                const response = await getDocumentList({
                    cursor: undefined,
                    limit: paginationConfig.pageSize || PAGE_SIZE,
                    clientId,
                    type: documentType,
                    sortBy: 'created_at',
                    order: 'desc'
                });

                setDocuments(response.items);
                setTotal(response.total_count);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.GENERAL_ERROR;
                setError(errorMessage);
                onError?.(err as Error);
            } finally {
                setLoading(false);
            }
        }, DEBOUNCE_DELAY),
        [clientId, documentType, paginationConfig.pageSize, onError]
    );

    // Setup auto-refresh
    useEffect(() => {
        if (autoRefresh) {
            const setupRefresh = () => {
                refreshTimeoutRef.current = setTimeout(() => {
                    fetchDocuments(page);
                    setupRefresh();
                }, refreshInterval);
            };

            setupRefresh();
        }

        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
            abortControllerRef.current?.abort();
        };
    }, [autoRefresh, refreshInterval, fetchDocuments, page]);

    // Initial fetch and page change handler
    useEffect(() => {
        fetchDocuments(page);
    }, [fetchDocuments, page]);

    // Handle document deletion with retry logic
    const handleDelete = useCallback(async (documentId: string, skipConfirmation = false) => {
        if (!skipConfirmation && !window.confirm('Are you sure you want to delete this document?')) {
            return;
        }

        let retryCount = 0;
        let success = false;

        while (!success && retryCount < MAX_RETRY_ATTEMPTS) {
            try {
                await removeDocument(documentId);
                success = true;
                
                // Optimistic update
                setDocuments(prev => prev.filter(doc => doc.id !== documentId));
                onDocumentDeleted?.();
            } catch (err) {
                retryCount++;
                if (retryCount === MAX_RETRY_ATTEMPTS) {
                    const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.GENERAL_ERROR;
                    setError(errorMessage);
                    onError?.(err as Error);
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }
    }, [onDocumentDeleted, onError]);

    // Table columns configuration
    const columns = [
        {
            id: 'filename',
            label: 'Document Name',
            sortable: true,
            render: (document: Document) => document.filename,
            ariaLabel: 'Document filename'
        },
        {
            id: 'type',
            label: 'Type',
            sortable: true,
            render: (document: Document) => document.type.toUpperCase(),
            ariaLabel: 'Document type'
        },
        {
            id: 'status',
            label: 'Status',
            sortable: true,
            render: (document: Document) => (
                <Chip
                    label={document.status}
                    color={statusColors[document.status]}
                    icon={document.status === 'completed' ? <CheckCircle /> : 
                          document.status === 'failed' ? <Error /> : undefined}
                    aria-label={`Status: ${document.status}`}
                />
            )
        },
        {
            id: 'actions',
            label: 'Actions',
            render: (document: Document) => (
                <div>
                    <Tooltip title="Delete document">
                        <IconButton
                            onClick={() => handleDelete(document.id)}
                            aria-label="Delete document"
                            disabled={loading}
                        >
                            <Delete />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Download document">
                        <IconButton
                            onClick={() => {/* Download implementation */}}
                            aria-label="Download document"
                            disabled={loading}
                        >
                            <Download />
                        </IconButton>
                    </Tooltip>
                </div>
            )
        }
    ];

    return (
        <ErrorBoundary
            fallback={<Alert severity="error">Failed to load document list</Alert>}
            onError={onError}
        >
            <div>
                {error && (
                    <Alert 
                        severity="error" 
                        onClose={() => setError(null)}
                        sx={{ marginBottom: 2 }}
                    >
                        {error}
                    </Alert>
                )}

                <DataTable
                    data={documents}
                    columns={columns}
                    page={page}
                    pageSize={paginationConfig.pageSize || PAGE_SIZE}
                    total={total}
                    onPageChange={({ page: newPage }) => setPage(newPage)}
                    loading={loading}
                    emptyMessage="No documents found"
                    enableVirtualization={true}
                    virtualRowHeight={52}
                    ariaLabel="Documents table"
                    getRowAriaLabel={(document) => `Document: ${document.filename}`}
                />

                {loading && (
                    <CircularProgress
                        size={24}
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            marginTop: '-12px',
                            marginLeft: '-12px'
                        }}
                    />
                )}
            </div>
        </ErrorBoundary>
    );
};

export default DocumentList;