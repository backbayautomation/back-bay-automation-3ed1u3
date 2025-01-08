import React, { useCallback, useEffect } from 'react'; // v18.2.0
import { useForm } from 'react-hook-form'; // v7.45.0
import { zodResolver } from '@hookform/resolvers/zod'; // v3.3.0
import { z } from 'zod'; // v3.22.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11
import throttle from 'lodash/throttle'; // v4.1.1
import { FormField } from '../../common/Forms/FormField';
import { useAuth } from '../../../hooks/useAuth';
import { UserRole } from '../../../types/auth';
import { audit } from '@company/audit-log'; // v1.0.0
import { validateCsrfToken } from '@company/security'; // v1.0.0

// Client form validation schema with strict typing
const clientFormSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  industry: z.string()
    .min(1, 'Industry is required'),
  maxUsers: z.number()
    .int()
    .min(1, 'Must allow at least 1 user')
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

// Props interface with enhanced security types
interface ClientFormProps {
  initialData?: ClientFormData;
  onSuccess: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  csrfToken: string;
}

// Error fallback component with accessibility
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div role="alert" className="error-container">
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

export const ClientForm: React.FC<ClientFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  isSubmitting,
  csrfToken
}) => {
  const { user } = useAuth();
  
  // Form initialization with validation
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setError
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: initialData || {
      name: '',
      industry: '',
      maxUsers: 10,
      settings: {
        theme: 'system',
        language: 'en',
        features: {
          chat: true,
          export: false
        }
      }
    }
  });

  // Reset form when initial data changes
  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  // Throttled form submission with security checks
  const onSubmit = useCallback(
    throttle(async (data: ClientFormData) => {
      try {
        // Validate CSRF token
        if (!validateCsrfToken(csrfToken)) {
          throw new Error('Invalid security token');
        }

        // Check user permissions
        if (!user || user.role !== UserRole.SYSTEM_ADMIN) {
          throw new Error('Insufficient permissions');
        }

        // Sanitize input data
        const sanitizedData = {
          ...data,
          name: data.name.trim(),
          industry: data.industry.trim()
        };

        // Submit data to API
        const response = await fetch('/api/clients', {
          method: initialData ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify(sanitizedData)
        });

        if (!response.ok) {
          throw new Error('Failed to save client');
        }

        // Log audit trail
        await audit.log({
          action: initialData ? 'UPDATE_CLIENT' : 'CREATE_CLIENT',
          actor: user.id,
          target: 'client',
          details: sanitizedData
        });

        onSuccess();
      } catch (error) {
        setError('root', {
          type: 'submit',
          message: error instanceof Error ? error.message : 'An error occurred'
        });
      }
    }, 1000),
    [csrfToken, initialData, onSuccess, setError, user]
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="client-form"
        noValidate
        aria-label="Client management form"
      >
        <FormField
          {...register('name')}
          label="Client Name"
          error={errors.name?.message}
          required
          maxLength={100}
          disabled={isSubmitting}
        />

        <FormField
          {...register('industry')}
          label="Industry"
          error={errors.industry?.message}
          required
          disabled={isSubmitting}
        />

        <FormField
          {...register('maxUsers', { valueAsNumber: true })}
          label="Maximum Users"
          type="number"
          error={errors.maxUsers?.message}
          required
          disabled={isSubmitting}
        />

        <fieldset>
          <legend>Portal Settings</legend>
          
          <FormField
            {...register('settings.theme')}
            label="Theme"
            type="select"
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System Default' }
            ]}
            error={errors.settings?.theme?.message}
            disabled={isSubmitting}
          />

          <FormField
            {...register('settings.language')}
            label="Language"
            type="select"
            options={[
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Español' },
              { value: 'fr', label: 'Français' }
            ]}
            error={errors.settings?.language?.message}
            disabled={isSubmitting}
          />

          <div className="feature-toggles">
            <FormField
              {...register('settings.features.chat')}
              label="Enable Chat"
              type="checkbox"
              error={errors.settings?.features?.chat?.message}
              disabled={isSubmitting}
            />

            <FormField
              {...register('settings.features.export')}
              label="Enable Export"
              type="checkbox"
              error={errors.settings?.features?.export?.message}
              disabled={isSubmitting}
            />
          </div>
        </fieldset>

        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn-secondary"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="btn-primary"
          >
            {isSubmitting ? 'Saving...' : initialData ? 'Update Client' : 'Create Client'}
          </button>
        </div>
      </form>
    </ErrorBoundary>
  );
};

export type { ClientFormProps };
export default ClientForm;