import React, { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form'; // v7.45.0
import { zodResolver } from '@hookform/resolvers/zod'; // v3.3.0
import { z } from 'zod'; // v3.22.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11
import throttle from 'lodash/throttle'; // v4.1.1
import { FormField, FormFieldProps } from '../../common/Forms/FormField';
import { useAuth } from '../../../hooks/useAuth';
import { auditLog } from '@company/audit-log'; // v1.0.0
import { validateCsrfToken } from '@company/security'; // v1.0.0
import type { Organization, UUID } from '../../../types/common';

// Client form validation schema with strict typing
const clientFormSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name can only contain letters, numbers, spaces, hyphens and underscores'),
  industry: z.string()
    .min(1, 'Industry is required'),
  maxUsers: z.number()
    .int()
    .min(1, 'Must have at least 1 user')
    .max(1000, 'Cannot exceed 1000 users'),
  settings: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    language: z.enum(['en', 'es', 'fr']),
    features: z.object({
      chat: z.boolean(),
      export: z.boolean()
    })
  })
});

type ClientFormData = z.infer<typeof clientFormSchema>;

// Props interface with security-related properties
interface ClientFormProps {
  initialData?: Partial<ClientFormData>;
  onSuccess: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  csrfToken: string;
}

// Form field configuration with accessibility attributes
const formFields: Array<FormFieldProps & { name: keyof ClientFormData }> = [
  {
    name: 'name',
    label: 'Client Name',
    type: 'text',
    required: true,
    maxLength: 100,
    placeholder: 'Enter client name'
  },
  {
    name: 'industry',
    label: 'Industry',
    type: 'text',
    required: true,
    placeholder: 'Select industry'
  },
  {
    name: 'maxUsers',
    label: 'Maximum Users',
    type: 'number',
    required: true,
    inputMode: 'numeric'
  }
];

// Custom hook for form validation and sanitization
const useClientFormValidation = (data: ClientFormData) => {
  return clientFormSchema.safeParse(data);
};

// Custom hook for secure form submission with throttling
const useClientFormSubmission = (csrfToken: string) => {
  const { user } = useAuth();

  const submitForm = useCallback(
    throttle(async (data: ClientFormData) => {
      try {
        // Validate CSRF token
        await validateCsrfToken(csrfToken);

        // Submit data with proper authorization
        const response = await fetch('/api/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            ...data,
            orgId: user?.orgId
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create client');
        }

        // Log audit trail
        await auditLog({
          action: 'client_created',
          actor: user?.id as UUID,
          target: await response.json().then(data => data.id),
          metadata: { clientName: data.name }
        });

        return response.json();
      } catch (error) {
        console.error('Form submission error:', error);
        throw error;
      }
    }, 1000),
    [csrfToken, user]
  );

  return submitForm;
};

// Error fallback component
const FormErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div role="alert" className="error-container">
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

// Main client form component
export const ClientForm: React.FC<ClientFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  isSubmitting,
  csrfToken
}) => {
  const { user } = useAuth();
  const submitForm = useClientFormSubmission(csrfToken);

  // Initialize form with react-hook-form and zod validation
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: initialData
  });

  // Reset form when initial data changes
  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  // Handle form submission with validation and security checks
  const onSubmit = async (data: ClientFormData) => {
    try {
      const validationResult = useClientFormValidation(data);
      
      if (!validationResult.success) {
        throw new Error('Invalid form data');
      }

      await submitForm(validationResult.data);
      onSuccess();
    } catch (error) {
      console.error('Form submission error:', error);
      throw error;
    }
  };

  return (
    <ErrorBoundary FallbackComponent={FormErrorFallback}>
      <form 
        onSubmit={handleSubmit(onSubmit)}
        className="client-form"
        aria-label="Client Management Form"
      >
        {formFields.map((field) => (
          <FormField
            key={field.name}
            {...field}
            {...register(field.name)}
            error={errors[field.name]?.message}
            disabled={isSubmitting}
          />
        ))}

        <div className="form-controls">
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Client'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </ErrorBoundary>
  );
};

// Named export for the props interface
export type { ClientFormProps };

// Default export
export default ClientForm;