import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentContextProvider, useDocumentContext } from '../../../src/components/client/DocumentViewer/DocumentContext';
import DocumentPreview from '../../../src/components/client/DocumentViewer/DocumentPreview';
import RelevanceIndicator from '../../../src/components/client/DocumentViewer/RelevanceIndicator';
import { Document } from '../../../src/types/document';

// Mock document service
vi.mock('../../../src/services/documents', () => ({
    getDocumentDetails: vi.fn()
}));

// Helper function to render components with DocumentContext
const renderWithContext = (
    children: React.ReactNode,
    initialState: Partial<DocumentContextState> = {}
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
        setSectionMetadata: vi.fn(),
        loadDocument: vi.fn(),
        clearError: vi.fn(),
        ...initialState
    };

    return render(
        <DocumentContextProvider>{children}</DocumentContextProvider>
    );
};

// Helper function to create mock document data
const createMockDocument = (overrides: Partial<Document> = {}): Document => ({
    id: 'doc-1',
    client_id: 'client-1',
    filename: 'test-document.pdf',
    type: 'pdf',
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
        { id: 'section-1', content: 'Introduction content', title: 'Introduction' },
        { id: 'section-2', content: 'Specifications content', title: 'Specifications' },
        { id: 'section-3', content: 'Conclusion content', title: 'Conclusion' }
    ],
    processed_at: '2024-01-20T12:00:00Z',
    error_message: null,
    ...overrides
});

describe('DocumentContext Provider and Hook', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize with default context state', () => {
        const TestComponent = () => {
            const context = useDocumentContext();
            return <div data-testid="context-test">{JSON.stringify(context)}</div>;
        };

        renderWithContext(<TestComponent />);
        const contextElement = screen.getByTestId('context-test');
        expect(JSON.parse(contextElement.textContent!)).toMatchObject({
            currentDocument: null,
            currentSection: '',
            isLoading: false
        });
    });

    it('should update current document and trigger rerender', async () => {
        const mockDocument = createMockDocument();
        const TestComponent = () => {
            const { currentDocument, setCurrentDocument } = useDocumentContext();
            return (
                <div>
                    <button onClick={() => setCurrentDocument(mockDocument)}>
                        Set Document
                    </button>
                    <div data-testid="document-info">
                        {currentDocument?.filename || 'No document'}
                    </div>
                </div>
            );
        };

        renderWithContext(<TestComponent />);
        fireEvent.click(screen.getByText('Set Document'));
        
        await waitFor(() => {
            expect(screen.getByTestId('document-info')).toHaveTextContent('test-document.pdf');
        });
    });

    it('should handle section navigation with history updates', async () => {
        const mockDocument = createMockDocument();
        const TestComponent = () => {
            const { currentSection, setCurrentSection } = useDocumentContext();
            return (
                <div>
                    <div data-testid="current-section">{currentSection}</div>
                    <button onClick={() => setCurrentSection('section-2')}>
                        Navigate
                    </button>
                </div>
            );
        };

        renderWithContext(<TestComponent />, { currentDocument: mockDocument });
        fireEvent.click(screen.getByText('Navigate'));
        
        await waitFor(() => {
            expect(screen.getByTestId('current-section')).toHaveTextContent('section-2');
        });
    });
});

describe('DocumentPreview Component', () => {
    const mockDocument = createMockDocument();

    it('should render document title and metadata correctly', () => {
        renderWithContext(<DocumentPreview />, {
            currentDocument: mockDocument,
            currentSection: 'section-1'
        });

        expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
        expect(screen.getByText('Section 1 of 3')).toBeInTheDocument();
    });

    it('should handle navigation between document sections', async () => {
        const user = userEvent.setup();
        renderWithContext(<DocumentPreview />, {
            currentDocument: mockDocument,
            currentSection: 'section-1'
        });

        const nextButton = screen.getByLabelText('Next Section');
        await user.click(nextButton);

        await waitFor(() => {
            expect(screen.getByText('Section 2 of 3')).toBeInTheDocument();
        });
    });

    it('should show appropriate loading states during transitions', () => {
        renderWithContext(<DocumentPreview />, {
            currentDocument: mockDocument,
            currentSection: 'section-1',
            isLoading: true
        });

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should maintain accessibility compliance for navigation', () => {
        renderWithContext(<DocumentPreview />, {
            currentDocument: mockDocument,
            currentSection: 'section-1'
        });

        expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Section Navigation');
        expect(screen.getByLabelText('Previous Section')).toBeDisabled();
        expect(screen.getByLabelText('Next Section')).toBeEnabled();
    });
});

describe('RelevanceIndicator Component', () => {
    it('should render progress bar with correct ARIA attributes', () => {
        renderWithContext(
            <RelevanceIndicator sectionId="section-1" />,
            {
                relevanceScores: { 'section-1': 0.85 }
            }
        );

        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '85');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should display formatted relevance percentage', () => {
        renderWithContext(
            <RelevanceIndicator sectionId="section-1" />,
            {
                relevanceScores: { 'section-1': 0.75 }
            }
        );

        expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should handle edge cases (0%, 100%, undefined)', () => {
        const { rerender } = renderWithContext(
            <RelevanceIndicator sectionId="section-1" />,
            {
                relevanceScores: { 'section-1': 0 }
            }
        );

        expect(screen.getByText('0%')).toBeInTheDocument();

        rerender(
            <DocumentContextProvider>
                <RelevanceIndicator sectionId="section-1" />
            </DocumentContextProvider>
        );

        expect(screen.getByText('0%')).toBeInTheDocument();

        rerender(
            <DocumentContextProvider>
                <RelevanceIndicator sectionId="section-1" />
            </DocumentContextProvider>
        );
        
        const { relevanceScores } = { 'section-1': 1 };
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    });

    it('should maintain accessibility compliance', () => {
        renderWithContext(
            <RelevanceIndicator sectionId="section-1" />,
            {
                relevanceScores: { 'section-1': 0.65 }
            }
        );

        expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Document relevance score');
        expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });
});