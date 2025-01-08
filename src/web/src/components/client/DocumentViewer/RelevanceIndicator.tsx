/**
 * RelevanceIndicator - A production-ready React component for displaying document relevance scores
 * with comprehensive accessibility support and performance optimizations.
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import { LinearProgress } from '@mui/material'; // v5.14.0
import { styled, useTheme } from '@mui/material/styles'; // v5.14.0
import { useDocumentContext } from './DocumentContext';

/**
 * Props interface for the RelevanceIndicator component
 */
interface RelevanceIndicatorProps {
  sectionId: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

/**
 * Styled components for consistent theming and layout
 */
const Container = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: 120,
  padding: theme.spacing(0.5),
  transition: 'opacity 0.2s ease-in-out',
  opacity: 1,
  '&.loading': {
    opacity: 0.7
  }
}));

const ScoreText = styled('span')(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.secondary,
  minWidth: 45,
  fontWeight: theme.typography.fontWeightMedium,
  userSelect: 'none',
  fontFeatureSettings: '"tnum" 1', // Use tabular numbers for consistent width
}));

const ProgressContainer = styled('div')({
  flexGrow: 1,
  minWidth: 60,
  maxWidth: 200,
});

/**
 * Formats a relevance score as a percentage with proper localization
 * @param score - Relevance score between 0 and 1
 * @returns Formatted percentage string
 */
const formatRelevanceScore = (score: number): string => {
  // Ensure score is between 0 and 1
  const normalizedScore = Math.max(0, Math.min(1, score));
  
  // Convert to percentage and format with locale-aware number formatting
  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(normalizedScore);
};

/**
 * RelevanceIndicator component displays a visual indicator of document relevance
 * with accessibility support and performance optimizations.
 */
const RelevanceIndicator: React.FC<RelevanceIndicatorProps> = memo(({
  sectionId,
  className,
  style,
  ariaLabel
}) => {
  const theme = useTheme();
  const { relevanceScores, isLoading } = useDocumentContext();

  // Get the relevance score for this section, defaulting to 0 if not found
  const relevanceScore = relevanceScores[sectionId] || 0;

  // Memoized score formatting
  const formattedScore = useCallback(() => {
    return formatRelevanceScore(relevanceScore);
  }, [relevanceScore]);

  // Determine color based on score thresholds
  const getProgressColor = useCallback(() => {
    if (relevanceScore >= 0.8) return 'success';
    if (relevanceScore >= 0.5) return 'primary';
    return 'warning';
  }, [relevanceScore]);

  return (
    <Container 
      className={`relevance-indicator ${className || ''} ${isLoading ? 'loading' : ''}`}
      style={style}
      role="region"
      aria-label={ariaLabel || 'Document relevance score'}
    >
      <ProgressContainer>
        <LinearProgress
          variant="determinate"
          value={relevanceScore * 100}
          color={getProgressColor()}
          sx={{
            height: 8,
            borderRadius: theme.shape.borderRadius,
          }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={relevanceScore * 100}
          aria-valuetext={`Relevance score: ${formattedScore()}`}
        />
      </ProgressContainer>
      <ScoreText
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {formattedScore()}
      </ScoreText>
    </Container>
  );
});

// Display name for debugging
RelevanceIndicator.displayName = 'RelevanceIndicator';

// Export memoized component
export default RelevanceIndicator;