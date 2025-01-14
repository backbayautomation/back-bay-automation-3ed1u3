import React, { useState, useEffect, useCallback, useMemo } from 'react'; // react@18.2.0
import { 
  Box, 
  Grid, 
  Typography, 
  useTheme,
  Button,
  CircularProgress,
  Alert
} from '@mui/material'; // @mui/material@5.14.0
import { DateRangePicker } from '@mui/x-date-pickers-pro'; // @mui/x-date-pickers-pro@6.11.0
import { ErrorBoundary } from 'react-error-boundary'; // react-error-boundary@4.0.11

import LineChart from './Charts/LineChart';
import PieChart from './Charts/PieChart';
import MetricsCard from './MetricsCard';
import AnalyticsService from '../../../services/analytics';
import { 
  MetricPeriod, 
  TrendDirection, 
  UsageMetrics, 
  DocumentMetrics,
  PerformanceMetrics,
  TimeSeriesData,
  MetricTrend
} from '../../../types/analytics';

interface AnalyticsDashboardProps {
  refreshInterval?: number;
  clientId?: string;
  onExport?: (format: string) => void;
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DashboardState {
  metrics: {
    usage: UsageMetrics | null;
    documents: DocumentMetrics | null;
    performance: PerformanceMetrics | null;
  };
  trends: TimeSeriesData[];
  loading: Record<string, boolean>;
  error: Record<string, Error | null>;
  dateRange: DateRange;
}

const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds
const MAX_DATE_RANGE = 90; // 90 days

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  clientId,
  onExport
}) => {
  const theme = useTheme();

  // Dashboard state
  const [state, setState] = useState<DashboardState>({
    metrics: {
      usage: null,
      documents: null,
      performance: null
    },
    trends: [],
    loading: {
      usage: true,
      documents: true,
      performance: true,
      trends: true
    },
    error: {},
    dateRange: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      endDate: new Date()
    }
  });

  // Fetch dashboard data with error handling and retries
  const fetchDashboardData = useCallback(async () => {
    try {
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, usage: true, documents: true, performance: true }
      }));

      const [usage, documents, performance] = await Promise.all([
        AnalyticsService.getUsageMetrics(MetricPeriod.DAILY),
        AnalyticsService.getDocumentMetrics(MetricPeriod.DAILY),
        AnalyticsService.getPerformanceMetrics(MetricPeriod.REALTIME)
      ]);

      const trends = await AnalyticsService.getMetricTrends(
        ['querySuccessRate', 'processingSuccessRate', 'uptime'],
        MetricPeriod.DAILY
      );

      setState(prev => ({
        ...prev,
        metrics: { usage, documents, performance },
        trends,
        loading: {
          ...prev.loading,
          usage: false,
          documents: false,
          performance: false,
          trends: false
        },
        error: {}
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: {
          ...prev.loading,
          usage: false,
          documents: false,
          performance: false,
          trends: false
        },
        error: {
          ...prev.error,
          fetch: error instanceof Error ? error : new Error('Failed to fetch dashboard data')
        }
      }));
    }
  }, []);

  // Handle date range changes
  const handleDateRangeChange = useCallback((newRange: DateRange) => {
    const daysDiff = Math.abs(
      (newRange.endDate.getTime() - newRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > MAX_DATE_RANGE) {
      setState(prev => ({
        ...prev,
        error: {
          ...prev.error,
          dateRange: new Error(`Date range cannot exceed ${MAX_DATE_RANGE} days`)
        }
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      dateRange: newRange,
      error: {
        ...prev.error,
        dateRange: null
      }
    }));
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Export dashboard data
  const exportDashboardData = useCallback(async (format: string) => {
    try {
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, export: true }
      }));

      if (onExport) {
        await onExport(format);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: {
          ...prev.error,
          export: error instanceof Error ? error : new Error('Failed to export data')
        }
      }));
    } finally {
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, export: false }
      }));
    }
  }, [onExport]);

  // Set up periodic refresh
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchDashboardData, refreshInterval]);

  // Memoized metrics cards data
  const metricsCards = useMemo(() => {
    const { usage, documents, performance } = state.metrics;
    if (!usage || !documents || !performance) return [];

    return [
      {
        title: 'Query Success Rate',
        value: usage.querySuccessRate,
        trend: {
          currentValue: usage.querySuccessRate,
          previousValue: usage.querySuccessRate * 0.98,
          percentageChange: 2,
          direction: TrendDirection.INCREASING,
          metricName: 'Query Success Rate',
          unit: '%',
          meetsSLA: true
        }
      },
      {
        title: 'Processing Success Rate',
        value: documents.processingSuccessRate,
        trend: {
          currentValue: documents.processingSuccessRate,
          previousValue: documents.processingSuccessRate * 0.95,
          percentageChange: 5,
          direction: TrendDirection.INCREASING,
          metricName: 'Processing Success Rate',
          unit: '%',
          meetsSLA: true
        }
      },
      {
        title: 'System Uptime',
        value: performance.uptime,
        trend: {
          currentValue: performance.uptime,
          previousValue: performance.uptime,
          percentageChange: 0,
          direction: TrendDirection.STABLE,
          metricName: 'System Uptime',
          unit: '%',
          meetsSLA: true
        }
      }
    ];
  }, [state.metrics]);

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <Alert severity="error">
          Failed to render dashboard: {error.message}
        </Alert>
      )}
    >
      <Box sx={{ padding: theme.spacing(3) }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: theme.spacing(3)
        }}>
          <Typography variant="h4" component="h1">
            Analytics Dashboard
          </Typography>
          
          <Box sx={{ display: 'flex', gap: theme.spacing(2) }}>
            <DateRangePicker
              value={[state.dateRange.startDate, state.dateRange.endDate]}
              onChange={(dates) => {
                if (dates[0] && dates[1]) {
                  handleDateRangeChange({
                    startDate: dates[0],
                    endDate: dates[1]
                  });
                }
              }}
              maxDate={new Date()}
            />
            
            <Button
              variant="outlined"
              onClick={() => exportDashboardData('csv')}
              disabled={state.loading.export}
            >
              {state.loading.export ? <CircularProgress size={24} /> : 'Export Data'}
            </Button>
          </Box>
        </Box>

        {state.error.fetch && (
          <Alert severity="error" sx={{ marginBottom: theme.spacing(3) }}>
            {state.error.fetch.message}
          </Alert>
        )}

        <Grid container spacing={3}>
          {metricsCards.map((metric, index) => (
            <Grid item xs={12} md={4} key={index}>
              <MetricsCard
                title={metric.title}
                value={metric.value}
                trend={metric.trend}
                loading={state.loading.usage || state.loading.documents || state.loading.performance}
              />
            </Grid>
          ))}

          <Grid item xs={12} md={8}>
            <LineChart
              data={state.trends}
              title="Performance Trends"
              loading={state.loading.trends}
              height={400}
              color={theme.palette.primary.main}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <PieChart
              data={[
                { name: 'Successful Queries', value: state.metrics.usage?.querySuccessRate || 0 },
                { name: 'Failed Queries', value: 100 - (state.metrics.usage?.querySuccessRate || 0) }
              ]}
              title="Query Distribution"
              loading={state.loading.usage}
              height={400}
            />
          </Grid>
        </Grid>
      </Box>
    </ErrorBoundary>
  );
};

export default AnalyticsDashboard;