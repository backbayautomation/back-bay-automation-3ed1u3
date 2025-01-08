import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Grid, Box, Paper, Typography, Alert, Skeleton } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

import MainLayout from '../../components/common/Layout/MainLayout';
import AnalyticsDashboard from '../../components/admin/AnalyticsDashboard/AnalyticsDashboard';
import ProcessingQueue from '../../components/admin/DocumentProcessing/ProcessingQueue';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';

// Constants for dashboard configuration
const REFRESH_INTERVAL = 300000; // 5 minutes
const WS_BASE_URL = process.env.VITE_WS_URL || 'wss://api.example.com';

// Initialize Application Insights
const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.VITE_APPINSIGHTS_CONNECTION_STRING,
    enableAutoRouteTracking: true,
    enableCorsCorrelation: true,
    enableRequestTrackingTelemetry: true
  }
});

interface DashboardProps {
  refreshInterval?: number;
  enableRealtime?: boolean;
}

interface DashboardState {
  error: Error | null;
  isLoading: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({
  refreshInterval = REFRESH_INTERVAL,
  enableRealtime = true
}) => {
  const { isAuthenticated, user } = useAuth();
  const [state, setState] = useState<DashboardState>({
    error: null,
    isLoading: true
  });

  // Initialize WebSocket connection for real-time updates
  const { addListener, removeListener } = useWebSocket({
    baseUrl: WS_BASE_URL,
    autoConnect: enableRealtime,
    monitoringEnabled: true
  });

  // Handle real-time updates
  const handleRealtimeUpdate = useCallback((data: any) => {
    // Track telemetry for real-time updates
    appInsights.trackEvent({
      name: 'DashboardRealtimeUpdate',
      properties: {
        userId: user?.id,
        updateType: data.type,
        timestamp: new Date().toISOString()
      }
    });
  }, [user]);

  // Set up WebSocket listeners
  useEffect(() => {
    if (enableRealtime) {
      addListener('dashboard.update', handleRealtimeUpdate);
      
      return () => {
        removeListener('dashboard.update', handleRealtimeUpdate);
      };
    }
  }, [enableRealtime, addListener, removeListener, handleRealtimeUpdate]);

  // Initialize Application Insights
  useEffect(() => {
    appInsights.loadAppInsights();
    appInsights.trackPageView({
      name: 'Admin Dashboard',
      uri: window.location.pathname
    });
  }, []);

  // Error handler for child components
  const handleError = useCallback((error: Error) => {
    setState(prev => ({ ...prev, error }));
    appInsights.trackException({
      error,
      severityLevel: 2,
      properties: {
        component: 'AdminDashboard',
        userId: user?.id
      }
    });
  }, [user]);

  // Memoized error fallback component
  const ErrorFallback = useMemo(() => {
    return ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          onClose={resetErrorBoundary}
          sx={{ mb: 2 }}
        >
          {error.message}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Please try refreshing the page or contact support if the issue persists.
        </Typography>
      </Box>
    );
  }, []);

  // Loading state component
  const LoadingSkeleton = () => (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Skeleton variant="rectangular" height={400} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton variant="rectangular" height={400} />
        </Grid>
      </Grid>
    </Box>
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <MainLayout portalType="admin">
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error) => {
          handleError(error);
          appInsights.trackException({ error });
        }}
      >
        <Box
          sx={{
            p: 3,
            height: '100%',
            overflow: 'auto',
            backgroundColor: 'background.default'
          }}
        >
          {state.error && (
            <Alert 
              severity="error" 
              onClose={() => setState(prev => ({ ...prev, error: null }))}
              sx={{ mb: 3 }}
            >
              {state.error.message}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Analytics Dashboard Section */}
            <Grid item xs={12}>
              <Paper 
                elevation={2}
                sx={{ 
                  p: 2,
                  height: '100%',
                  backgroundColor: 'background.paper'
                }}
              >
                <AnalyticsDashboard
                  refreshInterval={refreshInterval}
                  onExport={(format) => {
                    appInsights.trackEvent({
                      name: 'DashboardExport',
                      properties: { format, userId: user?.id }
                    });
                  }}
                />
              </Paper>
            </Grid>

            {/* Processing Queue Section */}
            <Grid item xs={12}>
              <Paper 
                elevation={2}
                sx={{ 
                  p: 2,
                  height: '100%',
                  backgroundColor: 'background.paper'
                }}
              >
                <ProcessingQueue
                  refreshInterval={refreshInterval}
                  autoRefresh={enableRealtime}
                  onProcessingComplete={(document) => {
                    appInsights.trackEvent({
                      name: 'DocumentProcessingComplete',
                      properties: {
                        documentId: document.id,
                        userId: user?.id
                      }
                    });
                  }}
                  onError={handleError}
                />
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </ErrorBoundary>
    </MainLayout>
  );
};

export default React.memo(Dashboard);