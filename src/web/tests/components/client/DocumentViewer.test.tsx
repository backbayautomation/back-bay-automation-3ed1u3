import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentContextProvider, useDocumentContext } from '../../../src/components/client/DocumentViewer/DocumentContext';
import DocumentPreview from '../../../src/components/client/DocumentViewer/DocumentPreview';
import RelevanceIndicator from '../../../src/components/client/DocumentViewer/RelevanceIndicator';
import { Document, DocumentType } from '../../../src/types/document';

// Helper function to create mock document data
const createMockDocument = (overrides: Partial<Document> = {}): Document => ({
    id: 'doc-1',
    client_id: 'client-1',
    filename: 'test-document.pdf',
    type: 'pdf' as DocumentType,
    status: 'completed',
    metadata: {
        page_count: 3,
        file_size_bytes: 1024,
        mime_type: 'application/pdf',
        languages: ['en'],
        encoding: 'utf-8',
        has_text_content: true,
        requires_ocr: false,
        additional_metadata: {}
    },
    sections: [
        { id: 'section-1', title: 'Introduction', content: 'Introduction content' },
        { id: 'section-2', title: 'Specifications', content: 'Specifications content' },
        { id: 'section-3', title: 'Conclusion', content: 'Conclusion content' }
    ],
    processed_at: '2024-01-20T12:00:00Z',
    error_message: null,
    ...overrides
});

// Helper function to render components with context
const renderWithContext = (
    children: React.ReactNode,
    initialState: Partial<any> = {}
) => {
    const defaultState = {
        currentDocument: null,
        currentSection: '',
        relevanceScores: {},
        isLoading: false,
        error: null,
        sectionVisibility: {},
        sectionMetadata: {},
        setCurrentDocument: vi.fn(),
        setCurrentSection: vi.fn(),
        updateRelevanceScore: vi.fn(),
        toggleSectionVisibility: vi.fn(),
        loadDocument: vi.fn(),
        clearError: vi.fn(),
        ...initialState
    };

    return render(
        <DocumentContextProvider>{children}</DocumentContextProvider>
    );
};

describe('DocumentContext', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize with default context state', () => {
        const { result } = renderHook(() => useDocumentContext());
        expect(result.current.currentDocument).toBeNull();
        expect(result.current.isLoading).toBeFalsy();
        expect(result.current.error).toBeNull();
    });

    it('should update current document and trigger rerender', async () => {
        const mockDocument = createMockDocument();
        const { result } = renderHook(() => useDocumentContext());

        act(() => {
            result.current.setCurrentDocument(mockDocument);
        });

        expect(result.current.currentDocument).toEqual(mockDocument);
    });

    it('should handle section navigation with history updates', async () => {
        const mockDocument = createMockDocument();
        const { result } = renderHook(() => useDocumentContext());

        act(() => {
            result.current.setCurrentDocument(mockDocument);
            result.current.setCurrentSection('section-1');
        });

        expect(result.current.currentSection).toBe('section-1');
    });

    it('should handle loading states during document fetch', async () => {
        const { result } = renderHook(() => useDocumentContext());

        act(() => {
            result.current.loadDocument('doc-1');
        });

        expect(result.current.isLoading).toBeTruthy();

        await waitFor(() => {
            expect(result.current.isLoading).toBeFalsy();
        });
    });
});

describe('DocumentPreview', () => {
    const mockDocument = createMockDocument();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render document title and metadata correctly', () => {
        renderWithContext(<DocumentPreview />, {
            currentDocument: mockDocument,
            currentSection: 'section-1'
        });

        expect(screen.getByText(mockDocument.filename)).toBeInTheDocument();
    });

    it('should handle navigation between document sections', async () => {
        const setCurrentSection = vi.fn();
        renderWithContext(<DocumentPreview />, {
            currentDocument: mockDocument,
            currentSection: 'section-1',
            setCurrentSection
        });

        const nextButton = screen.getByLabelText('Next Section');
        await userEvent.click(nextButton);

        expect(setCurrentSection).toHaveBeenCalledWith('section-2');
    });

    it('should render different document types correctly', () => {
        const pdfDocument = createMockDocument({ type: 'pdf' });
        const { rerender } = renderWithContext(<DocumentPreview />, {
            currentDocument: pdfDocument,
            currentSection: 'section-1'
        });

        expect(screen.getByRole('document')).toHaveClass('pdf-content');

        const docxDocument = createMockDocument({ type: 'docx' });
        rerender(<DocumentPreview />);

        expect(screen.getByRole('document')).toHaveClass('docx-content');
    });

    it('should maintain accessibility compliance for navigation', () => {
        renderWithContext(<DocumentPreview />, {
            currentDocument: mockDocument,
            currentSection: 'section-1'
        });

        const navigation = screen.getByRole('navigation');
        expect(navigation).toHaveAttribute('aria-label', 'Section Navigation');
        expect(screen.getByLabelText('Previous Section')).toBeInTheDocument();
        expect(screen.getByLabelText('Next Section')).toBeInTheDocument();
    });

    it('should support keyboard navigation between sections', async () => {
        const setCurrentSection = vi.fn();
        renderWithContext(<DocumentPreview />, {
            currentDocument: mockDocument,
            currentSection: 'section-1',
            setCurrentSection
        });

        const nextButton = screen.getByLabelText('Next Section');
        await userEvent.tab();
        await userEvent.keyboard('{Enter}');

        expect(setCurrentSection).toHaveBeenCalled();
    });
});

describe('RelevanceIndicator', () => {
    it('should render progress bar with correct ARIA attributes', () => {
        renderWithContext(
            <RelevanceIndicator sectionId="section-1" />,
            {
                relevanceScores: { 'section-1': 0.75 }
            }
        );

        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '75');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should display formatted relevance percentage', () => {
        renderWithContext(
            <RelevanceIndicator sectionId="section-1" />,
            {
                relevanceScores: { 'section-1': 0.85 }
            }
        );

        expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('should handle edge cases for relevance scores', () => {
        const { rerender } = renderWithContext(
            <RelevanceIndicator sectionId="section-1" />,
            {
                relevanceScores: { 'section-1': 0 }
            }
        );

        expect(screen.getByText('0%')).toBeInTheDocument();

        rerender(
            <RelevanceIndicator sectionId="section-1" />
        );

        expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should maintain accessibility compliance', () => {
        renderWithContext(
            <RelevanceIndicator sectionId="section-1" ariaLabel="Custom label" />,
            {
                relevanceScores: { 'section-1': 0.5 }
            }
        );

        const container = screen.getByRole('region');
        expect(container).toHaveAttribute('aria-label', 'Custom label');
        expect(screen.getByRole('status')).toBeInTheDocument();
    });
});