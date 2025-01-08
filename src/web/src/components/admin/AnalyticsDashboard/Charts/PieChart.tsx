import React, { useMemo } from 'react'; // ^18.2.0
import { Box, Typography, useTheme } from '@mui/material'; // ^5.14.0
import { PieChart as RechartsChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'; // ^2.7.0
import ContentLoader from '../../../common/Loaders/ContentLoader';

interface PieChartProps {
  data: Array<{ name: string; value: number; color?: string }>;
  title: string;
  loading?: boolean;
  height?: number;
  minHeight?: number;
  colors?: string[];
  legendPosition?: 'right' | 'bottom';
  tooltipFormatter?: (value: number, total: number) => string;
  animate?: boolean;
}

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
  colors = ['#0066CC', '#4CAF50', '#FFC107', '#DC3545', '#17A2B8'],
  legendPosition = 'right',
  tooltipFormatter,
  animate = true
}) => {
  const theme = useTheme();

  // Calculate total for percentage calculations
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shouldAnimate = animate && !prefersReducedMotion;

  if (loading) {
    return (
      <Box sx={{ width: '100%', height, minHeight }} role="progressbar" aria-busy="true">
        <ContentLoader height={height} ariaLabel="Loading chart data..." />
      </Box>
    );
  }

  const defaultTooltipFormatter = (value: number) => {
    return formatPercentage(value, total);
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, index }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percentage = formatPercentage(value, total);

    return (
      <text
        x={x}
        y={y}
        fill={theme.palette.background.paper}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: '12px', fontWeight: 500 }}
      >
        {percentage}
      </text>
    );
  };

  return (
    <Box
      sx={{
        width: '100%',
        height,
        minHeight,
        padding: 2,
        position: 'relative'
      }}
      role="region"
      aria-label={title}
    >
      <Typography
        variant="h6"
        component="h3"
        sx={{
          marginBottom: 2,
          fontWeight: 500,
          color: theme.palette.text.primary
        }}
      >
        {title}
      </Typography>

      <ResponsiveContainer width="100%" height="100%">
        <RechartsChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius="80%"
            innerRadius="50%"
            dataKey="value"
            isAnimationActive={shouldAnimate}
            animationDuration={1000}
            animationBegin={0}
            onMouseEnter={(_, index) => {
              // Accessibility: Announce segment on hover
              const segment = data[index];
              const percentage = formatPercentage(segment.value, total);
              const announcement = `${segment.name}: ${percentage}`;
              const liveRegion = document.getElementById('chart-live-region');
              if (liveRegion) {
                liveRegion.textContent = announcement;
              }
            }}
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
              if (!payload || !payload[0]) return null;
              const value = payload[0].value as number;
              const name = payload[0].name as string;
              const formattedValue = tooltipFormatter
                ? tooltipFormatter(value, total)
                : defaultTooltipFormatter(value);

              return (
                <Box
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    padding: 1,
                    borderRadius: 1
                  }}
                >
                  <Typography variant="body2" color="textPrimary">
                    {name}: {formattedValue}
                  </Typography>
                </Box>
              );
            }}
          />
          <Legend
            layout={legendPosition === 'bottom' ? 'horizontal' : 'vertical'}
            align={legendPosition === 'bottom' ? 'center' : 'right'}
            verticalAlign={legendPosition === 'bottom' ? 'bottom' : 'middle'}
            wrapperStyle={{
              fontSize: '12px',
              color: theme.palette.text.secondary,
              marginTop: legendPosition === 'bottom' ? '16px' : 0
            }}
          />
        </RechartsChart>
      </ResponsiveContainer>

      {/* Hidden live region for accessibility announcements */}
      <div
        id="chart-live-region"
        role="status"
        aria-live="polite"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0
        }}
      />
    </Box>
  );
};

export default PieChart;