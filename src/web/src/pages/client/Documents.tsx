import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    Box, 
    Grid, 
    Paper, 
    Typography, 
    CircularProgress, 
    TextField, 
    MenuItem, 
    Select, 
    Skeleton, 
    Alert, 
    IconButton 
} from '@mui/material';
import { useDebounce } from 'use-debounce'; // v9.0.0
import { Document, DocumentType, ProcessingStatus } from '../../types/document';
import { DocumentContextProvider, useDocumentContext } from '../../components/client/DocumentViewer/DocumentContext';
import DocumentPreview from '../../components/client/DocumentViewer/DocumentPreview';
import { getDocumentList, getDocumentDetails } from '../../services/documents';

// Enhanced interfaces for document management
interface DocumentFilterState {
    searchQuery: string;
    type: DocumentType | '';
    status: ProcessingStatus | '';
    cursor: string | null;
    hasNextPage: boolean;
}

interface DocumentPaginationState {
    page: number;
    pageSize: number;
    totalCount: number;
    nextCursor: string | null;
    prevCursor: string | null;
}

// Constants for configuration
const INITIAL_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DOCUMENT_TYPES: DocumentType[] = ['pdf', 'docx', 'xlsx', 'txt'];
const PROCESSING_STATUSES: ProcessingStatus[] = [
    'pending',
    'queued',
    'processing',
    'completed',
    'failed',
    'cancelled'
];

/**
 * Documents page component implementing an advanced document browsing interface
 * with real-time status updates and accessibility features.
 */
const Documents: React.FC = () => {
    // State management
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<DocumentFilterState>({
        searchQuery: '',
        type: '',
        status: '',
        cursor: null,
        hasNextPage: false
    });
    const [pagination, setPagination] = useState<DocumentPaginationState>({
        page: 1,
        pageSize: INITIAL_PAGE_SIZE,
        totalCount: 0,
        nextCursor: null,
        prevCursor: null
    });

    // Debounced search query
    const [debouncedSearch] = useDebounce(filters.searchQuery, SEARCH_DEBOUNCE_MS);

    // Refs for tracking mounted state and abort controller
    const mountedRef = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);

    /**
     * Enhanced search handler with debounce and validation
     */
    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const query = event.target.value.trim();
        setFilters(prev => ({
            ...prev,
            searchQuery: query,
            cursor: null
        }));
        setPagination(prev => ({
            ...prev,
            page: 1
        }));
    }, []);

    /**
     * Enhanced filter handler with type validation
     */
    const handleFilterChange = useCallback((filterName: string, value: string) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: value,
            cursor: null
        }));
        setPagination(prev => ({
            ...prev,
            page: 1
        }));
    }, []);

    /**
     * Enhanced document loading with error handling and retry
     */
    const loadDocuments = useCallback(async () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setLoading(true);
        setError(null);

        try {
            const response = await getDocumentList({
                cursor: filters.cursor,
                limit: pagination.pageSize,
                type: filters.type || undefined,
                sortBy: 'created_at',
                order: 'desc'
            });

            if (mountedRef.current) {
                setDocuments(response.items);
                setPagination(prev => ({
                    ...prev,
                    totalCount: response.total_count,
                    nextCursor: response.metadata?.next_cursor || null,
                    prevCursor: response.metadata?.prev_cursor || null
                }));
                setFilters(prev => ({
                    ...prev,
                    hasNextPage: !!response.metadata?.next_cursor
                }));
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : 'Failed to load documents');
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [filters.cursor, filters.type, pagination.pageSize]);

    // Effect for document loading
    useEffect(() => {
        loadDocuments();
        return () => {
            mountedRef.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [loadDocuments, debouncedSearch]);

    // Memoized filter controls
    const filterControls = useMemo(() => (
        <Box component={Paper} p={2} mb={2}>
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                    <TextField
                        fullWidth
                        label="Search Documents"
                        value={filters.searchQuery}
                        onChange={handleSearchChange}
                        placeholder="Enter keywords..."
                        InputProps={{
                            'aria-label': 'Search documents',
                        }}
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <Select
                        fullWidth
                        value={filters.type}
                        onChange={(e) => handleFilterChange('type', e.target.value)}
                        displayEmpty
                        inputProps={{
                            'aria-label': 'Filter by document type',
                        }}
                    >
                        <MenuItem value="">All Types</MenuItem>
                        {DOCUMENT_TYPES.map(type => (
                            <MenuItem key={type} value={type}>
                                {type.toUpperCase()}
                            </MenuItem>
                        ))}
                    </Select>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Select
                        fullWidth
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        displayEmpty
                        inputProps={{
                            'aria-label': 'Filter by processing status',
                        }}
                    >
                        <MenuItem value="">All Statuses</MenuItem>
                        {PROCESSING_STATUSES.map(status => (
                            <MenuItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </MenuItem>
                        ))}
                    </Select>
                </Grid>
            </Grid>
        </Box>
    ), [filters.searchQuery, filters.type, filters.status, handleSearchChange, handleFilterChange]);

    return (
        <DocumentContextProvider>
            <Box 
                component="main" 
                role="main" 
                aria-label="Document Management"
                sx={{ p: 3 }}
            >
                <Typography variant="h4" component="h1" gutterBottom>
                    Documents
                </Typography>

                {filterControls}

                {error && (
                    <Alert 
                        severity="error" 
                        sx={{ mb: 2 }}
                        onClose={() => setError(null)}
                    >
                        {error}
                    </Alert>
                )}

                <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                        <Paper 
                            sx={{ 
                                height: 'calc(100vh - 250px)', 
                                overflow: 'auto' 
                            }}
                            role="region"
                            aria-label="Document List"
                        >
                            {loading ? (
                                Array.from({ length: 5 }).map((_, index) => (
                                    <Box key={index} p={2}>
                                        <Skeleton variant="rectangular" height={60} />
                                    </Box>
                                ))
                            ) : documents.length === 0 ? (
                                <Box p={3} textAlign="center">
                                    <Typography color="textSecondary">
                                        No documents found
                                    </Typography>
                                </Box>
                            ) : (
                                documents.map(document => (
                                    <Box
                                        key={document.id}
                                        p={2}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => getDocumentDetails(document.id)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                getDocumentDetails(document.id);
                                            }
                                        }}
                                        sx={{
                                            cursor: 'pointer',
                                            '&:hover': {
                                                bgcolor: 'action.hover'
                                            }
                                        }}
                                    >
                                        <Typography variant="subtitle1">
                                            {document.filename}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            {new Date(document.created_at).toLocaleDateString()}
                                        </Typography>
                                    </Box>
                                ))
                            )}
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={8}>
                        <DocumentPreview 
                            enableVirtualization
                            renderOptions={{
                                highlightTerms: true,
                                syntaxHighlighting: true
                            }}
                        />
                    </Grid>
                </Grid>
            </Box>
        </DocumentContextProvider>
    );
};

export default Documents;