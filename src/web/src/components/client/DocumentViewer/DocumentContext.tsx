import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Document } from '../../../types/document';
import { getDocumentDetails } from '../../../services/documents';

/**
 * Interface for document context state with enhanced error handling and loading states
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
    setSectionMetadata: (section: string, metadata: string) => void;
    loadDocument: (documentId: string) => Promise<void>;
    clearError: () => void;
}

/**
 * Props interface for the DocumentContext provider component
 */
interface DocumentContextProviderProps {
    children: React.ReactNode;
    errorBoundaryConfig?: {
        onError?: (error: Error) => void;
        fallback?: React.ReactNode;
    };
}

// Create context with comprehensive type safety
const DocumentContext = createContext<DocumentContextState | null>(null);

/**
 * DocumentContextProvider component with enhanced error handling and performance optimization
 * @version 1.0.0
 */
export const DocumentContextProvider: React.FC<DocumentContextProviderProps> = ({ 
    children,
    errorBoundaryConfig 
}) => {
    // State management with strict typing
    const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
    const [currentSection, setCurrentSection] = useState<string>('');
    const [relevanceScores, setRelevanceScores] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>({});
    const [sectionMetadata, setSectionMetadata] = useState<Record<string, string>>({});

    // Memoized document setter with validation
    const handleSetDocument = useCallback((document: Document | null) => {
        if (document && (!document.id || !document.filename)) {
            setError('Invalid document data received');
            return;
        }
        setCurrentDocument(document);
        setError(null);
    }, []);

    // Memoized section setter with validation
    const handleSetSection = useCallback((section: string) => {
        if (!section.trim()) {
            setError('Invalid section identifier');
            return;
        }
        setCurrentSection(section);
    }, []);

    // Debounced relevance score updater
    const updateRelevanceScore = useCallback((section: string, score: number) => {
        if (score < 0 || score > 100) {
            setError('Relevance score must be between 0 and 100');
            return;
        }
        setRelevanceScores(prev => ({
            ...prev,
            [section]: score
        }));
    }, []);

    // Section visibility toggle with accessibility support
    const toggleSectionVisibility = useCallback((section: string) => {
        setSectionVisibility(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    }, []);

    // Section metadata setter with validation
    const handleSetSectionMetadata = useCallback((section: string, metadata: string) => {
        if (!section || !metadata) {
            setError('Invalid section metadata');
            return;
        }
        setSectionMetadata(prev => ({
            ...prev,
            [section]: metadata
        }));
    }, []);

    // Async document loader with comprehensive error handling
    const loadDocument = useCallback(async (documentId: string) => {
        setIsLoading(true);
        setError(null);
        
        try {
            const document = await getDocumentDetails(documentId);
            setCurrentDocument(document);
            // Reset states for new document
            setCurrentSection('');
            setRelevanceScores({});
            setSectionVisibility({});
            setSectionMetadata({});
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load document';
            setError(errorMessage);
            errorBoundaryConfig?.onError?.(err as Error);
        } finally {
            setIsLoading(false);
        }
    }, [errorBoundaryConfig]);

    // Error clearing utility
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Memoized context value to prevent unnecessary rerenders
    const contextValue = useMemo(() => ({
        currentDocument,
        currentSection,
        relevanceScores,
        isLoading,
        error,
        sectionVisibility,
        sectionMetadata,
        setCurrentDocument: handleSetDocument,
        setCurrentSection: handleSetSection,
        updateRelevanceScore,
        toggleSectionVisibility,
        setSectionMetadata: handleSetSectionMetadata,
        loadDocument,
        clearError
    }), [
        currentDocument,
        currentSection,
        relevanceScores,
        isLoading,
        error,
        sectionVisibility,
        sectionMetadata,
        handleSetDocument,
        handleSetSection,
        updateRelevanceScore,
        toggleSectionVisibility,
        handleSetSectionMetadata,
        loadDocument,
        clearError
    ]);

    // Effect for cleaning up document state on unmount
    useEffect(() => {
        return () => {
            setCurrentDocument(null);
            setCurrentSection('');
            setRelevanceScores({});
            setSectionVisibility({});
            setSectionMetadata({});
            setError(null);
        };
    }, []);

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
export default DocumentContext;