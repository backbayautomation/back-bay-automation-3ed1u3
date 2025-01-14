import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IconButton, Tooltip, Chip, CircularProgress, Alert } from '@mui/material'; // v5.14.0
import { Delete, Refresh, Download, CheckCircle, Error } from '@mui/icons-material'; // v5.14.0
import { debounce } from 'lodash'; // v4.17.21
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

import { DataTable } from '../../common/Tables/DataTable';
import { Document, DocumentType, ProcessingStatus } from '../../../types/document';
import { getDocumentList, removeDocument } from '../../../services/documents';

// Global constants
const REFRESH_INTERVAL = 30000;
const PAGE_SIZE = 10;
const MAX_RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY = 500;
const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Network error occurred',
    PERMISSION_ERROR: 'Permission denied',
    GENERAL_ERROR: 'An error occurred'
} as const;

// Props interface with enhanced configuration options
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

const DocumentList: React.FC<DocumentListProps> = ({
    clientId,
    documentType,
    autoRefresh = true,
    refreshInterval = REFRESH_INTERVAL,
    enableBatchOperations = false,
    onDocumentDeleted,
    onError,
    paginationConfig = { initialPage: 1, pageSize: PAGE_SIZE }
}) => {
    // State management
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(paginationConfig.initialPage);
    const [total, setTotal] = useState(0);
    const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
    const [retryCount, setRetryCount] = useState(0);

    // Refs for cleanup and optimization
    const refreshIntervalRef = useRef<NodeJS.Timeout>();
    const abortControllerRef = useRef<AbortController>();

    // Memoized fetch function with error handling and retry logic
    const fetchDocuments = useCallback(async (currentPage: number) => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();

        try {
            setLoading(true);
            setError(null);

            const response = await getDocumentList({
                cursor: ((currentPage - 1) * paginationConfig.pageSize!).toString(),
                limit: paginationConfig.pageSize!,
                clientId,
                type: documentType,
                sortBy: 'created_at',
                order: 'desc'
            });

            setDocuments(response.items);
            setTotal(response.total_count);
            setRetryCount(0);
        } catch (err) {
            const error = err as Error;
            setError(error.message || ERROR_MESSAGES.GENERAL_ERROR);
            
            if (retryCount < MAX_RETRY_ATTEMPTS) {
                setRetryCount(prev => prev + 1);
                setTimeout(() => fetchDocuments(currentPage), 1000 * Math.pow(2, retryCount));
            }
            
            onError?.(error);
        } finally {
            setLoading(false);
        }
    }, [clientId, documentType, paginationConfig.pageSize, retryCount, onError]);

    // Debounced refresh function
    const debouncedRefresh = useCallback(
        debounce(() => fetchDocuments(page), DEBOUNCE_DELAY),
        [fetchDocuments, page]
    );

    // Handle document deletion with optimistic updates
    const handleDelete = useCallback(async (documentId: string, skipConfirmation = false) => {
        if (!skipConfirmation && !window.confirm('Are you sure you want to delete this document?')) {
            return;
        }

        try {
            // Optimistic update
            setDocuments(prev => prev.filter(doc => doc.id !== documentId));

            await removeDocument(documentId);
            onDocumentDeleted?.();
        } catch (err) {
            // Revert optimistic update on error
            fetchDocuments(page);
            setError((err as Error).message || ERROR_MESSAGES.GENERAL_ERROR);
            onError?.(err as Error);
        }
    }, [page, fetchDocuments, onDocumentDeleted, onError]);

    // Setup auto-refresh interval
    useEffect(() => {
        if (autoRefresh) {
            refreshIntervalRef.current = setInterval(debouncedRefresh, refreshInterval);
        }

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
            debouncedRefresh.cancel();
        };
    }, [autoRefresh, refreshInterval, debouncedRefresh]);

    // Table columns configuration
    const columns = [
        {
            id: 'filename',
            label: 'Document Name',
            sortable: true,
            render: (doc: Document) => doc.filename,
        },
        {
            id: 'type',
            label: 'Type',
            sortable: true,
            render: (doc: Document) => doc.type.toUpperCase(),
        },
        {
            id: 'status',
            label: 'Status',
            sortable: true,
            render: (doc: Document) => (
                <Chip
                    label={doc.status}
                    color={doc.status === 'completed' ? 'success' : 
                           doc.status === 'failed' ? 'error' : 'default'}
                    icon={doc.status === 'completed' ? <CheckCircle /> : 
                          doc.status === 'failed' ? <Error /> : undefined}
                    aria-label={`Document status: ${doc.status}`}
                />
            ),
        },
        {
            id: 'actions',
            label: 'Actions',
            render: (doc: Document) => (
                <div>
                    <Tooltip title="Download">
                        <IconButton
                            aria-label={`Download ${doc.filename}`}
                            onClick={() => window.open(`/api/documents/${doc.id}/download`)}
                        >
                            <Download />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton
                            aria-label={`Delete ${doc.filename}`}
                            onClick={() => handleDelete(doc.id)}
                            color="error"
                        >
                            <Delete />
                        </IconButton>
                    </Tooltip>
                </div>
            ),
        },
    ];

    return (
        <ErrorBoundary
            fallback={<Alert severity="error">Failed to load documents</Alert>}
            onError={onError}
        >
            <div>
                {error && (
                    <Alert severity="error" sx={{ marginBottom: 2 }}>
                        {error}
                    </Alert>
                )}

                <DataTable
                    data={documents}
                    columns={columns}
                    page={page}
                    pageSize={paginationConfig.pageSize!}
                    total={total}
                    loading={loading}
                    onPageChange={({ page: newPage }) => {
                        setPage(newPage);
                        fetchDocuments(newPage);
                    }}
                    className="document-list-table"
                    enableVirtualization
                    virtualRowHeight={52}
                    ariaLabel="Document list table"
                    getRowAriaLabel={(doc) => `Document: ${doc.filename}`}
                />
            </div>
        </ErrorBoundary>
    );
};

export default DocumentList;