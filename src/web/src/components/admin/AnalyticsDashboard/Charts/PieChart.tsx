import React, { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material'; // @mui/material@5.14.0
import {
  PieChart as RechartsChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer
} from 'recharts'; // recharts@2.7.0
import ContentLoader from '../../../common/Loaders/ContentLoader';

// Interface for pie chart data points
interface PieChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

// Props interface with comprehensive customization options
interface PieChartProps {
  data: PieChartDataPoint[];
  title: string;
  loading?: boolean;
  height?: number;
  minHeight?: number;
  colors?: string[];
  legendPosition?: 'right' | 'bottom';
  tooltipFormatter?: (value: number, total: number) => string;
  animate?: boolean;
}

// Default WCAG 2.1 AA compliant colors
const DEFAULT_COLORS = [
  '#0066CC', // Primary
  '#4CAF50', // Secondary
  '#17A2B8', // Info
  '#FFC107', // Warning
  '#DC3545', // Error
  '#6C757D'  // Text Secondary
];

// Memoized percentage formatter with internationalization support
const formatPercentage = (value: number, total: number, options: Intl.NumberFormatOptions = {}) => {
  if (!total) return '0%';
  const percentage = (value / total) * 100;
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    ...options
  }).format(percentage / 100);
};

const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  loading = false,
  height = 400,
  minHeight = 300,
  colors = DEFAULT_COLORS,
  legendPosition = 'right',
  tooltipFormatter,
  animate = true
}) => {
  const theme = useTheme();

  // Calculate total value for percentage calculations
  const total = useMemo(() => 
    data.reduce((sum, item) => sum + item.value, 0),
    [data]
  );

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldAnimate = animate && !prefersReducedMotion;

  // Custom tooltip content
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload;
    const percentage = tooltipFormatter 
      ? tooltipFormatter(data.value, total)
      : formatPercentage(data.value, total);

    return (
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          padding: theme.spacing(1),
          borderRadius: theme.shape.borderRadius,
          boxShadow: theme.shadows[2]
        }}
      >
        <Typography variant="body2" color="textPrimary">
          {data.name}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {percentage}
        </Typography>
      </Box>
    );
  };

  // Loading state
  if (loading) {
    return (
      <Box sx={{ width: '100%', height, minHeight }}>
        <ContentLoader
          height={height}
          ariaLabel={`Loading ${title} chart`}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height,
        minHeight,
        position: 'relative'
      }}
      role="region"
      aria-label={title}
    >
      <Typography
        variant="h6"
        component="h3"
        sx={{
          marginBottom: theme.spacing(2),
          color: theme.palette.text.primary
        }}
      >
        {title}
      </Typography>

      <ResponsiveContainer width="100%" height="100%">
        <RechartsChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="80%"
            innerRadius="55%"
            paddingAngle={2}
            isAnimationActive={shouldAnimate}
            animationDuration={1000}
            animationBegin={0}
            label={({ name, value }) => `${name}: ${formatPercentage(value, total)}`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || colors[index % colors.length]}
                stroke={theme.palette.background.paper}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            content={<CustomTooltip />}
            wrapperStyle={{ outline: 'none' }}
          />
          <Legend
            layout={legendPosition === 'bottom' ? 'horizontal' : 'vertical'}
            align={legendPosition === 'bottom' ? 'center' : 'right'}
            verticalAlign={legendPosition === 'bottom' ? 'bottom' : 'middle'}
            formatter={(value: string) => (
              <Typography
                variant="body2"
                component="span"
                color="textSecondary"
                sx={{ fontSize: '0.875rem' }}
              >
                {value}
              </Typography>
            )}
          />
        </RechartsChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default PieChart;