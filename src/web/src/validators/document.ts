/**
 * Document validation module implementing comprehensive security controls,
 * multi-format document validation, and advanced metadata verification.
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import {
  Document,
  DocumentType,
  DocumentMetadata,
  DocumentUploadRequest,
  DocumentSecurityConfig
} from '../types/document';
import {
  validateFileUpload,
  sanitizeString,
  validateContentSecurity
} from '../utils/validation';

/**
 * Mapping of allowed document types to their corresponding MIME types
 */
const ALLOWED_DOCUMENT_TYPES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  txt: ['text/plain']
};

/**
 * Maximum allowed length for document filenames
 */
const MAX_FILENAME_LENGTH = 255;

/**
 * Maximum file size in bytes per document type
 */
const MAX_FILE_SIZE: Record<DocumentType, number> = {
  pdf: 50 * 1024 * 1024,    // 50MB
  docx: 20 * 1024 * 1024,   // 20MB
  xlsx: 15 * 1024 * 1024,   // 15MB
  txt: 5 * 1024 * 1024      // 5MB
};

/**
 * Zod schema for document metadata validation
 */
export const documentMetadataSchema = z.object({
  page_count: z.number().int().positive(),
  file_size_bytes: z.number().positive(),
  mime_type: z.string().refine(
    (mime) => Object.values(ALLOWED_DOCUMENT_TYPES).flat().includes(mime),
    { message: 'Invalid MIME type' }
  ),
  languages: z.array(z.string()).min(1),
  encoding: z.string(),
  has_text_content: z.boolean(),
  requires_ocr: z.boolean(),
  additional_metadata: z.record(z.unknown())
});

/**
 * Zod schema for document upload request validation
 */
export const documentUploadSchema = z.object({
  file: z.instanceof(File),
  client_id: z.string().uuid(),
  type: z.enum(['pdf', 'docx', 'xlsx', 'txt']),
  metadata: z.record(z.unknown()),
  tags: z.array(z.string()),
  priority_processing: z.boolean()
});

/**
 * Validates and sanitizes document metadata with enhanced security checks
 * @param metadata - Document metadata to validate
 * @param securityConfig - Security configuration for validation
 * @returns Validation result with status and errors
 */
export const validateDocumentMetadata = (
  metadata: DocumentMetadata,
  securityConfig: DocumentSecurityConfig
): ValidationResult => {
  const errors: string[] = [];
  let sanitizedMetadata = { ...metadata };

  try {
    // Validate schema compliance
    documentMetadataSchema.parse(metadata);

    // Validate file size against limits
    if (metadata.file_size_bytes > MAX_FILE_SIZE[metadata.type as DocumentType]) {
      errors.push(`File size exceeds maximum allowed for ${metadata.type}`);
    }

    // Validate and sanitize MIME type
    if (!ALLOWED_DOCUMENT_TYPES[metadata.type as string]?.includes(metadata.mime_type)) {
      errors.push('Invalid MIME type for document type');
    }

    // Sanitize string fields
    sanitizedMetadata = {
      ...sanitizedMetadata,
      languages: metadata.languages.map(lang => sanitizeString(lang)),
      encoding: sanitizeString(metadata.encoding)
    };

    // Perform content security validation
    const securityResult = validateContentSecurity(metadata, securityConfig);
    if (!securityResult.success) {
      errors.push(...securityResult.errors);
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map(err => err.message));
    } else {
      errors.push('Metadata validation failed');
    }
  }

  return {
    success: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizedMetadata : null
  };
};

/**
 * Comprehensive validation of document upload requests with security checks
 * @param request - Document upload request to validate
 * @returns Detailed validation result with security status
 */
export const validateDocumentUpload = (
  request: DocumentUploadRequest
): ValidationResult => {
  const errors: string[] = [];

  try {
    // Validate schema compliance
    documentUploadSchema.parse(request);

    // Validate file presence and basic structure
    const fileValidation = validateFileUpload(request.file);
    if (fileValidation.length > 0) {
      errors.push(...fileValidation);
    }

    // Validate filename length and sanitize
    const sanitizedFilename = sanitizeString(request.file.name);
    if (sanitizedFilename.length > MAX_FILENAME_LENGTH) {
      errors.push(`Filename exceeds maximum length of ${MAX_FILENAME_LENGTH} characters`);
    }

    // Verify file size against type-specific limits
    if (request.file.size > MAX_FILE_SIZE[request.type]) {
      errors.push(`File size exceeds maximum allowed for ${request.type}`);
    }

    // Validate MIME type
    if (!ALLOWED_DOCUMENT_TYPES[request.type]?.includes(request.file.type)) {
      errors.push('Invalid file type');
    }

    // Sanitize tags
    const sanitizedTags = request.tags.map(tag => sanitizeString(tag));

    // Validate metadata if provided
    if (Object.keys(request.metadata).length > 0) {
      const metadataValidation = validateDocumentMetadata(
        request.metadata as DocumentMetadata,
        { maxSizeBytes: MAX_FILE_SIZE[request.type] }
      );
      if (!metadataValidation.success) {
        errors.push(...metadataValidation.errors);
      }
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map(err => err.message));
    } else {
      errors.push('Document upload validation failed');
    }
  }

  return {
    success: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? {
      ...request,
      file: request.file,
      filename: sanitizeString(request.file.name),
      tags: request.tags.map(tag => sanitizeString(tag))
    } : null
  };
};

/**
 * Interface for validation results
 */
interface ValidationResult {
  success: boolean;
  errors: string[];
  sanitizedData: any | null;
}