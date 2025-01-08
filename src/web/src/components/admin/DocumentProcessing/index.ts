/**
 * Barrel export file for the DocumentProcessing module.
 * Provides centralized access to document processing UI components with type safety.
 * @version 1.0.0
 */

// Component exports with their associated prop types
export { default as UploadForm } from './UploadForm';
export type { UploadFormProps } from './UploadForm';

export { default as DocumentList } from './DocumentList';
export type { DocumentListProps } from './DocumentList';

export { default as ProcessingQueue } from './ProcessingQueue';
export type { ProcessingQueueProps } from './ProcessingQueue';

// Re-export common types used across components
export type {
  Document,
  DocumentType,
  ProcessingStatus,
  DocumentMetadata,
  DocumentUploadRequest
} from '../../../types/document';