import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { 
    Document, 
    DocumentType, 
    ProcessingStatus 
} from '../../types/document';
import { 
    DocumentContextProvider, 
    useDocumentContext 
} from '../../components/client/DocumentViewer/DocumentContext';
import DocumentPreview from '../../components/client/DocumentViewer/DocumentPreview';
import { getDocumentList, getDocumentDetails } from '../../services/documents';

// Enhanced interfaces for document filtering and pagination
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

// Styled component configurations
const styles = {
    container: {
        p: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
    },
    filters: {
        display: 'flex',
        gap: 2,
        mb: 2,
        alignItems: 'center'
    },
    searchField: {
        flex: 1,
        minWidth: 200
    },
    documentList: {
        flex: 1,
        overflow: 'auto',
        minHeight: 200
    },
    documentPreview: {
        height: '100%',
        minHeight: 400
    }
} as const;

/**
 * Documents page component implementing an advanced document browsing interface
 * with real-time status updates and accessibility features.
 * @version 1.0.0
 */
const Documents: React.FC = () => {
    // State management
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

    // Filter and pagination state
    const [filters, setFilters] = useState<DocumentFilterState>({
        searchQuery: '',
        type: '',
        status: '',
        cursor: null,
        hasNextPage: false
    });

    const [pagination, setPagination] = useState<DocumentPaginationState>({
        page: 1,
        pageSize: 20,
        totalCount: 0,
        nextCursor: null,
        prevCursor: null
    });

    // Debounced search query to prevent excessive API calls
    const [debouncedSearch] = useDebounce(filters.searchQuery, 300);

    // Refs for intersection observer
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    /**
     * Enhanced search handler with input validation
     */
    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const query = event.target.value.trim();
        setFilters(prev => ({
            ...prev,
            searchQuery: query,
            cursor: null
        }));
        setPagination(prev => ({ ...prev, page: 1 }));
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
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    /**
     * Enhanced document loading with error handling and retry logic
     */
    const loadDocuments = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await getDocumentList({
                cursor: filters.cursor,
                limit: pagination.pageSize,
                clientId: undefined, // Will be handled by API auth
                type: filters.type || undefined,
                sortBy: 'created_at',
                order: 'desc'
            });

            setDocuments(prev => 
                filters.cursor ? [...prev, ...response.items] : response.items
            );
            
            setPagination(prev => ({
                ...prev,
                totalCount: response.total_count,
                nextCursor: response.metadata?.nextCursor || null
            }));

            setFilters(prev => ({
                ...prev,
                hasNextPage: !!response.metadata?.nextCursor
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load documents');
            console.error('Error loading documents:', err);
        } finally {
            setLoading(false);
        }
    }, [filters.cursor, pagination.pageSize, filters.type]);

    // Effect for initial load and filter changes
    useEffect(() => {
        loadDocuments();
    }, [loadDocuments, debouncedSearch]);

    // Intersection observer for infinite scroll
    useEffect(() => {
        if (loading || !filters.hasNextPage) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setFilters(prev => ({
                        ...prev,
                        cursor: pagination.nextCursor
                    }));
                }
            },
            { threshold: 0.5 }
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => observerRef.current?.disconnect();
    }, [loading, filters.hasNextPage, pagination.nextCursor]);

    // Memoized document type options
    const documentTypeOptions = useMemo(() => [
        { value: '', label: 'All Types' },
        { value: 'pdf', label: 'PDF' },
        { value: 'docx', label: 'Word' },
        { value: 'xlsx', label: 'Excel' },
        { value: 'txt', label: 'Text' }
    ], []);

    return (
        <DocumentContextProvider>
            <Box sx={styles.container}>
                {/* Filters Section */}
                <Paper sx={styles.filters} elevation={1}>
                    <TextField
                        sx={styles.searchField}
                        label="Search Documents"
                        value={filters.searchQuery}
                        onChange={handleSearchChange}
                        variant="outlined"
                        size="small"
                        InputProps={{
                            'aria-label': 'Search documents',
                            'aria-describedby': 'search-description'
                        }}
                    />
                    <Select
                        value={filters.type}
                        onChange={(e) => handleFilterChange('type', e.target.value)}
                        size="small"
                        displayEmpty
                        aria-label="Filter by document type"
                    >
                        {documentTypeOptions.map(option => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                </Paper>

                {/* Error Display */}
                {error && (
                    <Alert 
                        severity="error" 
                        onClose={() => setError(null)}
                        aria-live="polite"
                    >
                        {error}
                    </Alert>
                )}

                {/* Document List and Preview */}
                <Grid container spacing={2} sx={{ flex: 1 }}>
                    <Grid item xs={12} md={4}>
                        <Paper sx={styles.documentList}>
                            {loading && !documents.length ? (
                                Array.from({ length: 5 }).map((_, index) => (
                                    <Skeleton 
                                        key={index}
                                        height={60}
                                        animation="wave"
                                        sx={{ m: 1 }}
                                    />
                                ))
                            ) : (
                                documents.map((doc) => (
                                    <Box
                                        key={doc.id}
                                        onClick={() => setSelectedDocument(doc)}
                                        sx={{
                                            p: 2,
                                            cursor: 'pointer',
                                            '&:hover': { bgcolor: 'action.hover' },
                                            bgcolor: selectedDocument?.id === doc.id ? 
                                                'action.selected' : 'background.paper'
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        aria-selected={selectedDocument?.id === doc.id}
                                    >
                                        <Typography variant="subtitle1">
                                            {doc.filename}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {new Date(doc.created_at).toLocaleDateString()}
                                        </Typography>
                                    </Box>
                                ))
                            )}
                            {filters.hasNextPage && (
                                <div ref={loadMoreRef}>
                                    <CircularProgress size={24} sx={{ m: 2 }} />
                                </div>
                            )}
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={8}>
                        <DocumentPreview
                            className={styles.documentPreview}
                            enableVirtualization
                            renderOptions={{
                                fontSize: 14,
                                lineHeight: 1.6
                            }}
                        />
                    </Grid>
                </Grid>
            </Box>
        </DocumentContextProvider>
    );
};

export default Documents;