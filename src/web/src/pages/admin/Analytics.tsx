import React, { useCallback, useState, useEffect } from 'react';
import { withErrorBoundary } from 'react-error-boundary';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import AdminLayout from '../../layouts/AdminLayout';
import AnalyticsDashboard from '../../components/admin/AnalyticsDashboard/AnalyticsDashboard';

// Constants for analytics configuration
const REFRESH_INTERVAL = 60000; // 1 minute in milliseconds
const ERROR_MESSAGES = {
  LOAD_ERROR: 'Failed to load analytics data. Please try again.',
  REFRESH_ERROR: 'Error refreshing analytics data. Data may be stale.',
};

// Interface for component props
interface AnalyticsPageProps {
  refreshInterval?: number;
  initialDateRange?: {
    start: Date;
    end: Date;
  };
}

// Analytics page component with error boundary and performance optimization
const AnalyticsPage: React.FC<AnalyticsPageProps> = React.memo(({
  refreshInterval = REFRESH_INTERVAL,
  initialDateRange
}) => {
  // State management
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Handle data export
  const handleExport = useCallback((format: string) => {
    try {
      // Analytics tracking for export action
      window.gtag?.('event', 'analytics_export', {
        format,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Export error:', error);
      setError('Failed to export analytics data');
    }
  }, []);

  // Effect for initial loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Error handling callback
  const handleError = useCallback((error: Error) => {
    setError(error.message);
    // Log error to monitoring service
    console.error('Analytics Error:', error);
    window.gtag?.('event', 'analytics_error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }, []);

  return (
    <AdminLayout>
      <Box
        component="main"
        role="main"
        aria-label="Analytics Dashboard"
        sx={{
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          padding: '24px',
          backgroundColor: 'background.default'
        }}
      >
        {/* Header Section */}
        <Box
          sx={{
            marginBottom: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontSize: '24px',
              fontWeight: '500',
              color: 'text.primary',
              lineHeight: 1.2
            }}
          >
            Analytics Dashboard
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontSize: '16px',
              color: 'text.secondary',
              marginTop: '8px',
              maxWidth: '800px'
            }}
          >
            Monitor system performance, usage statistics, and document processing metrics in real-time.
          </Typography>
        </Box>

        {/* Error Display */}
        {error && (
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
            sx={{ maxWidth: '800px', margin: '24px auto' }}
          >
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {isLoading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '200px'
            }}
          >
            <CircularProgress 
              aria-label="Loading analytics data"
              size={40}
            />
          </Box>
        ) : (
          // Analytics Dashboard Component
          <AnalyticsDashboard
            refreshInterval={refreshInterval}
            onExport={handleExport}
          />
        )}
      </Box>
    </AdminLayout>
  );
});

// Error boundary wrapper for the analytics page
const AnalyticsPageWithErrorBoundary = withErrorBoundary(AnalyticsPage, {
  FallbackComponent: ({ error }) => (
    <AdminLayout>
      <Box
        sx={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <Typography variant="h5" color="error">
          Error Loading Analytics
        </Typography>
        <Typography variant="body1">
          {error.message || ERROR_MESSAGES.LOAD_ERROR}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please refresh the page or contact support if the problem persists.
        </Typography>
      </Box>
    </AdminLayout>
  ),
  onError: (error) => {
    console.error('Analytics Page Error:', error);
    // Log to monitoring service
    window.gtag?.('event', 'analytics_page_error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Display name for debugging
AnalyticsPageWithErrorBoundary.displayName = 'AnalyticsPage';

export default AnalyticsPageWithErrorBoundary;