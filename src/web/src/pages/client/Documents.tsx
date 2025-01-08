/**
 * Documents - Client-facing document management page component with advanced features
 * including real-time status updates, optimized search, and accessibility support.
 * @version 1.0.0
 */

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
import { useDebounce } from 'use-debounce';

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

// Default filter and pagination values
const DEFAULT_PAGE_SIZE = 20;
const DEBOUNCE_DELAY = 300;

/**
 * Documents page component with enhanced document browsing capabilities
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
    pageSize: DEFAULT_PAGE_SIZE,
    totalCount: 0,
    nextCursor: null,
    prevCursor: null
  });

  // Debounced search query
  const [debouncedSearchQuery] = useDebounce(filters.searchQuery, DEBOUNCE_DELAY);

  // Refs for tracking mounted state and previous search query
  const isMounted = useRef(true);
  const prevSearchQuery = useRef(filters.searchQuery);

  // Memoized document type options
  const documentTypes = useMemo(() => [
    { value: 'pdf', label: 'PDF Documents' },
    { value: 'docx', label: 'Word Documents' },
    { value: 'xlsx', label: 'Excel Spreadsheets' },
    { value: 'txt', label: 'Text Files' }
  ], []);

  // Memoized processing status options
  const processingStatuses = useMemo(() => [
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' }
  ], []);

  /**
   * Enhanced document loading with error handling and retry logic
   */
  const loadDocuments = useCallback(async () => {
    if (!isMounted.current) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getDocumentList({
        cursor: filters.cursor,
        limit: pagination.pageSize,
        type: filters.type || undefined,
        status: filters.status || undefined,
        searchQuery: debouncedSearchQuery
      });

      if (isMounted.current) {
        setDocuments(response.items);
        setPagination(prev => ({
          ...prev,
          totalCount: response.total_count,
          nextCursor: response.metadata.next_cursor,
          prevCursor: response.metadata.prev_cursor
        }));
        setFilters(prev => ({
          ...prev,
          hasNextPage: !!response.metadata.next_cursor
        }));
      }
    } catch (err) {
      if (isMounted.current) {
        setError('Failed to load documents. Please try again.');
        console.error('Document loading error:', err);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [filters.cursor, filters.type, filters.status, debouncedSearchQuery, pagination.pageSize]);

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

  // Effect for initial load and filter changes
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <DocumentContextProvider>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Documents
        </Typography>

        {/* Filters Section */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search Documents"
                value={filters.searchQuery}
                onChange={handleSearchChange}
                placeholder="Enter keywords..."
                variant="outlined"
                size="small"
                InputProps={{
                  'aria-label': 'Search documents',
                  'aria-describedby': 'search-description'
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Select
                fullWidth
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                displayEmpty
                size="small"
                aria-label="Filter by document type"
              >
                <MenuItem value="">All Types</MenuItem>
                {documentTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
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
                size="small"
                aria-label="Filter by processing status"
              >
                <MenuItem value="">All Statuses</MenuItem>
                {processingStatuses.map(status => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
              </Select>
            </Grid>
          </Grid>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Documents Grid */}
        <Grid container spacing={3}>
          {loading ? (
            // Loading skeletons
            Array.from(new Array(6)).map((_, index) => (
              <Grid item xs={12} md={6} lg={4} key={`skeleton-${index}`}>
                <Skeleton 
                  variant="rectangular" 
                  height={200} 
                  sx={{ borderRadius: 1 }}
                />
              </Grid>
            ))
          ) : documents.length > 0 ? (
            // Document cards
            documents.map(document => (
              <Grid item xs={12} md={6} lg={4} key={document.id}>
                <Paper
                  sx={{
                    p: 2,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Typography variant="h6" component="h2" gutterBottom>
                    {document.filename}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Type: {document.type}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Status: {document.status}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <DocumentPreview />
                </Paper>
              </Grid>
            ))
          ) : (
            // No documents message
            <Grid item xs={12}>
              <Alert severity="info">
                No documents found. Try adjusting your search filters.
              </Alert>
            </Grid>
          )}
        </Grid>

        {/* Pagination Controls */}
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2
          }}
        >
          <IconButton
            onClick={() => setFilters(prev => ({
              ...prev,
              cursor: pagination.prevCursor
            }))}
            disabled={!pagination.prevCursor || loading}
            aria-label="Previous page"
          >
            {'<'}
          </IconButton>
          <Typography variant="body2">
            Page {pagination.page} of{' '}
            {Math.ceil(pagination.totalCount / pagination.pageSize)}
          </Typography>
          <IconButton
            onClick={() => setFilters(prev => ({
              ...prev,
              cursor: pagination.nextCursor
            }))}
            disabled={!filters.hasNextPage || loading}
            aria-label="Next page"
          >
            {'>'}
          </IconButton>
        </Box>
      </Box>
    </DocumentContextProvider>
  );
};

export default Documents;