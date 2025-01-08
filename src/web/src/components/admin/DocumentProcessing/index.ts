/**
 * Barrel export file for the DocumentProcessing module providing centralized access
 * to document processing UI components with type safety and tree-shaking support.
 * @version 1.0.0
 */

// Component exports with their corresponding prop types
export { default as UploadForm } from './UploadForm';
export type { UploadFormProps } from './UploadForm';

export { default as DocumentList } from './DocumentList';
export type { DocumentListProps } from './DocumentList';

export { default as ProcessingQueue } from './ProcessingQueue';
export type { ProcessingQueueProps } from './ProcessingQueue';

// Re-export common document types used across components
export type {
  Document,
  DocumentType,
  ProcessingStatus,
  DocumentMetadata,
  DocumentUploadRequest
} from '../../../types/document';