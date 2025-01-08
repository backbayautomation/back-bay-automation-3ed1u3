import React, { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import {
  PieChart as RechartsChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import ContentLoader from '../../../common/Loaders/ContentLoader';

// Interface for individual data point
interface DataPoint {
  name: string;
  value: number;
  color?: string;
}

// Props interface with comprehensive customization options
interface PieChartProps {
  data: DataPoint[];
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
  '#3385D6', // Primary Light
  '#6FBF73', // Secondary Light
  '#31B0C6'  // Info Light
];

// Memoized percentage formatter with internationalization support
const formatPercentage = (value: number, total: number, options: Intl.NumberFormatOptions = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
}): string => {
  if (!total) return '0%';
  const percentage = (value / total) * 100;
  return new Intl.NumberFormat(undefined, options).format(percentage) + '%';
};

const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  loading = false,
  height = 400,
  minHeight = 300,
  colors = DEFAULT_COLORS,
  legendPosition = 'right',
  tooltipFormatter = formatPercentage,
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

  // Loading state
  if (loading) {
    return (
      <Box sx={styles.chartContainer}>
        <ContentLoader
          height={height}
          ariaLabel={`Loading ${title} chart`}
        />
      </Box>
    );
  }

  // Empty state
  if (!data.length) {
    return (
      <Box sx={styles.chartContainer}>
        <Typography variant="body1" color="textSecondary" align="center">
          No data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        ...styles.chartContainer,
        minHeight: `${minHeight}px`
      }}
      role="region"
      aria-label={title}
    >
      <Typography
        variant="h6"
        component="h3"
        sx={styles.title}
      >
        {title}
      </Typography>

      <ResponsiveContainer width="100%" height={height}>
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
            label={({ name, value }) => `${name}: ${tooltipFormatter(value, total)}`}
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
            content={({ payload }) => {
              if (!payload?.[0]) return null;
              const { name, value } = payload[0].payload;
              return (
                <Box sx={styles.tooltip}>
                  <Typography variant="body2">
                    {name}: {tooltipFormatter(value, total)}
                  </Typography>
                </Box>
              );
            }}
          />

          <Legend
            layout={legendPosition === 'bottom' ? 'horizontal' : 'vertical'}
            align={legendPosition === 'bottom' ? 'center' : 'right'}
            verticalAlign={legendPosition === 'bottom' ? 'bottom' : 'middle'}
            formatter={(value, entry) => (
              <Typography
                variant="body2"
                component="span"
                sx={styles.legend}
              >
                {value}
              </Typography>
            )}
            wrapperStyle={{
              paddingTop: legendPosition === 'bottom' ? '16px' : '0',
              paddingLeft: legendPosition === 'right' ? '16px' : '0'
            }}
          />
        </RechartsChart>
      </ResponsiveContainer>
    </Box>
  );
};

// Styles with theme integration
const styles = {
  chartContainer: {
    width: '100%',
    position: 'relative',
    padding: '16px',
    '&:focus-within': {
      outline: '2px solid',
      outlineColor: 'primary.main',
      outlineOffset: '2px'
    }
  },
  title: {
    marginBottom: '16px',
    fontWeight: 500,
    color: 'text.primary'
  },
  legend: {
    fontSize: '12px',
    color: 'text.secondary',
    '&:focus': {
      outline: '2px solid',
      outlineColor: 'primary.main'
    }
  },
  tooltip: {
    backgroundColor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
    padding: '8px',
    borderRadius: '4px',
    boxShadow: 1
  }
};

export default React.memo(PieChart);