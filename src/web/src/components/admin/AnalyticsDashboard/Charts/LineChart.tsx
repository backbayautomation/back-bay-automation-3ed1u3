import React, { useMemo, useCallback } from 'react'; // v18.2.0
import { Box, Typography, useTheme } from '@mui/material'; // v5.14.0
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'; // v2.7.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

import { TimeSeriesData } from '../../../../types/analytics';
import ContentLoader from '../../../common/Loaders/ContentLoader';

interface LineChartProps {
  data: TimeSeriesData[];
  title: string;
  loading?: boolean;
  height?: number;
  color?: string;
  ariaLabel?: string;
  animate?: boolean;
  tooltipFormatter?: (value: number) => string;
}

const useFormattedData = (data: TimeSeriesData[]) => {
  return useMemo(() => {
    return data
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(point => ({
        timestamp: new Date(point.timestamp).toLocaleDateString(),
        value: typeof point.value === 'number' ? point.value : 0,
        metricName: point.metricName,
      }));
  }, [data]);
};

const useChartColor = (userColor?: string) => {
  const theme = useTheme();
  return useMemo(() => {
    if (userColor) return userColor;
    return theme.palette.mode === 'light' 
      ? theme.palette.primary.main 
      : theme.palette.primary.light;
  }, [theme.palette.mode, userColor, theme.palette.primary]);
};

const ErrorFallback = ({ error }: { error: Error }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: 2,
      color: 'error.main',
    }}
  >
    <Typography variant="body2">Error loading chart: {error.message}</Typography>
  </Box>
);

const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  loading = false,
  height = 300,
  color,
  ariaLabel = 'Analytics line chart',
  animate = true,
  tooltipFormatter = (value: number) => value.toFixed(2),
}) => {
  const theme = useTheme();
  const formattedData = useFormattedData(data);
  const chartColor = useChartColor(color);

  const renderTooltip = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            padding: 1.5,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            boxShadow: theme.shadows[2],
          }}
        >
          <Typography variant="body2" color="text.primary">
            {label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Value: {tooltipFormatter(payload[0].value)}
          </Typography>
        </Box>
      );
    }
    return null;
  }, [theme, tooltipFormatter]);

  if (loading) {
    return (
      <Box sx={{ width: '100%', height }}>
        <ContentLoader height={height} ariaLabel={`Loading ${title} chart`} />
      </Box>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box
        sx={{
          width: '100%',
          height,
          padding: 2,
          position: 'relative',
        }}
      >
        <Typography
          variant="h6"
          sx={{
            marginBottom: 2,
            fontWeight: 500,
            color: theme.palette.text.primary,
          }}
        >
          {title}
        </Typography>
        <ResponsiveContainer width="100%" height={height - 60}>
          <RechartsLineChart
            data={formattedData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            role="img"
            aria-label={ariaLabel}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme.palette.divider}
            />
            <XAxis
              dataKey="timestamp"
              stroke={theme.palette.text.secondary}
              tick={{ fill: theme.palette.text.secondary }}
            />
            <YAxis
              stroke={theme.palette.text.secondary}
              tick={{ fill: theme.palette.text.secondary }}
            />
            <Tooltip content={renderTooltip} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2}
              dot={{ r: 4, fill: chartColor }}
              activeDot={{ r: 6 }}
              isAnimationActive={animate}
              animationDuration={1500}
              animationEasing="ease-in-out"
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </Box>
    </ErrorBoundary>
  );
};

export default LineChart;