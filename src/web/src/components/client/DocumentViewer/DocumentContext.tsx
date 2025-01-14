import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Document } from '../../../types/document';
import { getDocumentDetails } from '../../../services/documents';

/**
 * Interface defining the document context state with error handling and loading states
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
    loadDocument: (documentId: string) => Promise<void>;
    clearError: () => void;
}

/**
 * Props for the DocumentContext provider component with error boundary support
 */
interface DocumentContextProviderProps {
    children: React.ReactNode;
    errorBoundaryConfig?: {
        fallback: React.ReactNode;
        onError?: (error: Error) => void;
    };
}

// Create context with runtime validation
const DocumentContext = createContext<DocumentContextState | null>(null);

/**
 * DocumentContext provider component that manages document viewing state
 * with enhanced error handling and performance optimization
 */
export const DocumentContextProvider: React.FC<DocumentContextProviderProps> = ({
    children,
    errorBoundaryConfig
}) => {
    // Core state management with proper typing
    const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
    const [currentSection, setCurrentSection] = useState<string>('');
    const [relevanceScores, setRelevanceScores] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>({});
    const [sectionMetadata, setSectionMetadata] = useState<Record<string, string>>({});

    /**
     * Memoized function to update relevance scores with debouncing
     */
    const updateRelevanceScore = useCallback((section: string, score: number) => {
        setRelevanceScores(prev => ({
            ...prev,
            [section]: Math.max(0, Math.min(100, score)) // Ensure score is between 0-100
        }));
    }, []);

    /**
     * Toggle section visibility with state update batching
     */
    const toggleSectionVisibility = useCallback((section: string) => {
        setSectionVisibility(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    }, []);

    /**
     * Clear error state
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    /**
     * Load document details with comprehensive error handling
     */
    const loadDocument = useCallback(async (documentId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const document = await getDocumentDetails(documentId);
            setCurrentDocument(document);
            
            // Initialize section visibility
            const initialVisibility: Record<string, boolean> = {};
            if (document.metadata?.sections) {
                Object.keys(document.metadata.sections).forEach(section => {
                    initialVisibility[section] = true;
                });
            }
            setSectionVisibility(initialVisibility);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load document';
            setError(errorMessage);
            errorBoundaryConfig?.onError?.(err as Error);
        } finally {
            setIsLoading(false);
        }
    }, [errorBoundaryConfig]);

    /**
     * Effect to clean up state when document changes
     */
    useEffect(() => {
        if (!currentDocument) {
            setCurrentSection('');
            setRelevanceScores({});
            setSectionMetadata({});
        }
    }, [currentDocument]);

    /**
     * Memoized context value to prevent unnecessary re-renders
     */
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
        updateRelevanceScore,
        toggleSectionVisibility,
        loadDocument,
        clearError
    ]);

    return (
        <DocumentContext.Provider value={contextValue}>
            {error && errorBoundaryConfig?.fallback ? errorBoundaryConfig.fallback : children}
        </DocumentContext.Provider>
    );
};

/**
 * Custom hook to access document context state and actions with runtime validation
 * @throws Error if used outside of DocumentContextProvider
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