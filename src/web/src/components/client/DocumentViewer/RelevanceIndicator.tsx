import React, { memo, useCallback } from 'react';
import { LinearProgress } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
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
    '&[data-loading="true"]': {
        opacity: 0.7
    }
}));

const ScoreText = styled('span')(({ theme }) => ({
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    minWidth: 45,
    fontWeight: theme.typography.fontWeightMedium,
    userSelect: 'none',
    fontFeatureSettings: '"tnum" 1', // Enable tabular numbers for better alignment
}));

/**
 * Formats a relevance score (0-1) as a percentage string with proper localization
 * @param score - Relevance score between 0 and 1
 * @returns Formatted percentage string
 */
const formatRelevanceScore = (score: number): string => {
    if (score < 0 || score > 1) {
        console.warn('Relevance score out of bounds:', score);
        score = Math.max(0, Math.min(1, score));
    }

    return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(score);
};

/**
 * RelevanceIndicator component displays a visual indicator of document relevance
 * with accessibility support and performance optimizations.
 * @version 1.0.0
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
    const relevanceScore = relevanceScores[sectionId] ?? 0;

    // Memoized score text for screen readers
    const getScoreText = useCallback((score: number): string => {
        return `Document relevance: ${formatRelevanceScore(score)}`;
    }, []);

    // Determine color based on score thresholds
    const getProgressColor = useCallback((score: number): 'success' | 'primary' | 'warning' => {
        if (score >= 0.8) return 'success';
        if (score >= 0.5) return 'primary';
        return 'warning';
    }, []);

    return (
        <Container 
            className={className}
            style={style}
            role="region"
            aria-label={ariaLabel || 'Document relevance score'}
            data-loading={isLoading}
            data-testid={`relevance-indicator-${sectionId}`}
        >
            <LinearProgress
                variant="determinate"
                value={relevanceScore * 100}
                color={getProgressColor(relevanceScore)}
                sx={{
                    width: '100%',
                    height: 8,
                    borderRadius: theme.shape.borderRadius,
                    backgroundColor: theme.palette.action.hover
                }}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={relevanceScore * 100}
                aria-label="Relevance progress"
            />
            <ScoreText
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {formatRelevanceScore(relevanceScore)}
            </ScoreText>
        </Container>
    );
});

// Display name for debugging
RelevanceIndicator.displayName = 'RelevanceIndicator';

export default RelevanceIndicator;