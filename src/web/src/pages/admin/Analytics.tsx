import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { withErrorBoundary } from 'react-error-boundary';
import AdminLayout from '../../layouts/AdminLayout';
import AnalyticsDashboard from '../../components/admin/AnalyticsDashboard/AnalyticsDashboard';

// Constants for component configuration
const REFRESH_INTERVAL = 60000; // 1 minute refresh interval
const ERROR_MESSAGES = {
  LOAD_ERROR: 'Failed to load analytics data',
  REFRESH_ERROR: 'Error refreshing analytics data'
} as const;

// Props interface for Analytics page
interface AnalyticsPageProps {
  refreshInterval?: number;
  initialDateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

// Error boundary fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <Box sx={styles.errorContainer}>
    <Alert 
      severity="error" 
      variant="filled"
      role="alert"
      aria-live="assertive"
    >
      {error.message}
    </Alert>
  </Box>
);

/**
 * Analytics page component providing comprehensive system metrics and performance monitoring
 * Implements real-time updates, error handling, and accessibility features
 */
const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  refreshInterval = REFRESH_INTERVAL,
  initialDateRange
}) => {
  // State for loading and error handling
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Handle data refresh with error boundary
  const handleRefresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Actual data fetching is handled by AnalyticsDashboard component
    } catch (err) {
      setError(err instanceof Error ? err : new Error(ERROR_MESSAGES.REFRESH_ERROR));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  return (
    <AdminLayout>
      <Box sx={styles.container}>
        <Box sx={styles.header}>
          <Typography 
            variant="h4" 
            component="h1" 
            sx={styles.title}
            aria-label="Analytics Dashboard"
          >
            Analytics Dashboard
          </Typography>
          <Typography 
            variant="body1" 
            color="text.secondary" 
            sx={styles.description}
          >
            Monitor system performance, usage statistics, and key metrics in real-time
          </Typography>
        </Box>

        {isLoading && !error && (
          <Box sx={styles.loadingContainer}>
            <CircularProgress 
              size={40} 
              aria-label="Loading analytics data"
            />
          </Box>
        )}

        {error && (
          <Box sx={styles.errorContainer}>
            <Alert 
              severity="error" 
              variant="filled"
              role="alert"
              aria-live="assertive"
            >
              {error.message}
            </Alert>
          </Box>
        )}

        {!isLoading && !error && (
          <AnalyticsDashboard
            refreshInterval={refreshInterval}
            onExport={(format) => {
              console.log(`Exporting analytics data in ${format} format`);
              // TODO: Implement export functionality
            }}
          />
        )}
      </Box>
    </AdminLayout>
  );
};

// Styles object for component
const styles = {
  container: {
    padding: '24px',
    height: '100%',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  header: {
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '500',
    color: 'text.primary',
    lineHeight: 1.2
  },
  description: {
    fontSize: '16px',
    color: 'text.secondary',
    marginTop: '8px',
    maxWidth: '800px'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px'
  },
  errorContainer: {
    maxWidth: '800px',
    margin: '24px auto'
  }
} as const;

// Export enhanced component with error boundary
export default withErrorBoundary(AnalyticsPage, {
  FallbackComponent: ErrorFallback,
  onError: (error) => {
    console.error('Analytics Page Error:', error);
    // TODO: Add error reporting service integration
  }
});