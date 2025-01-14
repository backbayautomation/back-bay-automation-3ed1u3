/**
 * Barrel export file for the DocumentViewer component module.
 * Provides centralized exports for document viewing components, context provider,
 * and related utilities with comprehensive TypeScript type support.
 * @version 1.0.0
 */

// Export document context provider and hook with proper type inference
export { 
    DocumentContext,
    DocumentContextProvider,
    useDocumentContext 
} from './DocumentContext';

// Export main document preview component
export { default as DocumentPreview } from './DocumentPreview';

// Export relevance indicator component
export { default as RelevanceIndicator } from './RelevanceIndicator';

// Re-export types from DocumentContext for external use
export type { 
    DocumentContextState,
    DocumentContextProviderProps 
} from './DocumentContext';

// Default export for direct component access
export { DocumentPreview as default };