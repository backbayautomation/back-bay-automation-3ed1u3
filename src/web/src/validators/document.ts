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
} as const;

/**
 * Maximum allowed length for document filenames
 */
const MAX_FILENAME_LENGTH = 255;

/**
 * Maximum file size in bytes per document type
 */
const MAX_FILE_SIZE: Record<DocumentType, number> = {
  pdf: 52428800,    // 50MB
  docx: 20971520,   // 20MB
  xlsx: 15728640,   // 15MB
  txt: 5242880      // 5MB
} as const;

/**
 * Zod schema for document metadata validation
 */
export const documentMetadataSchema = z.object({
  page_count: z.number().positive(),
  file_size_bytes: z.number().positive(),
  mime_type: z.string().refine(
    (mime) => Object.values(ALLOWED_DOCUMENT_TYPES).flat().includes(mime),
    { message: 'Invalid MIME type' }
  ),
  languages: z.array(z.string()),
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

    // Validate page count
    if (metadata.page_count <= 0) {
      errors.push('Page count must be a positive number');
    }

    // Validate file size
    const maxSize = MAX_FILE_SIZE[metadata.mime_type as DocumentType];
    if (metadata.file_size_bytes > maxSize) {
      errors.push(`File size exceeds maximum allowed size of ${maxSize} bytes`);
    }

    // Validate and sanitize MIME type
    const isValidMimeType = Object.values(ALLOWED_DOCUMENT_TYPES)
      .flat()
      .includes(metadata.mime_type);
    if (!isValidMimeType) {
      errors.push('Invalid MIME type');
    }

    // Perform content security validation
    const securityResult = validateContentSecurity(metadata, securityConfig);
    if (!securityResult.success) {
      errors.push(...securityResult.errors);
    }

    // Sanitize string fields
    sanitizedMetadata = {
      ...sanitizedMetadata,
      languages: metadata.languages.map(lang => sanitizeString(lang)),
      encoding: sanitizeString(metadata.encoding)
    };

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
    sanitizedMetadata
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

    // Validate file size against type-specific limits
    const maxSize = MAX_FILE_SIZE[request.type];
    if (request.file.size > maxSize) {
      errors.push(`File size exceeds maximum allowed size of ${maxSize} bytes for ${request.type}`);
    }

    // Validate and sanitize filename
    const sanitizedFilename = sanitizeString(request.file.name);
    if (sanitizedFilename.length > MAX_FILENAME_LENGTH) {
      errors.push(`Filename exceeds maximum length of ${MAX_FILENAME_LENGTH} characters`);
    }

    // Verify MIME type authenticity
    const allowedMimeTypes = ALLOWED_DOCUMENT_TYPES[request.type];
    if (!allowedMimeTypes.includes(request.file.type)) {
      errors.push(`Invalid MIME type for ${request.type}`);
    }

    // Validate metadata if provided
    if (request.metadata) {
      const metadataValidation = validateDocumentMetadata(
        request.metadata as DocumentMetadata,
        { maxSizeBytes: maxSize }
      );
      if (!metadataValidation.success) {
        errors.push(...metadataValidation.errors);
      }
    }

    // Validate tags
    if (request.tags) {
      request.tags = request.tags.map(tag => sanitizeString(tag));
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
    sanitizedRequest: {
      ...request,
      filename: sanitizeString(request.file.name)
    }
  };
};

/**
 * Interface for validation results with error tracking and sanitized data
 */
interface ValidationResult {
  success: boolean;
  errors: string[];
  sanitizedMetadata?: DocumentMetadata;
  sanitizedRequest?: DocumentUploadRequest;
}