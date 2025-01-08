import React, { useState, useCallback, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form'; // v7.45.0
import { 
    Box, 
    Card, 
    CardContent, 
    Typography, 
    Alert, 
    CircularProgress 
} from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles';

import { 
    Document, 
    DocumentUploadRequest, 
    DocumentType, 
    DocumentValidation 
} from '../../../types/document';
import FormField from '../../common/Forms/FormField';
import LoadingButton from '../../common/Buttons/LoadingButton';
import { uploadDocument } from '../../../api/documents';

// Styled components for enhanced visual presentation
const UploadContainer = styled(Card)(({ theme }) => ({
    maxWidth: '600px',
    margin: theme.spacing(2),
    '& .MuiCardContent-root': {
        padding: theme.spacing(3),
    },
}));

const DropZone = styled(Box, {
    shouldForwardProp: prop => prop !== 'isDragging' && prop !== 'error'
})<{ isDragging?: boolean; error?: boolean }>(({ theme, isDragging, error }) => ({
    border: `2px dashed ${error ? theme.palette.error.main : 
        isDragging ? theme.palette.primary.main : theme.palette.grey[300]}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(3),
    textAlign: 'center',
    cursor: 'pointer',
    transition: theme.transitions.create(['border-color', 'background-color']),
    backgroundColor: isDragging ? theme.palette.action.hover : 'transparent',
    '&:hover': {
        backgroundColor: theme.palette.action.hover,
    },
}));

// Props interface with comprehensive type safety
interface UploadFormProps {
    clientId: UUID;
    onUploadSuccess: (document: Document) => void;
    onUploadError: (error: Error) => void;
    allowMultiple?: boolean;
    maxFileSize?: number;
    allowedTypes?: DocumentType[];
}

// Form data interface with validation
interface FormData {
    file: File | null;
    documentType: DocumentType;
    metadata: Record<string, any>;
    description: string;
}

// Default allowed document types
const DEFAULT_ALLOWED_TYPES: DocumentType[] = ['pdf', 'docx', 'xlsx', 'txt'];

// Component implementation with comprehensive features
const UploadForm: React.FC<UploadFormProps> = React.memo(({
    clientId,
    onUploadSuccess,
    onUploadError,
    allowMultiple = false,
    maxFileSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = DEFAULT_ALLOWED_TYPES
}) => {
    // Form state management
    const { control, handleSubmit, reset, setError, formState: { errors } } = useForm<FormData>();
    const [isDragging, setIsDragging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Drag and drop handlers with accessibility support
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    }, []);

    // File validation with detailed error messages
    const validateFile = (file: File): DocumentValidation => {
        if (file.size > maxFileSize) {
            throw new Error(`File size exceeds maximum limit of ${maxFileSize / 1024 / 1024}MB`);
        }

        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (!fileExtension || !allowedTypes.includes(fileExtension as DocumentType)) {
            throw new Error(`File type not supported. Allowed types: ${allowedTypes.join(', ')}`);
        }

        return {
            isValid: true,
            size: file.size,
            type: fileExtension as DocumentType
        };
    };

    // File selection handler with validation
    const handleFileSelection = useCallback((file: File) => {
        try {
            const validation = validateFile(file);
            if (validation.isValid) {
                // Set form values
                reset({
                    file,
                    documentType: validation.type,
                    metadata: {},
                    description: ''
                });
            }
        } catch (error) {
            setError('file', {
                type: 'validation',
                message: error instanceof Error ? error.message : 'Invalid file'
            });
        }
    }, [maxFileSize, allowedTypes, reset, setError]);

    // Form submission handler with progress tracking
    const onSubmit = async (data: FormData) => {
        if (!data.file) return;

        setIsUploading(true);
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
        } catch (error) {
            onUploadError(error instanceof Error ? error : new Error('Upload failed'));
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    return (
        <UploadContainer>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Upload Document
                </Typography>

                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                    <Controller
                        name="file"
                        control={control}
                        rules={{ required: 'Please select a file' }}
                        render={({ field: { onChange, value } }) => (
                            <DropZone
                                isDragging={isDragging}
                                error={!!errors.file}
                                onDragEnter={handleDragEnter}
                                onDragOver={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                role="button"
                                tabIndex={0}
                                aria-label="Drop zone for file upload"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={allowedTypes.map(type => `.${type}`).join(',')}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileSelection(file);
                                    }}
                                    style={{ display: 'none' }}
                                    aria-hidden="true"
                                />
                                
                                {value ? (
                                    <Typography>
                                        Selected: {value.name} ({(value.size / 1024 / 1024).toFixed(2)}MB)
                                    </Typography>
                                ) : (
                                    <Typography>
                                        Drag and drop a file here or click to select
                                    </Typography>
                                )}
                            </DropZone>
                        )}
                    />

                    {errors.file && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {errors.file.message}
                        </Alert>
                    )}

                    <Controller
                        name="description"
                        control={control}
                        rules={{ maxLength: 500 }}
                        render={({ field }) => (
                            <FormField
                                {...field}
                                label="Description"
                                placeholder="Enter document description"
                                error={errors.description?.message}
                                fullWidth
                                maxLength={500}
                            />
                        )}
                    />

                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {isUploading && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <CircularProgress size={24} />
                                <Typography variant="body2">
                                    Uploading... {uploadProgress}%
                                </Typography>
                            </Box>
                        )}

                        <LoadingButton
                            type="submit"
                            isLoading={isUploading}
                            loadingText="Uploading..."
                            disabled={isUploading}
                            size="large"
                        >
                            Upload Document
                        </LoadingButton>
                    </Box>
                </form>
            </CardContent>
        </UploadContainer>
    );
});

UploadForm.displayName = 'UploadForm';

export default UploadForm;