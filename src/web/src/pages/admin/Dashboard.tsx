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
import { withErrorBoundary } from 'react-error-boundary';
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
    enableRequestTrackingTelemetry: true
  }
});
appInsights.loadAppInsights();

interface DashboardProps {
  refreshInterval?: number;
  enableRealtime?: boolean;
}

interface DashboardState {
  metrics: {
    activeClients: number;
    totalDocuments: number;
    processingQueue: number;
    systemUptime: number;
  };
  isLoading: boolean;
  error: Error | null;
}

const INITIAL_STATE: DashboardState = {
  metrics: {
    activeClients: 0,
    totalDocuments: 0,
    processingQueue: 0,
    systemUptime: 0
  },
  isLoading: true,
  error: null
};

const Dashboard: React.FC<DashboardProps> = ({
  refreshInterval = 30000,
  enableRealtime = true
}) => {
  const theme = useTheme();
  const { isAuthenticated, user } = useAuth();
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);

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
        clientId: user?.clientId
      }
    });
  }, [user]);

  // Handle real-time metric updates
  const handleMetricUpdate = useCallback((data: Partial<DashboardState['metrics']>) => {
    setState(prev => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        ...data
      }
    }));
  }, []);

  // Set up WebSocket listeners
  useEffect(() => {
    if (enableRealtime) {
      addListener('metrics.update', handleMetricUpdate);
      return () => removeListener('metrics.update', handleMetricUpdate);
    }
  }, [enableRealtime, addListener, removeListener, handleMetricUpdate]);

  // Error handler for child components
  const handleError = useCallback((error: Error) => {
    setState(prev => ({ ...prev, error }));
    appInsights.trackException({ error });
  }, []);

  // Styles
  const styles = {
    dashboard: {
      padding: theme.spacing(3),
      height: '100%',
      overflow: 'auto',
      position: 'relative' as const
    },
    title: {
      marginBottom: theme.spacing(2),
      color: theme.palette.text.primary
    },
    section: {
      marginBottom: theme.spacing(3),
      position: 'relative' as const
    },
    paper: {
      padding: theme.spacing(2),
      height: '100%',
      display: 'flex',
      flexDirection: 'column' as const
    },
    skeleton: {
      margin: theme.spacing(1, 0),
      borderRadius: theme.shape.borderRadius
    },
    error: {
      margin: theme.spacing(2, 0),
      padding: theme.spacing(2)
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <MainLayout portalType="admin">
      <Box sx={styles.dashboard}>
        {state.error && (
          <Alert 
            severity="error" 
            sx={styles.error}
            onClose={() => setState(prev => ({ ...prev, error: null }))}
          >
            {state.error.message}
          </Alert>
        )}

        <Typography variant="h4" component="h1" sx={styles.title}>
          Admin Dashboard
        </Typography>

        {!isConnected && enableRealtime && (
          <Alert severity="warning" sx={styles.error}>
            Real-time updates disconnected. Attempting to reconnect...
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={styles.paper}>
              <AnalyticsDashboard
                refreshInterval={refreshInterval}
                onError={handleError}
              />
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={styles.paper}>
              <ProcessingQueue
                refreshInterval={refreshInterval}
                autoRefresh={enableRealtime}
                onError={handleError}
              />
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </MainLayout>
  );
};

// Error boundary wrapper
const DashboardWithErrorBoundary = withErrorBoundary(Dashboard, {
  FallbackComponent: ({ error }) => (
    <Box p={3}>
      <Alert severity="error">
        <Typography variant="h6">Dashboard Error</Typography>
        <Typography variant="body2">{error.message}</Typography>
      </Alert>
    </Box>
  ),
  onError: (error) => {
    appInsights.trackException({ error });
    console.error('Dashboard Error:', error);
  }
});

export default DashboardWithErrorBoundary;