import React, { useMemo, useCallback, memo } from 'react';
import { Box, Paper, Typography, IconButton, CircularProgress, Alert } from '@mui/material';
import { NavigateBefore, NavigateNext } from '@mui/icons-material';
import { List, AutoSizer } from 'react-virtualized'; // v9.22.3
import { useDocumentContext } from './DocumentContext';
import RelevanceIndicator from './RelevanceIndicator';
import { Document } from '../../../types/document';

/**
 * Props interface for the DocumentPreview component
 */
interface DocumentPreviewProps {
    className?: string;
    enableVirtualization?: boolean;
    renderOptions?: {
        fontSize?: number;
        lineHeight?: number;
        syntaxHighlighting?: boolean;
        maxHeight?: number;
    };
}

/**
 * Interface for virtualization row data
 */
interface RowData {
    content: string;
    index: number;
}

/**
 * Styled components configuration using Material-UI system
 */
const styles = {
    container: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        px: 2,
        py: 1,
    },
    navigation: {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
    },
    content: {
        flex: 1,
        overflow: 'auto',
        position: 'relative',
        minHeight: 200,
        p: 2,
    },
} as const;

/**
 * Renders document content based on document type with virtualization support
 */
const renderDocumentContent = useCallback((
    document: Document | null,
    section: string,
    options?: DocumentPreviewProps['renderOptions']
): React.ReactNode => {
    if (!document || !section) {
        return (
            <Alert severity="info">
                No document section selected
            </Alert>
        );
    }

    const currentSection = document.sections.find(s => s.id === section);
    if (!currentSection) {
        return (
            <Alert severity="warning">
                Section not found
            </Alert>
        );
    }

    // Split content into lines for virtualization
    const lines = currentSection.content.split('\n');

    const rowRenderer = ({ index, key, style }: { index: number; key: string; style: React.CSSProperties }) => (
        <div key={key} style={style}>
            <Typography
                variant="body2"
                sx={{
                    fontSize: options?.fontSize || 14,
                    lineHeight: options?.lineHeight || 1.5,
                    whiteSpace: 'pre-wrap',
                    fontFamily: document.type === 'txt' ? 'monospace' : 'inherit',
                }}
            >
                {lines[index]}
            </Typography>
        </div>
    );

    return (
        <AutoSizer>
            {({ width, height }) => (
                <List
                    width={width}
                    height={height}
                    rowCount={lines.length}
                    rowHeight={options?.lineHeight ? options.lineHeight * (options?.fontSize || 14) : 21}
                    rowRenderer={rowRenderer}
                    overscanRowCount={5}
                    role="document"
                    aria-label={`Document content for ${document.filename}`}
                />
            )}
        </AutoSizer>
    );
}, []);

/**
 * DocumentPreview component renders a preview of the current document section
 * with navigation controls and enhanced accessibility features.
 * @version 1.0.0
 */
const DocumentPreview: React.FC<DocumentPreviewProps> = memo(({
    className,
    enableVirtualization = true,
    renderOptions
}) => {
    const {
        currentDocument,
        currentSection,
        isLoading,
        totalSections
    } = useDocumentContext();

    // Memoized navigation state
    const navigationState = useMemo(() => ({
        hasPreviousSection: currentSection !== currentDocument?.sections[0]?.id,
        hasNextSection: currentSection !== currentDocument?.sections[totalSections - 1]?.id,
        currentIndex: currentDocument?.sections.findIndex(s => s.id === currentSection) || 0,
    }), [currentDocument, currentSection, totalSections]);

    // Navigation handlers
    const handlePreviousSection = useCallback(() => {
        if (!currentDocument || navigationState.currentIndex <= 0) return;
        const previousSection = currentDocument.sections[navigationState.currentIndex - 1];
        if (previousSection) {
            // Use the context's setCurrentSection
            useDocumentContext().setCurrentSection(previousSection.id);
        }
    }, [currentDocument, navigationState.currentIndex]);

    const handleNextSection = useCallback(() => {
        if (!currentDocument || navigationState.currentIndex >= totalSections - 1) return;
        const nextSection = currentDocument.sections[navigationState.currentIndex + 1];
        if (nextSection) {
            // Use the context's setCurrentSection
            useDocumentContext().setCurrentSection(nextSection.id);
        }
    }, [currentDocument, navigationState.currentIndex, totalSections]);

    // Loading state
    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
                <CircularProgress aria-label="Loading document" />
            </Box>
        );
    }

    return (
        <Paper
            elevation={2}
            className={className}
            role="region"
            aria-label="Document Preview"
        >
            <Box sx={styles.container}>
                <Box sx={styles.header}>
                    <Typography variant="h6" component="h2">
                        {currentDocument?.filename || 'No document selected'}
                    </Typography>
                    <Box sx={styles.navigation} role="navigation" aria-label="Section Navigation">
                        <IconButton
                            onClick={handlePreviousSection}
                            disabled={!navigationState.hasPreviousSection}
                            aria-label="Previous Section"
                        >
                            <NavigateBefore />
                        </IconButton>
                        <Typography variant="body2" aria-live="polite">
                            {`Section ${navigationState.currentIndex + 1} of ${totalSections}`}
                        </Typography>
                        <IconButton
                            onClick={handleNextSection}
                            disabled={!navigationState.hasNextSection}
                            aria-label="Next Section"
                        >
                            <NavigateNext />
                        </IconButton>
                    </Box>
                </Box>

                <RelevanceIndicator sectionId={currentSection} />

                <Box
                    sx={styles.content}
                    role="main"
                    aria-busy={isLoading}
                >
                    {enableVirtualization ? (
                        renderDocumentContent(currentDocument, currentSection, renderOptions)
                    ) : (
                        <Typography
                            variant="body2"
                            sx={{
                                whiteSpace: 'pre-wrap',
                                fontSize: renderOptions?.fontSize || 14,
                                lineHeight: renderOptions?.lineHeight || 1.5,
                            }}
                        >
                            {currentDocument?.sections.find(s => s.id === currentSection)?.content || ''}
                        </Typography>
                    )}
                </Box>
            </Box>
        </Paper>
    );
});

// Display name for debugging
DocumentPreview.displayName = 'DocumentPreview';

export default DocumentPreview;