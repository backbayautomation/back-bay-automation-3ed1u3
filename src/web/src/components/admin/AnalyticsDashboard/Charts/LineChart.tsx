import React, { useMemo, useCallback } from 'react'; // react@18.2.0
import { Box, Typography, useTheme } from '@mui/material'; // @mui/material@5.14.0
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'; // recharts@2.7.0
import { ErrorBoundary } from 'react-error-boundary'; // react-error-boundary@4.0.11

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
      .map((item) => ({
        timestamp: item.timestamp,
        value: typeof item.value === 'number' ? item.value : 0,
        formattedDate: new Date(item.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
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
  }, [theme.palette.mode, theme.palette.primary, userColor]);
};

const ErrorFallback = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '16px',
      color: 'error.main',
    }}
  >
    <Typography variant="body2">
      An error occurred while rendering the chart. Please try again later.
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
  tooltipFormatter = (value: number) => value.toFixed(2),
}) => {
  const theme = useTheme();
  const formattedData = useFormattedData(data);
  const chartColor = useChartColor(color);

  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            padding: theme.spacing(1),
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: theme.shape.borderRadius,
          }}
        >
          <Typography variant="body2" color="textPrimary">
            {label}
          </Typography>
          <Typography variant="body2" color="primary">
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
        <ContentLoader
          height={height}
          ariaLabel={`Loading ${title} chart`}
        />
      </Box>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box
        sx={{
          width: '100%',
          minHeight: height,
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
        <ResponsiveContainer width="100%" height={height}>
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
              dataKey="formattedDate"
              stroke={theme.palette.text.secondary}
              tick={{ fill: theme.palette.text.secondary }}
              tickLine={{ stroke: theme.palette.divider }}
            />
            <YAxis
              stroke={theme.palette.text.secondary}
              tick={{ fill: theme.palette.text.secondary }}
              tickLine={{ stroke: theme.palette.divider }}
            />
            <Tooltip content={CustomTooltip} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2}
              dot={{ r: 4, fill: chartColor }}
              activeDot={{ r: 6, fill: chartColor }}
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