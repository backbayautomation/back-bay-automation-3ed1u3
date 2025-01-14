/**
 * Document validation module implementing strict security controls,
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
 * @returns Validation result with detailed status and errors
 */
export const validateDocumentMetadata = (
  metadata: DocumentMetadata,
  securityConfig: DocumentSecurityConfig
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  try {
    // Validate metadata schema
    documentMetadataSchema.parse(metadata);

    // Validate file size against limits
    if (metadata.file_size_bytes > MAX_FILE_SIZE[metadata.mime_type as DocumentType]) {
      errors.push(`File size exceeds maximum allowed size for type ${metadata.mime_type}`);
    }

    // Validate MIME type
    const documentType = Object.entries(ALLOWED_DOCUMENT_TYPES)
      .find(([_, mimes]) => mimes.includes(metadata.mime_type))?.[0];
    
    if (!documentType) {
      errors.push('Invalid MIME type');
    }

    // Sanitize string fields
    metadata.languages = metadata.languages.map(sanitizeString);
    metadata.encoding = sanitizeString(metadata.encoding);

    // Perform content security validation
    const securityResult = validateContentSecurity(metadata, securityConfig);
    if (!securityResult.isValid) {
      errors.push(...securityResult.errors);
    }

    // Validate processing requirements
    if (metadata.requires_ocr && !metadata.has_text_content) {
      if (!securityConfig.allowOcrProcessing) {
        errors.push('OCR processing is not allowed for this document type');
      }
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map(err => err.message));
    } else {
      errors.push('Invalid metadata format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Comprehensive validation of document upload requests with security checks
 * @param request - Document upload request to validate
 * @returns Detailed validation result with security status
 */
export const validateDocumentUpload = (
  request: DocumentUploadRequest
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  try {
    // Validate request schema
    documentUploadSchema.parse(request);

    // Validate file
    const fileValidation = validateFileUpload(request.file);
    if (fileValidation.length > 0) {
      errors.push(...fileValidation.map(err => err.message));
    }

    // Validate filename
    const sanitizedFilename = sanitizeString(request.file.name);
    if (sanitizedFilename.length > MAX_FILENAME_LENGTH) {
      errors.push(`Filename exceeds maximum length of ${MAX_FILENAME_LENGTH} characters`);
    }

    // Validate file size
    if (request.file.size > MAX_FILE_SIZE[request.type]) {
      errors.push(`File size exceeds maximum allowed size for type ${request.type}`);
    }

    // Validate MIME type
    if (!ALLOWED_DOCUMENT_TYPES[request.type].includes(request.file.type)) {
      errors.push(`Invalid MIME type for document type ${request.type}`);
    }

    // Validate tags
    request.tags = request.tags.map(sanitizeString).filter(Boolean);
    if (request.tags.some(tag => tag.length > 50)) {
      errors.push('Tag length cannot exceed 50 characters');
    }

    // Validate metadata if provided
    if (Object.keys(request.metadata).length > 0) {
      const metadataValidation = validateDocumentMetadata(
        request.metadata as DocumentMetadata,
        {
          allowOcrProcessing: true,
          maxMetadataSize: 10240, // 10KB
          allowedLanguages: ['en'],
          securityScanEnabled: true
        }
      );
      if (!metadataValidation.isValid) {
        errors.push(...metadataValidation.errors);
      }
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map(err => err.message));
    } else {
      errors.push('Invalid upload request format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};