import React, { memo, useCallback } from 'react'; // v18.2.0
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
 * Styled container component with proper spacing and transitions
 */
const Container = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 120,
    padding: theme.spacing(0.5),
    transition: theme.transitions.create('opacity', {
        duration: theme.transitions.duration.shorter,
    }),
    opacity: 1,
    '&.loading': {
        opacity: 0.7,
    },
}));

/**
 * Styled text component for score display with proper typography
 */
const ScoreText = styled('span')(({ theme }) => ({
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    minWidth: 45,
    fontWeight: theme.typography.fontWeightMedium,
    userSelect: 'none',
    fontFeatureSettings: '"tnum" 1', // Use tabular numbers for better alignment
}));

/**
 * Formats a relevance score as a percentage with proper localization
 * @param score - Relevance score between 0 and 1
 * @returns Formatted percentage string
 */
const formatRelevanceScore = (score: number): string => {
    // Ensure score is between 0 and 1
    const normalizedScore = Math.max(0, Math.min(1, score));
    
    // Convert to percentage and format with locale-specific formatting
    return new Intl.NumberFormat(undefined, {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
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
    ariaLabel,
}) => {
    const theme = useTheme();
    const { relevanceScores, isLoading } = useDocumentContext();

    // Get the relevance score for this section, defaulting to 0 if not found
    const relevanceScore = relevanceScores[sectionId] || 0;

    // Memoized aria label for accessibility
    const getAriaLabel = useCallback(() => {
        return ariaLabel || `Relevance score for section ${sectionId}: ${formatRelevanceScore(relevanceScore)}`;
    }, [ariaLabel, sectionId, relevanceScore]);

    return (
        <Container 
            className={`relevance-indicator ${className || ''} ${isLoading ? 'loading' : ''}`}
            style={style}
            role="region"
            aria-label={getAriaLabel()}
        >
            <LinearProgress
                variant="determinate"
                value={relevanceScore * 100}
                sx={{
                    width: '100%',
                    height: 8,
                    borderRadius: theme.shape.borderRadius,
                    backgroundColor: theme.palette.action.hover,
                    '& .MuiLinearProgress-bar': {
                        borderRadius: theme.shape.borderRadius,
                    },
                }}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={relevanceScore * 100}
                aria-valuetext={formatRelevanceScore(relevanceScore)}
            />
            <ScoreText 
                role="status"
                aria-live="polite"
            >
                {formatRelevanceScore(relevanceScore)}
            </ScoreText>
        </Container>
    );
});

// Display name for debugging
RelevanceIndicator.displayName = 'RelevanceIndicator';

// Export memoized component
export default RelevanceIndicator;