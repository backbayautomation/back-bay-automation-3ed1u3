import React from 'react';
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
  DocumentValidation 
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

// Maximum file size (10MB by default)
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * UploadForm component for handling document uploads with comprehensive validation,
 * accessibility features, and progress tracking.
 */
const UploadForm: React.FC<UploadFormProps> = React.memo(({
  clientId,
  onUploadSuccess,
  onUploadError,
  allowMultiple = false,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  allowedTypes = DEFAULT_ALLOWED_TYPES
}) => {
  // Form state management with validation
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<FormData>();
  
  // Upload progress state
  const [uploadProgress, setUploadProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // File input ref for programmatic access
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Validate file type and size
  const validateFile = (file: File): string | null => {
    if (!file) return 'File is required';
    if (file.size > maxFileSize) {
      return `File size must be less than ${maxFileSize / 1024 / 1024}MB`;
    }
    const fileType = file.name.split('.').pop()?.toLowerCase() as DocumentType;
    if (!allowedTypes.includes(fileType)) {
      return `File type must be one of: ${allowedTypes.join(', ')}`;
    }
    return null;
  };

  // Handle file selection with validation
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setValue('file', file);
      setValue('documentType', file.name.split('.').pop()?.toLowerCase() as DocumentType);
      setError(null);
    }
  };

  // Handle form submission with progress tracking
  const onSubmit = async (data: FormData) => {
    try {
      setIsUploading(true);
      setError(null);

      const uploadRequest: DocumentUploadRequest = {
        file: data.file!,
        client_id: clientId,
        type: data.documentType,
        metadata: {
          description: data.description,
          ...data.metadata
        },
        tags: [],
        priority_processing: false
      };

      const response = await uploadDocument(uploadRequest, (progress: number) => {
        setUploadProgress(progress);
      });

      onUploadSuccess(response.data);
      reset();
      setUploadProgress(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      onUploadError(err instanceof Error ? err : new Error('Upload failed'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Upload Document
        </Typography>

        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          aria-label="Document upload form"
        >
          {/* File input with drag-and-drop support */}
          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'grey.300',
              borderRadius: 1,
              p: 3,
              mb: 2,
              textAlign: 'center'
            }}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) {
                const validationError = validateFile(file);
                if (validationError) {
                  setError(validationError);
                  return;
                }
                setValue('file', file);
                setValue('documentType', file.name.split('.').pop()?.toLowerCase() as DocumentType);
                setError(null);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            role="button"
            tabIndex={0}
            aria-label="Drag and drop upload area"
          >
            <input
              type="file"
              {...register('file', { required: 'File is required' })}
              onChange={handleFileChange}
              accept={allowedTypes.map(type => `.${type}`).join(',')}
              multiple={allowMultiple}
              style={{ display: 'none' }}
              ref={fileInputRef}
              aria-invalid={!!errors.file}
              aria-describedby="file-error"
            />
            
            <Typography>
              Drag and drop a file here or{' '}
              <Box
                component="span"
                sx={{ color: 'primary.main', cursor: 'pointer' }}
                onClick={() => fileInputRef.current?.click()}
                onKeyPress={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                tabIndex={0}
                role="button"
              >
                browse
              </Box>
            </Typography>
            
            <Typography variant="caption" color="textSecondary">
              Supported formats: {allowedTypes.join(', ')}
            </Typography>
          </Box>

          {/* Description field */}
          <FormField
            name="description"
            label="Description"
            value={register('description').value || ''}
            onChange={(e) => setValue('description', e.target.value)}
            error={errors.description?.message}
            helperText="Add a description for this document"
            fullWidth
          />

          {/* Error display */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ mt: 2 }}
              role="alert"
            >
              {error}
            </Alert>
          )}

          {/* Upload progress */}
          {isUploading && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <CircularProgress 
                variant="determinate" 
                value={uploadProgress} 
                aria-label="Upload progress"
              />
              <Typography variant="caption" display="block">
                {uploadProgress}% uploaded
              </Typography>
            </Box>
          )}

          {/* Submit button */}
          <LoadingButton
            type="submit"
            isLoading={isUploading}
            disabled={isUploading}
            fullWidth
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