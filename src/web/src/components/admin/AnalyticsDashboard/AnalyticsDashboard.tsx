import React, { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.2.0
import { 
  Grid, 
  Box, 
  Paper,
  Typography,
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material'; // ^5.14.0
import { DateRangePicker } from '@mui/x-date-pickers-pro'; // ^6.11.0
import { 
  FileDownload as ExportIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material'; // ^5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.11

import LineChart from './Charts/LineChart';
import PieChart from './Charts/PieChart';
import MetricsCard from './MetricsCard';
import { analyticsService } from '../../../services/analytics';
import { 
  AnalyticsDashboard as DashboardData,
  MetricPeriod,
  TrendDirection,
  TimeSeriesData,
  MetricTrend
} from '../../../types/analytics';
import ContentLoader from '../../common/Loaders/ContentLoader';

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
  data: DashboardData | null;
  loading: boolean;
  error: Error | null;
  dateRange: DateRange;
  period: MetricPeriod;
}

const DEFAULT_REFRESH_INTERVAL = 300000; // 5 minutes
const DEFAULT_DATE_RANGE = {
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  endDate: new Date()
};

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  clientId,
  onExport
}) => {
  const theme = useTheme();
  const [state, setState] = useState<DashboardState>({
    data: null,
    loading: true,
    error: null,
    dateRange: DEFAULT_DATE_RANGE,
    period: MetricPeriod.DAILY
  });

  // Fetch dashboard data with error handling
  const fetchDashboardData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const dashboard = await analyticsService.getDashboardMetrics();
      setState(prev => ({ ...prev, data: dashboard, loading: false }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error as Error, 
        loading: false 
      }));
    }
  }, []);

  // Handle date range changes
  const handleDateRangeChange = useCallback((newRange: DateRange) => {
    setState(prev => ({ ...prev, dateRange: newRange }));
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle period changes
  const handlePeriodChange = useCallback((event: React.ChangeEvent<{ value: unknown }>) => {
    setState(prev => ({ ...prev, period: event.target.value as MetricPeriod }));
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle data export
  const handleExport = useCallback(() => {
    if (state.data && onExport) {
      onExport('csv');
    }
  }, [state.data, onExport]);

  // Set up automatic refresh interval
  useEffect(() => {
    const intervalId = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(intervalId);
  }, [fetchDashboardData, refreshInterval]);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Memoized metrics cards data
  const metricsCards = useMemo(() => {
    if (!state.data) return [];
    
    return [
      {
        title: 'Total Queries',
        value: state.data.usage.totalQueries,
        trend: state.data.keyMetrics.find(m => m.metricName === 'totalQueries') as MetricTrend
      },
      {
        title: 'Active Users',
        value: state.data.usage.activeUsers,
        trend: state.data.keyMetrics.find(m => m.metricName === 'activeUsers') as MetricTrend
      },
      {
        title: 'Processing Queue',
        value: state.data.documents.processingQueue,
        trend: state.data.keyMetrics.find(m => m.metricName === 'processingQueue') as MetricTrend
      },
      {
        title: 'System Uptime',
        value: state.data.performance.uptime,
        trend: state.data.keyMetrics.find(m => m.metricName === 'uptime') as MetricTrend
      }
    ];
  }, [state.data]);

  if (state.error) {
    return (
      <Paper 
        sx={{ p: 3, textAlign: 'center', color: 'error.main' }}
        role="alert"
      >
        <Typography variant="h6">Error loading dashboard</Typography>
        <Typography variant="body2">{state.error.message}</Typography>
      </Paper>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <Paper sx={{ p: 3, textAlign: 'center', color: 'error.main' }}>
          <Typography variant="h6">Dashboard Error</Typography>
          <Typography variant="body2">{error.message}</Typography>
        </Paper>
      )}
    >
      <Box sx={{ p: 3 }}>
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 3 
          }}
        >
          <Typography variant="h5" component="h1">Analytics Dashboard</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small">
              <DateRangePicker
                value={state.dateRange}
                onChange={handleDateRangeChange}
                renderInput={(startProps, endProps) => (
                  <>
                    <input {...startProps} />
                    <Box sx={{ mx: 1 }}>to</Box>
                    <input {...endProps} />
                  </>
                )}
              />
            </FormControl>
            <FormControl size="small">
              <Select
                value={state.period}
                onChange={handlePeriodChange}
                aria-label="Select time period"
              >
                {Object.values(MetricPeriod).map(period => (
                  <MenuItem key={period} value={period}>
                    {period.toLowerCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Refresh data">
              <IconButton 
                onClick={fetchDashboardData}
                aria-label="Refresh dashboard data"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export data">
              <IconButton 
                onClick={handleExport}
                aria-label="Export dashboard data"
                disabled={!state.data}
              >
                <ExportIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {metricsCards.map((metric, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <MetricsCard
                title={metric.title}
                value={metric.value}
                trend={metric.trend}
                loading={state.loading}
              />
            </Grid>
          ))}

          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <LineChart
                data={state.data?.trends || []}
                title="Performance Trends"
                loading={state.loading}
                height={400}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <PieChart
                data={[
                  { name: 'Success', value: state.data?.usage.querySuccessRate || 0 },
                  { name: 'Error', value: 100 - (state.data?.usage.querySuccessRate || 0) }
                ]}
                title="Query Success Rate"
                loading={state.loading}
                height={400}
              />
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </ErrorBoundary>
  );
};

export default AnalyticsDashboard;