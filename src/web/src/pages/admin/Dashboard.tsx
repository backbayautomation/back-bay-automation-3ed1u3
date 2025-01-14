import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Grid,
  Box,
  Typography,
  Paper,
  Skeleton,
  Alert,
  useTheme
} from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

import MainLayout from '../../components/common/Layout/MainLayout';
import AnalyticsDashboard from '../../components/admin/AnalyticsDashboard/AnalyticsDashboard';
import ProcessingQueue from '../../components/admin/DocumentProcessing/ProcessingQueue';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';

// Initialize Application Insights
const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.VITE_APPINSIGHTS_CONNECTION_STRING,
    enableAutoRouteTracking: true,
    enableCorsCorrelation: true,
    enableRequestHeaderTracking: true,
    enableResponseHeaderTracking: true
  }
});
appInsights.loadAppInsights();

interface DashboardProps {
  refreshInterval?: number;
  enableRealtime?: boolean;
}

interface DashboardState {
  metrics: {
    usage: number;
    documents: number;
    performance: number;
  };
  isLoading: boolean;
  error: Error | null;
}

const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds

const Dashboard: React.FC<DashboardProps> = ({
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  enableRealtime = true
}) => {
  const theme = useTheme();
  const { isAuthenticated, user } = useAuth();
  const [state, setState] = useState<DashboardState>({
    metrics: {
      usage: 0,
      documents: 0,
      performance: 0
    },
    isLoading: true,
    error: null
  });

  // WebSocket connection for real-time updates
  const { isConnected, addListener, removeListener } = useWebSocket({
    baseUrl: `${process.env.VITE_WS_URL}/admin`,
    autoConnect: enableRealtime,
    monitoringEnabled: true
  });

  // Track page view
  useEffect(() => {
    appInsights.trackPageView({
      name: 'Admin Dashboard',
      properties: {
        userId: user?.id,
        orgId: user?.orgId
      }
    });
  }, [user]);

  // Handle real-time metric updates
  const handleMetricUpdate = useCallback((update: any) => {
    setState(prev => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        [update.type]: update.value
      }
    }));
  }, []);

  // Set up WebSocket listeners
  useEffect(() => {
    if (enableRealtime) {
      addListener('metrics.update', handleMetricUpdate);
      return () => {
        removeListener('metrics.update', handleMetricUpdate);
      };
    }
  }, [enableRealtime, addListener, removeListener, handleMetricUpdate]);

  // Error boundary fallback
  const ErrorFallback = ({ error }: { error: Error }) => (
    <Alert 
      severity="error"
      sx={{ margin: theme.spacing(2) }}
    >
      <Typography variant="h6">Dashboard Error</Typography>
      <Typography variant="body2">{error.message}</Typography>
    </Alert>
  );

  // Loading skeleton
  const LoadingSkeleton = () => (
    <Box sx={{ padding: theme.spacing(3) }}>
      <Grid container spacing={3}>
        {[1, 2, 3].map((item) => (
          <Grid item xs={12} md={4} key={item}>
            <Paper sx={{ p: 2 }}>
              <Skeleton variant="rectangular" height={200} />
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // Memoized dashboard content
  const DashboardContent = useMemo(() => (
    <Box sx={{ padding: theme.spacing(3) }}>
      {!isConnected && enableRealtime && (
        <Alert 
          severity="warning" 
          sx={{ marginBottom: theme.spacing(2) }}
        >
          Real-time updates are currently unavailable
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <AnalyticsDashboard
              refreshInterval={refreshInterval}
              onExport={(format) => {
                appInsights.trackEvent({
                  name: 'ExportAnalytics',
                  properties: { format }
                });
              }}
            />
          </ErrorBoundary>
        </Grid>

        <Grid item xs={12}>
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <ProcessingQueue
              refreshInterval={refreshInterval}
              autoRefresh={enableRealtime}
              onProcessingComplete={(document) => {
                appInsights.trackEvent({
                  name: 'DocumentProcessed',
                  properties: { documentId: document.id }
                });
              }}
              onError={(error) => {
                appInsights.trackException({
                  error,
                  severityLevel: 2
                });
              }}
            />
          </ErrorBoundary>
        </Grid>
      </Grid>
    </Box>
  ), [isConnected, enableRealtime, refreshInterval, theme]);

  if (!isAuthenticated) {
    return (
      <Alert 
        severity="error"
        sx={{ margin: theme.spacing(2) }}
      >
        Authentication required to access the dashboard
      </Alert>
    );
  }

  return (
    <MainLayout
      portalType="admin"
      analyticsEnabled={true}
    >
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        {state.isLoading ? <LoadingSkeleton /> : DashboardContent}
      </ErrorBoundary>
    </MainLayout>
  );
};

// Add display name for debugging
Dashboard.displayName = 'AdminDashboard';

export default React.memo(Dashboard);