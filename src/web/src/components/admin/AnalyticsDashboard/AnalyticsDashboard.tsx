import React, { useState, useEffect, useCallback, useMemo } from 'react'; // v18.2.0
import {
  Grid,
  Box,
  Paper,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Button,
  useTheme,
  SelectChangeEvent,
} from '@mui/material'; // v5.14.0
import { DateRangePicker } from '@mui/x-date-pickers-pro'; // v6.11.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11
import { Download, Refresh } from '@mui/icons-material';

import LineChart from './Charts/LineChart';
import PieChart from './Charts/PieChart';
import MetricsCard from './MetricsCard';
import { analyticsService } from '../../../services/analytics';
import {
  AnalyticsDashboard as DashboardData,
  MetricPeriod,
  TimeSeriesData,
  TrendDirection,
  UsageMetrics,
  DocumentMetrics,
  PerformanceMetrics,
  MetricTrend
} from '../../../types/analytics';

interface AnalyticsDashboardProps {
  refreshInterval?: number;
  clientId?: string;
  onExport?: (format: string) => void;
}

interface DateRange {
  start: Date;
  end: Date;
}

interface DashboardState {
  metrics: {
    usage: UsageMetrics | null;
    documents: DocumentMetrics | null;
    performance: PerformanceMetrics | null;
  };
  trends: TimeSeriesData[];
  loading: {
    usage: boolean;
    documents: boolean;
    performance: boolean;
    trends: boolean;
  };
  error: {
    usage: Error | null;
    documents: Error | null;
    performance: Error | null;
    trends: Error | null;
  };
  dateRange: DateRange;
}

const DEFAULT_REFRESH_INTERVAL = 300000; // 5 minutes
const DEFAULT_DATE_RANGE: DateRange = {
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  end: new Date()
};

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  clientId,
  onExport
}) => {
  const theme = useTheme();
  const [period, setPeriod] = useState<MetricPeriod>(MetricPeriod.DAILY);
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
    error: {
      usage: null,
      documents: null,
      performance: null,
      trends: null
    },
    dateRange: DEFAULT_DATE_RANGE
  });

  const fetchDashboardData = useCallback(async () => {
    setState(prev => ({
      ...prev,
      loading: { usage: true, documents: true, performance: true, trends: true }
    }));

    try {
      const [usage, documents, performance, trends] = await Promise.all([
        analyticsService.getUsageMetrics(period),
        analyticsService.getDocumentMetrics(),
        analyticsService.getPerformanceMetrics(),
        analyticsService.getMetricTrends(
          ['queries', 'processing', 'response_time'],
          period
        )
      ]);

      setState(prev => ({
        ...prev,
        metrics: { usage, documents, performance },
        trends,
        loading: { usage: false, documents: false, performance: false, trends: false },
        error: { usage: null, documents: null, performance: null, trends: null }
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: { usage: false, documents: false, performance: false, trends: false },
        error: {
          usage: error as Error,
          documents: error as Error,
          performance: error as Error,
          trends: error as Error
        }
      }));
    }
  }, [period]);

  const handleDateRangeChange = useCallback((newRange: DateRange) => {
    setState(prev => ({ ...prev, dateRange: newRange }));
    // Trigger data refresh with new date range
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handlePeriodChange = useCallback((event: SelectChangeEvent<MetricPeriod>) => {
    setPeriod(event.target.value as MetricPeriod);
  }, []);

  const handleExport = useCallback(() => {
    if (onExport) {
      onExport('csv');
    }
  }, [onExport]);

  const handleRefresh = useCallback(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Set up automatic refresh interval
  useEffect(() => {
    const intervalId = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchDashboardData, refreshInterval]);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const renderErrorFallback = ({ error }: { error: Error }) => (
    <Paper
      sx={{
        p: 3,
        backgroundColor: theme.palette.error.light,
        color: theme.palette.error.contrastText
      }}
    >
      <Typography variant="h6">Error Loading Dashboard</Typography>
      <Typography variant="body1">{error.message}</Typography>
      <Button
        variant="contained"
        onClick={() => fetchDashboardData()}
        sx={{ mt: 2 }}
      >
        Retry
      </Button>
    </Paper>
  );

  return (
    <ErrorBoundary FallbackComponent={renderErrorFallback}>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Analytics Dashboard
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small">
              <Select
                value={period}
                onChange={handlePeriodChange}
                aria-label="Select time period"
              >
                <MenuItem value={MetricPeriod.DAILY}>Daily</MenuItem>
                <MenuItem value={MetricPeriod.WEEKLY}>Weekly</MenuItem>
                <MenuItem value={MetricPeriod.MONTHLY}>Monthly</MenuItem>
              </Select>
            </FormControl>
            <DateRangePicker
              value={[state.dateRange.start, state.dateRange.end]}
              onChange={(newValue) => {
                if (newValue[0] && newValue[1]) {
                  handleDateRangeChange({
                    start: newValue[0],
                    end: newValue[1]
                  });
                }
              }}
            />
            <Button
              startIcon={<Refresh />}
              onClick={handleRefresh}
              aria-label="Refresh dashboard"
            >
              Refresh
            </Button>
            <Button
              startIcon={<Download />}
              onClick={handleExport}
              aria-label="Export dashboard data"
            >
              Export
            </Button>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Key Metrics Cards */}
          <Grid item xs={12} container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricsCard
                title="Total Queries"
                value={state.metrics.usage?.totalQueries || 0}
                trend={{
                  currentValue: state.metrics.usage?.totalQueries || 0,
                  previousValue: 0,
                  percentageChange: 0,
                  direction: TrendDirection.STABLE,
                  metricName: 'queries',
                  unit: 'count',
                  meetsSLA: true
                }}
                loading={state.loading.usage}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricsCard
                title="Active Users"
                value={state.metrics.usage?.activeUsers || 0}
                trend={{
                  currentValue: state.metrics.usage?.activeUsers || 0,
                  previousValue: 0,
                  percentageChange: 0,
                  direction: TrendDirection.STABLE,
                  metricName: 'users',
                  unit: 'count',
                  meetsSLA: true
                }}
                loading={state.loading.usage}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricsCard
                title="Processing Queue"
                value={state.metrics.documents?.processingQueue || 0}
                trend={{
                  currentValue: state.metrics.documents?.processingQueue || 0,
                  previousValue: 0,
                  percentageChange: 0,
                  direction: TrendDirection.STABLE,
                  metricName: 'queue',
                  unit: 'count',
                  meetsSLA: true
                }}
                loading={state.loading.documents}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricsCard
                title="System Uptime"
                value={state.metrics.performance?.uptime || 0}
                trend={{
                  currentValue: state.metrics.performance?.uptime || 0,
                  previousValue: 0,
                  percentageChange: 0,
                  direction: TrendDirection.STABLE,
                  metricName: 'uptime',
                  unit: 'percentage',
                  meetsSLA: true
                }}
                loading={state.loading.performance}
              />
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <LineChart
                data={state.trends}
                title="System Metrics Trends"
                loading={state.loading.trends}
                height={400}
                ariaLabel="System metrics trends chart"
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <PieChart
                data={[
                  { name: 'Successful Queries', value: state.metrics.usage?.querySuccessRate || 0 },
                  { name: 'Failed Queries', value: 100 - (state.metrics.usage?.querySuccessRate || 0) }
                ]}
                title="Query Success Rate"
                loading={state.loading.usage}
                height={400}
                legendPosition="bottom"
              />
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </ErrorBoundary>
  );
};

export default AnalyticsDashboard;