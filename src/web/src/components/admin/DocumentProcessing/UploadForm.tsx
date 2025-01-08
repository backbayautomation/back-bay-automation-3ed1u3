import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form'; // v7.45.0
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Alert, 
  CircularProgress 
} from '@mui/material'; // v5.14.0

import { 
  Document, 
  DocumentUploadRequest, 
  DocumentType, 
} from '../../../types/document';
import FormField from '../../common/Forms/FormField';
import LoadingButton from '../../common/Buttons/LoadingButton';
import { uploadDocument } from '../../../api/documents';

// Props interface with comprehensive validation options
interface UploadFormProps {
  clientId: string;
  onUploadSuccess: (document: Document) => void;
  onUploadError: (error: Error) => void;
  allowMultiple?: boolean;
  maxFileSize?: number;
  allowedTypes?: DocumentType[];
}

// Form data interface with strict typing
interface FormData {
  file: File | null;
  documentType: DocumentType;
  metadata: Record<string, any>;
  description: string;
}

// Default allowed document types
const DEFAULT_ALLOWED_TYPES: DocumentType[] = ['pdf', 'docx', 'xlsx', 'txt'];
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Enhanced document upload form component with comprehensive validation,
 * accessibility features, and progress tracking.
 */
const UploadForm = React.memo<UploadFormProps>(({
  clientId,
  onUploadSuccess,
  onUploadError,
  allowMultiple = false,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
}) => {
  // Form state management with validation
  const { register, handleSubmit: handleFormSubmit, formState: { errors }, reset } = useForm<FormData>();
  
  // Upload state management
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // File validation helper
  const validateFile = (file: File): string | null => {
    if (!file) return 'Please select a file';
    if (file.size > maxFileSize) {
      return `File size must be less than ${maxFileSize / 1024 / 1024}MB`;
    }
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedTypes.includes(fileExtension as DocumentType)) {
      return `File type must be one of: ${allowedTypes.join(', ')}`;
    }
    return null;
  };

  // Handle form submission with progress tracking
  const handleSubmit = useCallback(async (data: FormData) => {
    if (!data.file) return;

    const fileError = validateFile(data.file);
    if (fileError) {
      setError(fileError);
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const uploadRequest: DocumentUploadRequest = {
        file: data.file,
        client_id: clientId,
        type: data.documentType,
        metadata: {
          description: data.description,
          ...data.metadata
        },
        tags: [],
        priority_processing: false
      };

      const response = await uploadDocument(uploadRequest, (progress) => {
        setUploadProgress(progress);
      });

      onUploadSuccess(response.data);
      reset();
      setUploadProgress(0);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onUploadError(error);
    } finally {
      setIsUploading(false);
    }
  }, [clientId, maxFileSize, allowedTypes, onUploadSuccess, onUploadError, reset]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Upload Document
        </Typography>

        <Box
          component="form"
          onSubmit={handleFormSubmit(handleSubmit)}
          noValidate
          aria-label="Document upload form"
        >
          {/* File Input */}
          <input
            type="file"
            accept={allowedTypes.map(type => `.${type}`).join(',')}
            multiple={allowMultiple}
            {...register('file', { 
              required: 'Please select a file',
              validate: validateFile
            })}
            style={{ display: 'none' }}
            id="file-input"
            aria-describedby="file-input-help"
          />
          
          <Box mb={2}>
            <LoadingButton
              variant="outlined"
              component="label"
              htmlFor="file-input"
              fullWidth
              isLoading={isUploading}
              loadingPosition="start"
              aria-busy={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Select File'}
            </LoadingButton>
            <Typography
              variant="caption"
              color="textSecondary"
              id="file-input-help"
            >
              Supported formats: {allowedTypes.join(', ')}. Max size: {maxFileSize / 1024 / 1024}MB
            </Typography>
          </Box>

          {/* Description Field */}
          <FormField
            name="description"
            label="Description"
            placeholder="Enter document description"
            error={errors.description?.message}
            {...register('description', {
              required: 'Description is required',
              maxLength: {
                value: 500,
                message: 'Description must be less than 500 characters'
              }
            })}
          />

          {/* Progress Indicator */}
          {isUploading && (
            <Box display="flex" alignItems="center" my={2}>
              <CircularProgress
                variant="determinate"
                value={uploadProgress}
                size={24}
                sx={{ mr: 1 }}
              />
              <Typography variant="body2" color="textSecondary">
                Uploading... {uploadProgress}%
              </Typography>
            </Box>
          )}

          {/* Error Display */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ my: 2 }}
              role="alert"
            >
              {error}
            </Alert>
          )}

          {/* Submit Button */}
          <LoadingButton
            type="submit"
            variant="contained"
            fullWidth
            isLoading={isUploading}
            disabled={isUploading}
            sx={{ mt: 2 }}
          >
            Upload Document
          </LoadingButton>
        </Box>
      </CardContent>
    </Card>
  );
});

UploadForm.displayName = 'UploadForm';

export default UploadForm;