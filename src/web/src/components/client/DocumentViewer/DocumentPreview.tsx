import React, { useMemo, useCallback, memo } from 'react';
import { Box, Paper, Typography, IconButton, CircularProgress, Alert } from '@mui/material';
import { NavigateBefore, NavigateNext } from '@mui/icons-material';
import { List, AutoSizer } from 'react-virtualized';
import { useDocumentContext } from './DocumentContext';
import RelevanceIndicator from './RelevanceIndicator';
import { Document } from '../../../types/document';
import { styled } from '@mui/material/styles';

/**
 * Interface for document preview component props
 */
interface DocumentPreviewProps {
    className?: string;
    enableVirtualization?: boolean;
    renderOptions?: {
        highlightTerms?: boolean;
        maxHeight?: number;
        syntaxHighlighting?: boolean;
    };
}

/**
 * Interface for document content rendering options
 */
interface RenderOptions {
    highlightTerms?: boolean;
    syntaxHighlighting?: boolean;
    virtualization?: {
        enabled: boolean;
        rowHeight: number;
        overscanRowCount: number;
    };
}

/**
 * Styled components for enhanced visual presentation
 */
const PreviewContainer = styled(Paper)(({ theme }) => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: `1px solid ${theme.palette.divider}`,
    '& .document-content': {
        flex: 1,
        overflow: 'auto',
        padding: theme.spacing(2),
        backgroundColor: theme.palette.background.default,
    },
}));

const NavigationButton = styled(IconButton)(({ theme }) => ({
    '&.Mui-disabled': {
        opacity: 0.3,
    },
    transition: theme.transitions.create(['opacity', 'background-color'], {
        duration: theme.transitions.duration.shorter,
    }),
}));

/**
 * Renders document content based on document type with virtualization support
 */
const renderDocumentContent = useCallback((
    document: Document | null,
    section: string,
    options?: RenderOptions
): React.ReactNode => {
    if (!document || !section) {
        return null;
    }

    const currentSection = document.sections?.find(s => s.id === section);
    if (!currentSection) {
        return (
            <Alert severity="warning">
                Section not found in document
            </Alert>
        );
    }

    // Handle virtualization for large content
    if (options?.virtualization?.enabled && currentSection.content) {
        const contentLines = currentSection.content.split('\n');
        
        return (
            <AutoSizer>
                {({ width, height }) => (
                    <List
                        width={width}
                        height={height}
                        rowCount={contentLines.length}
                        rowHeight={options.virtualization.rowHeight}
                        overscanRowCount={options.virtualization.overscanRowCount}
                        rowRenderer={({ index, key, style }) => (
                            <div key={key} style={style}>
                                {contentLines[index]}
                            </div>
                        )}
                    />
                )}
            </AutoSizer>
        );
    }

    // Render based on document type
    switch (document.type) {
        case 'pdf':
            return (
                <Box className="pdf-content" role="document">
                    {currentSection.content}
                </Box>
            );
        case 'docx':
            return (
                <Box className="docx-content" role="document">
                    {currentSection.content}
                </Box>
            );
        case 'xlsx':
            return (
                <Box className="xlsx-content" role="document">
                    {/* Add specialized Excel content rendering */}
                    {currentSection.content}
                </Box>
            );
        default:
            return (
                <Box className="text-content" role="document">
                    {currentSection.content}
                </Box>
            );
    }
}, []);

/**
 * DocumentPreview component renders a preview of the current document section
 * with navigation controls and enhanced accessibility features
 */
const DocumentPreview: React.FC<DocumentPreviewProps> = memo(({
    className,
    enableVirtualization = false,
    renderOptions = {}
}) => {
    const {
        currentDocument,
        currentSection,
        isLoading,
        totalSections
    } = useDocumentContext();

    // Memoized navigation state
    const navigationState = useMemo(() => ({
        hasPreviousSection: currentSection !== currentDocument?.sections?.[0]?.id,
        hasNextSection: currentSection !== currentDocument?.sections?.[currentDocument.sections.length - 1]?.id,
        currentIndex: currentDocument?.sections?.findIndex(s => s.id === currentSection) ?? -1
    }), [currentDocument, currentSection]);

    // Navigation handlers
    const handlePreviousSection = useCallback(() => {
        if (navigationState.currentIndex > 0 && currentDocument?.sections) {
            const previousSection = currentDocument.sections[navigationState.currentIndex - 1];
            // Assuming setCurrentSection is provided by context
            setCurrentSection(previousSection.id);
        }
    }, [navigationState.currentIndex, currentDocument]);

    const handleNextSection = useCallback(() => {
        if (currentDocument?.sections && 
            navigationState.currentIndex < currentDocument.sections.length - 1) {
            const nextSection = currentDocument.sections[navigationState.currentIndex + 1];
            setCurrentSection(nextSection.id);
        }
    }, [navigationState.currentIndex, currentDocument]);

    // Content rendering options
    const contentOptions: RenderOptions = useMemo(() => ({
        highlightTerms: renderOptions.highlightTerms,
        syntaxHighlighting: renderOptions.syntaxHighlighting,
        virtualization: {
            enabled: enableVirtualization,
            rowHeight: 24,
            overscanRowCount: 10
        }
    }), [enableVirtualization, renderOptions]);

    if (!currentDocument) {
        return (
            <PreviewContainer className={className}>
                <Alert severity="info">
                    No document selected
                </Alert>
            </PreviewContainer>
        );
    }

    return (
        <PreviewContainer 
            className={className}
            elevation={2}
            role="region"
            aria-label="Document Preview"
        >
            <Box p={3} display="flex" flexDirection="column" gap={2}>
                {/* Header with navigation */}
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" component="h2">
                        {currentDocument.filename}
                    </Typography>
                    <Box display="flex" gap={1} role="navigation" aria-label="Section Navigation">
                        <NavigationButton
                            onClick={handlePreviousSection}
                            disabled={!navigationState.hasPreviousSection || isLoading}
                            aria-label="Previous Section"
                        >
                            <NavigateBefore />
                        </NavigationButton>
                        <NavigationButton
                            onClick={handleNextSection}
                            disabled={!navigationState.hasNextSection || isLoading}
                            aria-label="Next Section"
                        >
                            <NavigateNext />
                        </NavigationButton>
                    </Box>
                </Box>

                {/* Relevance indicator */}
                <RelevanceIndicator sectionId={currentSection} />

                {/* Document content */}
                <Box 
                    className="document-content"
                    role="main"
                    aria-busy={isLoading}
                >
                    {isLoading ? (
                        <Box display="flex" justifyContent="center" p={4}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        renderDocumentContent(currentDocument, currentSection, contentOptions)
                    )}
                </Box>
            </Box>
        </PreviewContainer>
    );
});

// Display name for debugging
DocumentPreview.displayName = 'DocumentPreview';

export default DocumentPreview;