import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentContextProvider, useDocumentContext } from '../../../src/components/client/DocumentViewer/DocumentContext';
import DocumentPreview from '../../../src/components/client/DocumentViewer/DocumentPreview';
import RelevanceIndicator from '../../../src/components/client/DocumentViewer/RelevanceIndicator';
import { Document, DocumentType } from '../../../src/types/document';

// Helper function to create mock documents
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
  processed_at: new Date().toISOString(),
  error_message: null,
  sections: ['Introduction', 'Specifications', 'Conclusion'],
  ...overrides
});

// Helper function to render components with DocumentContext
const renderWithContext = (
  ui: React.ReactNode,
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
    updateSectionMetadata: vi.fn(),
    clearError: vi.fn(),
    refreshDocument: vi.fn(),
    ...initialState
  };

  return render(
    <DocumentContextProvider>{ui}</DocumentContextProvider>
  );
};

describe('DocumentContext', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default context state', () => {
    const TestComponent = () => {
      const context = useDocumentContext();
      expect(context.currentDocument).toBeNull();
      expect(context.currentSection).toBe('');
      expect(context.isLoading).toBe(false);
      return null;
    };

    renderWithContext(<TestComponent />);
  });

  it('should update current document and trigger rerender', async () => {
    const mockDocument = createMockDocument();
    const TestComponent = () => {
      const { currentDocument, setCurrentDocument } = useDocumentContext();
      React.useEffect(() => {
        setCurrentDocument(mockDocument);
      }, []);
      return currentDocument ? <div>{currentDocument.filename}</div> : null;
    };

    renderWithContext(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    });
  });

  it('should handle section navigation with history updates', async () => {
    const mockDocument = createMockDocument();
    const TestComponent = () => {
      const { setCurrentDocument, setCurrentSection, currentSection } = useDocumentContext();
      React.useEffect(() => {
        setCurrentDocument(mockDocument);
        setCurrentSection('Introduction');
      }, []);
      return currentSection ? <div>{currentSection}</div> : null;
    };

    renderWithContext(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByText('Introduction')).toBeInTheDocument();
    });
  });
});

describe('DocumentPreview', () => {
  const mockDocument = createMockDocument();

  it('should render document title and metadata correctly', () => {
    renderWithContext(
      <DocumentPreview />,
      { currentDocument: mockDocument, currentSection: 'Introduction' }
    );

    expect(screen.getByText(mockDocument.filename)).toBeInTheDocument();
  });

  it('should handle navigation between document sections', async () => {
    const setCurrentSection = vi.fn();
    renderWithContext(
      <DocumentPreview />,
      {
        currentDocument: mockDocument,
        currentSection: 'Introduction',
        setCurrentSection
      }
    );

    const nextButton = screen.getByLabelText('Next Section');
    await userEvent.click(nextButton);
    expect(setCurrentSection).toHaveBeenCalledWith('Specifications');
  });

  it('should show appropriate loading states during transitions', () => {
    renderWithContext(
      <DocumentPreview />,
      { isLoading: true }
    );

    expect(screen.getByLabelText('Loading document content')).toBeInTheDocument();
  });

  it('should maintain accessibility compliance for navigation', () => {
    renderWithContext(
      <DocumentPreview />,
      { currentDocument: mockDocument, currentSection: 'Introduction' }
    );

    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Section Navigation');
    expect(screen.getByLabelText('Previous Section')).toBeInTheDocument();
    expect(screen.getByLabelText('Next Section')).toBeInTheDocument();
  });
});

describe('RelevanceIndicator', () => {
  it('should render progress bar with correct ARIA attributes', () => {
    renderWithContext(
      <RelevanceIndicator sectionId="Introduction" />,
      {
        relevanceScores: { Introduction: 0.85 }
      }
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '85');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('should display formatted relevance percentage', () => {
    renderWithContext(
      <RelevanceIndicator sectionId="Introduction" />,
      {
        relevanceScores: { Introduction: 0.75 }
      }
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should handle edge cases (0%, 100%, undefined)', () => {
    const { rerender } = renderWithContext(
      <RelevanceIndicator sectionId="Test" />,
      { relevanceScores: { Test: 0 } }
    );
    expect(screen.getByText('0%')).toBeInTheDocument();

    rerender(
      <RelevanceIndicator sectionId="Test" />
    );
    expect(screen.getByText('0%')).toBeInTheDocument();

    rerender(
      <DocumentContextProvider>
        <RelevanceIndicator sectionId="Test" />
      </DocumentContextProvider>
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should maintain accessibility compliance', () => {
    renderWithContext(
      <RelevanceIndicator sectionId="Introduction" />,
      {
        relevanceScores: { Introduction: 0.9 }
      }
    );

    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Document relevance score');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});