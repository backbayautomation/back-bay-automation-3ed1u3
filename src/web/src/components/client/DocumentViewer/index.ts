/**
 * Barrel export file for the DocumentViewer component module.
 * Provides centralized exports for document viewing functionality with comprehensive TypeScript support.
 * @version 1.0.0
 */

// Context and hooks exports
export { 
    default as DocumentContext,
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

// Re-export types from DocumentPreview for external use
export type { 
    DocumentPreviewProps,
    RowData 
} from './DocumentPreview';

// Re-export types from RelevanceIndicator for external use
export type { 
    RelevanceIndicatorProps 
} from './RelevanceIndicator';