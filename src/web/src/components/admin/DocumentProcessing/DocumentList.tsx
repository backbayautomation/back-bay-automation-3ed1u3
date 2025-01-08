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
};

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

export const DocumentList: React.FC<DocumentListProps> = ({
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
    const [totalItems, setTotalItems] = useState(0);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    // Refs for cleanup and optimization
    const refreshIntervalRef = useRef<NodeJS.Timeout>();
    const abortControllerRef = useRef<AbortController>();

    // Memoized fetch function with debouncing
    const fetchDocuments = useCallback(
        debounce(async (pageNumber: number, signal?: AbortSignal) => {
            try {
                setLoading(true);
                setError(null);

                const response = await getDocumentList({
                    page: pageNumber,
                    limit: paginationConfig.pageSize || PAGE_SIZE,
                    clientId,
                    type: documentType,
                    sortBy: 'created_at',
                    order: 'desc',
                    filters: {}
                });

                setDocuments(response.items);
                setTotalItems(response.total_count);
            } catch (err) {
                if (signal?.aborted) return;

                const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.GENERAL_ERROR;
                setError(errorMessage);
                onError?.(err as Error);
            } finally {
                setLoading(false);
            }
        }, DEBOUNCE_DELAY),
        [clientId, documentType, paginationConfig.pageSize, onError]
    );

    // Handle document deletion with optimistic updates
    const handleDelete = async (documentId: string, skipConfirmation = false) => {
        if (!skipConfirmation && !window.confirm('Are you sure you want to delete this document?')) {
            return;
        }

        const originalDocuments = [...documents];
        try {
            // Optimistic update
            setDocuments(docs => docs.filter(doc => doc.id !== documentId));
            
            await removeDocument(documentId);
            onDocumentDeleted?.();
        } catch (err) {
            // Revert on failure
            setDocuments(originalDocuments);
            setError(ERROR_MESSAGES.GENERAL_ERROR);
            onError?.(err as Error);
        }
    };

    // Setup auto-refresh interval
    useEffect(() => {
        if (autoRefresh) {
            refreshIntervalRef.current = setInterval(() => {
                fetchDocuments(page);
            }, refreshInterval);
        }

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [autoRefresh, refreshInterval, page, fetchDocuments]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // Table columns configuration
    const columns = [
        {
            id: 'filename',
            label: 'Document Name',
            sortable: true,
            render: (doc: Document) => (
                <Tooltip title={doc.filename} arrow>
                    <span>{doc.filename}</span>
                </Tooltip>
            )
        },
        {
            id: 'type',
            label: 'Type',
            sortable: true,
            render: (doc: Document) => (
                <Chip
                    label={doc.type.toUpperCase()}
                    size="small"
                    color="primary"
                    variant="outlined"
                />
            )
        },
        {
            id: 'status',
            label: 'Status',
            sortable: true,
            render: (doc: Document) => (
                <Chip
                    icon={doc.status === 'completed' ? <CheckCircle /> : 
                          doc.status === 'failed' ? <Error /> : undefined}
                    label={doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    color={doc.status === 'completed' ? 'success' :
                           doc.status === 'failed' ? 'error' : 'default'}
                    size="small"
                />
            )
        },
        {
            id: 'actions',
            label: 'Actions',
            render: (doc: Document) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Tooltip title="Download">
                        <IconButton
                            size="small"
                            onClick={() => window.open(`/api/documents/${doc.id}/download`)}
                            aria-label={`Download ${doc.filename}`}
                        >
                            <Download />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton
                            size="small"
                            onClick={() => handleDelete(doc.id)}
                            aria-label={`Delete ${doc.filename}`}
                            color="error"
                        >
                            <Delete />
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
                    total={totalItems}
                    loading={loading}
                    onPageChange={({ page: newPage }) => {
                        setPage(newPage);
                        fetchDocuments(newPage);
                    }}
                    className="document-list-table"
                    enableVirtualization
                    virtualRowHeight={52}
                    ariaLabel="Document list table"
                    getRowAriaLabel={(doc) => `Document ${doc.filename}`}
                />
            </div>
        </ErrorBoundary>
    );
};

export default DocumentList;