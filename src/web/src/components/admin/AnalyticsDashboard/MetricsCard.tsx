import React from 'react'; // react@18.2.0
import { Card, CardContent, Typography, Box, Tooltip } from '@mui/material'; // @mui/material@5.14.0
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material'; // @mui/icons-material@5.14.0
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
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const getTrendIcon = (direction: TrendDirection): JSX.Element => {
  switch (direction) {
    case TrendDirection.INCREASING:
      return (
        <TrendingUp
          sx={(theme) => ({
            color: theme.palette.success.main,
            fontSize: '1.25rem'
          })}
          aria-label="Increasing trend"
          role="img"
        />
      );
    case TrendDirection.DECREASING:
      return (
        <TrendingDown
          sx={(theme) => ({
            color: theme.palette.error.main,
            fontSize: '1.25rem'
          })}
          aria-label="Decreasing trend"
          role="img"
        />
      );
    default:
      return (
        <TrendingFlat
          sx={(theme) => ({
            color: theme.palette.text.secondary,
            fontSize: '1.25rem'
          })}
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
  ariaLabel = title
}) => {
  if (loading) {
    return (
      <Card
        sx={{
          height: '100%',
          minWidth: '200px',
          position: 'relative'
        }}
      >
        <CardContent>
          <ContentLoader
            height={120}
            ariaLabel={`Loading ${title} metric`}
          />
        </CardContent>
      </Card>
    );
  }

  const formattedValue = formatValue(value);
  const trendIcon = getTrendIcon(trend.direction);
  const trendText = `${trend.percentageChange >= 0 ? '+' : ''}${trend.percentageChange.toFixed(1)}%`;

  return (
    <Tooltip
      title={tooltipText || ''}
      placement="top"
      arrow
      enterDelay={300}
      leaveDelay={200}
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
            outline: (theme) => `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px'
          }
        }}
        tabIndex={0}
        role="article"
        aria-label={ariaLabel}
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
            aria-label={`Trend: ${trend.direction.toLowerCase()}, ${trendText}`}
          >
            {trendIcon}
            <Typography
              variant="body2"
              sx={{
                color: (theme) => 
                  trend.direction === TrendDirection.INCREASING
                    ? theme.palette.success.main
                    : trend.direction === TrendDirection.DECREASING
                    ? theme.palette.error.main
                    : theme.palette.text.secondary
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