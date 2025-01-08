/**
 * Barrel export file for the DocumentViewer component module.
 * Provides centralized exports for document viewing components and utilities
 * with comprehensive TypeScript type support.
 * @version 1.0.0
 */

// Context and hooks exports
export { 
    DocumentContext,
    DocumentContextProvider,
    useDocumentContext
} from './DocumentContext';

// Main component exports
export { default as DocumentPreview } from './DocumentPreview';
export { default as RelevanceIndicator } from './RelevanceIndicator';

// Re-export types from DocumentContext for external use
export type { 
    DocumentContextState,
    DocumentContextProviderProps 
} from './DocumentContext';