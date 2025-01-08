import React from 'react';
import { Card, CardContent, Typography, Box, Tooltip } from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';
import { MetricTrend, TrendDirection } from '../../../types/analytics';
import ContentLoader from '../../common/Loaders/ContentLoader';

/**
 * Props interface for MetricsCard component with enhanced accessibility
 */
interface MetricsCardProps {
  title: string;
  value: number;
  trend: MetricTrend;
  loading?: boolean;
  icon?: React.ReactNode;
  tooltipText?: string;
  ariaLabel?: string;
}

/**
 * Formats numeric values with appropriate units and accessibility considerations
 */
const formatValue = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
};

/**
 * Returns appropriate accessible trend icon based on trend direction
 */
const getTrendIcon = (direction: TrendDirection): JSX.Element => {
  switch (direction) {
    case TrendDirection.INCREASING:
      return <TrendingUp fontSize="small" sx={{ color: 'success.main' }} aria-label="Increasing trend" />;
    case TrendDirection.DECREASING:
      return <TrendingDown fontSize="small" sx={{ color: 'error.main' }} aria-label="Decreasing trend" />;
    default:
      return <TrendingFlat fontSize="small" sx={{ color: 'text.secondary' }} aria-label="Stable trend" />;
  }
};

/**
 * MetricsCard component for displaying individual metrics with trend indicators
 * Enhanced with accessibility features and performance optimizations
 */
const MetricsCard = React.memo<MetricsCardProps>(({
  title,
  value,
  trend,
  loading = false,
  icon,
  tooltipText,
  ariaLabel = `${title} metric card`
}) => {
  if (loading) {
    return (
      <Card
        sx={{
          height: '100%',
          minWidth: '200px',
          position: 'relative'
        }}
        role="progressbar"
        aria-label={`Loading ${title} metric`}
      >
        <ContentLoader
          height={140}
          ariaLabel={`Loading ${title} metric data`}
        />
      </Card>
    );
  }

  const formattedValue = formatValue(value);
  const trendIcon = getTrendIcon(trend.direction);
  const trendText = `${trend.percentageChange >= 0 ? '+' : ''}${trend.percentageChange.toFixed(1)}%`;

  return (
    <Tooltip
      title={tooltipText || `${title}: ${formattedValue}`}
      arrow
      placement="top"
    >
      <Card
        sx={{
          height: '100%',
          minWidth: '200px',
          transition: 'all 0.3s ease',
          position: 'relative',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: (theme) => theme.shadows[4]
          },
          '&:focus-visible': {
            outline: (theme) => `2px solid ${theme.palette.primary.main}`
          }
        }}
        role="article"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        <CardContent
          sx={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            height: '100%'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {icon && (
              <Box
                sx={{
                  color: 'text.secondary',
                  display: 'flex',
                  alignItems: 'center'
                }}
                aria-hidden="true"
              >
                {icon}
              </Box>
            )}
            <Typography
              variant="subtitle2"
              color="textSecondary"
              sx={{
                fontSize: '0.875rem',
                fontWeight: 500,
                lineHeight: 1.2
              }}
            >
              {title}
            </Typography>
          </Box>

          <Typography
            variant="h4"
            sx={{
              fontSize: {
                xs: '1.25rem',
                sm: '1.5rem'
              },
              fontWeight: 600,
              lineHeight: 1.4
            }}
            aria-label={`${title} value: ${formattedValue}`}
          >
            {formattedValue}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: 'auto'
            }}
            aria-label={`Trend: ${trend.direction.toLowerCase()}, ${trendText} change`}
          >
            {trendIcon}
            <Typography
              variant="body2"
              sx={{
                color: trend.direction === TrendDirection.INCREASING
                  ? 'success.main'
                  : trend.direction === TrendDirection.DECREASING
                    ? 'error.main'
                    : 'text.secondary'
              }}
            >
              {trendText}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Tooltip>
  );
});

MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;