import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { withErrorBoundary } from 'react-error-boundary';
import { memo } from 'react';

import AdminLayout from '../../layouts/AdminLayout';
import AnalyticsDashboard from '../../components/admin/AnalyticsDashboard/AnalyticsDashboard';
import { useAuth } from '../../hooks/useAuth';

// Constants for analytics configuration
const REFRESH_INTERVAL = 60000; // 1 minute in milliseconds
const ERROR_MESSAGES = {
  LOAD_ERROR: 'Failed to load analytics data',
  REFRESH_ERROR: 'Error refreshing analytics data',
  AUTH_ERROR: 'You do not have permission to view analytics'
} as const;

// Interface for component props
interface AnalyticsPageProps {
  refreshInterval?: number;
  initialDateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * Analytics page component providing comprehensive system metrics and performance indicators
 * with real-time updates and accessibility features.
 */
const AnalyticsPage: React.FC<AnalyticsPageProps> = memo(({
  refreshInterval = REFRESH_INTERVAL,
  initialDateRange
}) => {
  // Authentication and authorization
  const { isAuthenticated, hasRole } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle data export
  const handleExport = useCallback(async (format: string) => {
    try {
      // Analytics export logic will be implemented here
      console.info('Exporting analytics data in format:', format);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to export data');
    }
  }, []);

  // Verify admin access
  useEffect(() => {
    if (!isAuthenticated || !hasRole('admin')) {
      setError(ERROR_MESSAGES.AUTH_ERROR);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, hasRole]);

  // Error handling for the entire page
  if (error) {
    return (
      <AdminLayout>
        <Box
          sx={{
            padding: '24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Alert 
            severity="error"
            sx={{ maxWidth: '800px' }}
            role="alert"
          >
            {error}
          </Alert>
        </Box>
      </AdminLayout>
    );
  }

  // Loading state
  if (isLoading) {
    return (
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
          <CircularProgress size={40} />
          <Typography variant="body1" color="textSecondary">
            Loading analytics dashboard...
          </Typography>
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box
        sx={{
          padding: '24px',
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}
      >
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
              fontWeight: 500,
              color: 'text.primary',
              lineHeight: 1.2
            }}
          >
            Analytics Dashboard
          </Typography>
          <Typography
            variant="body1"
            color="textSecondary"
            sx={{
              fontSize: '16px',
              maxWidth: '800px'
            }}
          >
            Monitor system performance, usage statistics, and document processing metrics
            in real-time with comprehensive analytics and trend analysis.
          </Typography>
        </Box>

        <AnalyticsDashboard
          refreshInterval={refreshInterval}
          onExport={handleExport}
          initialDateRange={initialDateRange}
        />
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
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Alert 
          severity="error"
          sx={{ maxWidth: '800px' }}
          role="alert"
        >
          {ERROR_MESSAGES.LOAD_ERROR}: {error.message}
        </Alert>
      </Box>
    </AdminLayout>
  ),
  onError: (error) => {
    console.error('Analytics Page Error:', error);
  }
});

// Set display name for debugging
AnalyticsPageWithErrorBoundary.displayName = 'AnalyticsPage';

export default AnalyticsPageWithErrorBoundary;