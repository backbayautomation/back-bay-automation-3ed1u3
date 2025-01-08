import React from 'react'; // ^18.2.0
import { Card, CardContent, Typography, Box, Tooltip } from '@mui/material'; // ^5.14.0
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material'; // ^5.14.0
import { MetricTrend, TrendDirection } from '../../../types/analytics';
import ContentLoader from '../../common/Loaders/ContentLoader';

interface MetricsCardProps {
  title: string;
  value: number;
  trend: MetricTrend;
  loading?: boolean;
  icon?: React.ReactNode;
  tooltipText?: string;
  ariaLabel?: string;
}

const formatValue = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const getTrendIcon = (direction: TrendDirection): JSX.Element => {
  switch (direction) {
    case TrendDirection.INCREASING:
      return (
        <TrendingUp
          sx={{ color: 'success.main' }}
          aria-label="Increasing trend"
          role="img"
        />
      );
    case TrendDirection.DECREASING:
      return (
        <TrendingDown
          sx={{ color: 'error.main' }}
          aria-label="Decreasing trend"
          role="img"
        />
      );
    default:
      return (
        <TrendingFlat
          sx={{ color: 'text.secondary' }}
          aria-label="Stable trend"
          role="img"
        />
      );
  }
};

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
        aria-busy="true"
      >
        <ContentLoader
          height={140}
          ariaLabel={`Loading ${title} metric`}
        />
      </Card>
    );
  }

  const formattedValue = formatValue(value);
  const trendIcon = getTrendIcon(trend.direction);
  const trendText = `${trend.percentageChange >= 0 ? '+' : ''}${trend.percentageChange.toFixed(1)}%`;

  const cardContent = (
    <Card
      sx={{
        height: '100%',
        minWidth: '200px',
        transition: 'all 0.3s ease',
        position: 'relative',
        outline: 'none',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main'
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
                display: 'flex',
                alignItems: 'center',
                color: 'text.secondary'
              }}
              aria-hidden="true"
            >
              {icon}
            </Box>
          )}
          <Typography
            variant="subtitle2"
            sx={{
              color: 'text.secondary',
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
          aria-label={`${title} trend: ${trendText}`}
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
  );

  return tooltipText ? (
    <Tooltip
      title={tooltipText}
      arrow
      placement="top"
      enterDelay={300}
      leaveDelay={200}
    >
      {cardContent}
    </Tooltip>
  ) : cardContent;
});

MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;