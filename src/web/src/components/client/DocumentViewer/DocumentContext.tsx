/**
 * DocumentContext - React context provider for document viewing state management
 * Provides enhanced document context with error handling, performance optimization,
 * and accessibility support for the document viewer interface.
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'; // ^18.2.0
import { Document } from '../../types/document';
import { getDocumentDetails } from '../../services/documents';

/**
 * Interface for document context state with comprehensive error handling
 */
interface DocumentContextState {
  currentDocument: Document | null;
  currentSection: string;
  relevanceScores: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  sectionVisibility: Record<string, boolean>;
  sectionMetadata: Record<string, string>;
  setCurrentDocument: (document: Document | null) => void;
  setCurrentSection: (section: string) => void;
  updateRelevanceScore: (section: string, score: number) => void;
  toggleSectionVisibility: (section: string) => void;
  updateSectionMetadata: (section: string, metadata: string) => void;
  clearError: () => void;
  refreshDocument: (documentId: string) => Promise<void>;
}

/**
 * Props interface for DocumentContext provider with error boundary support
 */
interface DocumentContextProviderProps {
  children: React.ReactNode;
  errorBoundaryFallback?: React.ReactNode;
  onError?: (error: Error) => void;
}

// Create context with runtime type checking
const DocumentContext = createContext<DocumentContextState | null>(null);

/**
 * DocumentContextProvider component with enhanced error handling and performance optimization
 */
export const DocumentContextProvider: React.FC<DocumentContextProviderProps> = ({
  children,
  errorBoundaryFallback,
  onError
}) => {
  // State management with proper typing
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [currentSection, setCurrentSection] = useState<string>('');
  const [relevanceScores, setRelevanceScores] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>({});
  const [sectionMetadata, setSectionMetadata] = useState<Record<string, string>>({});

  // Memoized error handler
  const handleError = useCallback((error: Error) => {
    const errorMessage = error.message || 'An unexpected error occurred';
    setError(errorMessage);
    onError?.(error);
    console.error('DocumentContext Error:', error);
  }, [onError]);

  // Memoized document refresh handler
  const refreshDocument = useCallback(async (documentId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const document = await getDocumentDetails(documentId);
      setCurrentDocument(document);
    } catch (error) {
      handleError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  // Memoized section visibility toggle
  const toggleSectionVisibility = useCallback((section: string) => {
    setSectionVisibility(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // Debounced relevance score update
  const updateRelevanceScore = useCallback((section: string, score: number) => {
    setRelevanceScores(prev => ({
      ...prev,
      [section]: Math.max(0, Math.min(100, score)) // Ensure score is between 0-100
    }));
  }, []);

  // Memoized section metadata update
  const updateSectionMetadata = useCallback((section: string, metadata: string) => {
    setSectionMetadata(prev => ({
      ...prev,
      [section]: metadata
    }));
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Effect for accessibility announcements
  useEffect(() => {
    if (currentDocument) {
      const announcement = `Document ${currentDocument.filename} loaded`;
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(announcement);
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [currentDocument]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo<DocumentContextState>(() => ({
    currentDocument,
    currentSection,
    relevanceScores,
    isLoading,
    error,
    sectionVisibility,
    sectionMetadata,
    setCurrentDocument,
    setCurrentSection,
    updateRelevanceScore,
    toggleSectionVisibility,
    updateSectionMetadata,
    clearError,
    refreshDocument
  }), [
    currentDocument,
    currentSection,
    relevanceScores,
    isLoading,
    error,
    sectionVisibility,
    sectionMetadata,
    updateRelevanceScore,
    toggleSectionVisibility,
    updateSectionMetadata,
    clearError,
    refreshDocument
  ]);

  // Error boundary fallback rendering
  if (error && errorBoundaryFallback) {
    return <>{errorBoundaryFallback}</>;
  }

  return (
    <DocumentContext.Provider value={contextValue}>
      {children}
    </DocumentContext.Provider>
  );
};

/**
 * Custom hook for accessing document context with runtime validation
 * @throws {Error} When used outside of DocumentContextProvider
 */
export const useDocumentContext = (): DocumentContextState => {
  const context = useContext(DocumentContext);
  
  if (!context) {
    throw new Error('useDocumentContext must be used within DocumentContextProvider');
  }
  
  return context;
};

// Export context for advanced use cases
export { DocumentContext };