import React, { useMemo, useCallback } from 'react'; // ^18.2.0
import { Box, Typography, useTheme } from '@mui/material'; // ^5.14.0
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'; // ^2.7.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.11

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

interface FormattedChartData {
  timestamp: string;
  value: number;
  formattedDate: string;
}

const useFormattedData = (data: TimeSeriesData[]): FormattedChartData[] => {
  return useMemo(() => {
    return data
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(point => ({
        timestamp: point.timestamp,
        value: typeof point.value === 'number' ? point.value : 0,
        formattedDate: new Date(point.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      }));
  }, [data]);
};

const useChartColor = (userColor?: string) => {
  const theme = useTheme();
  return useMemo(() => (
    userColor || theme.palette.primary.main
  ), [theme.palette.primary.main, userColor]);
};

const ErrorFallback = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: 2,
      color: 'error.main'
    }}
  >
    <Typography variant="body2">
      Error loading chart. Please try again later.
    </Typography>
  </Box>
);

const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  loading = false,
  height = 300,
  color,
  ariaLabel = 'Time series line chart',
  animate = true,
  tooltipFormatter = (value: number) => value.toFixed(2)
}) => {
  const theme = useTheme();
  const formattedData = useFormattedData(data);
  const chartColor = useChartColor(color);

  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          p: 1.5,
          boxShadow: theme.shadows[2]
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body1" color="text.primary" fontWeight="medium">
          {tooltipFormatter(payload[0].value)}
        </Typography>
      </Box>
    );
  }, [theme, tooltipFormatter]);

  if (loading) {
    return (
      <Box sx={{ width: '100%', height }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {title}
        </Typography>
        <ContentLoader height={height - 40} ariaLabel={`Loading ${title} chart`} />
      </Box>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box
        sx={{
          width: '100%',
          height,
          p: 2,
          position: 'relative'
        }}
      >
        <Typography
          variant="h6"
          sx={{
            mb: 2,
            fontWeight: 500,
            color: 'text.primary'
          }}
        >
          {title}
        </Typography>
        <ResponsiveContainer width="100%" height={height - 40}>
          <RechartsLineChart
            data={formattedData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            role="img"
            aria-label={ariaLabel}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme.palette.divider}
            />
            <XAxis
              dataKey="formattedDate"
              tick={{ fill: theme.palette.text.secondary }}
              tickLine={{ stroke: theme.palette.divider }}
              axisLine={{ stroke: theme.palette.divider }}
            />
            <YAxis
              tick={{ fill: theme.palette.text.secondary }}
              tickLine={{ stroke: theme.palette.divider }}
              axisLine={{ stroke: theme.palette.divider }}
            />
            <Tooltip
              content={CustomTooltip}
              cursor={{ stroke: theme.palette.divider }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2}
              dot={{ r: 3, fill: chartColor }}
              activeDot={{ r: 5, fill: chartColor }}
              isAnimationActive={animate}
              animationDuration={1000}
              animationEasing="ease-in-out"
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </Box>
    </ErrorBoundary>
  );
};

export default LineChart;