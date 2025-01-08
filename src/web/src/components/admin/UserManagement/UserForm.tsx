import React from 'react'; // v18.2.0
import { Select, MenuItem, Button } from '@mui/material'; // v5.14.0
import { useForm } from 'react-hook-form'; // v7.45.0
import { zodResolver } from '@hookform/resolvers/zod'; // v3.0.0

import FormField from '../../common/Forms/FormField';
import type { FormFieldProps } from '../../common/Forms/FormField';
import { User, UserRole } from '../../../types/user';
import { userValidation } from '../../../validators/user';
import { sanitizeString } from '../../../utils/validation';

/**
 * Props interface for UserForm component with comprehensive type safety
 */
interface UserFormProps {
  initialData?: User;
  onSubmit: (data: UserCreateInput | UserUpdateInput) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  clientId: string;
  allowedRoles: UserRole[];
}

/**
 * Type for form data with strict validation
 */
interface UserFormData {
  email: string;
  fullName: string;
  password?: string;
  role: UserRole;
  isActive: boolean;
  clientId: string | null;
}

/**
 * Enhanced form component for creating and editing users with accessibility
 * and comprehensive validation support. Implements WCAG 2.1 AA standards.
 */
export const UserForm = React.memo<UserFormProps>(({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  clientId,
  allowedRoles
}) => {
  // Initialize form with react-hook-form and zod validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue
  } = useForm<UserFormData>({
    resolver: zodResolver(initialData ? userValidation.updateSchema : userValidation.createSchema),
    defaultValues: {
      email: initialData?.email || '',
      fullName: initialData?.fullName || '',
      role: initialData?.role || UserRole.REGULAR_USER,
      isActive: initialData?.isActive ?? true,
      clientId: clientId || null
    }
  });

  // Watch form values for dynamic validation
  const selectedRole = watch('role');

  // Common field props for accessibility and validation
  const getFieldProps = (name: keyof UserFormData, label: string): FormFieldProps => ({
    name,
    label,
    error: errors[name]?.message,
    required: true,
    disabled: isLoading,
    fullWidth: true,
    onChange: (e) => setValue(name, sanitizeString(e.target.value)),
    'aria-label': label,
    'aria-invalid': !!errors[name],
    'aria-describedby': `${name}-error`
  });

  // Handle form submission with validation
  const onFormSubmit = async (data: UserFormData) => {
    try {
      await onSubmit({
        ...data,
        clientId: selectedRole === UserRole.SYSTEM_ADMIN ? null : clientId
      });
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(onFormSubmit)}
      noValidate
      aria-label="User form"
      role="form"
    >
      <FormField
        {...getFieldProps('email', 'Email Address')}
        type="email"
        inputMode="email"
        autoComplete="email"
      />

      <FormField
        {...getFieldProps('fullName', 'Full Name')}
        type="text"
        inputMode="text"
        autoComplete="name"
      />

      {!initialData && (
        <FormField
          {...getFieldProps('password', 'Password')}
          type="password"
          autoComplete="new-password"
          helperText="Must be at least 8 characters with uppercase, lowercase, number and special character"
        />
      )}

      <Select
        {...register('role')}
        value={selectedRole}
        onChange={(e) => setValue('role', e.target.value as UserRole)}
        fullWidth
        disabled={isLoading}
        error={!!errors.role}
        aria-label="User role"
        aria-invalid={!!errors.role}
        aria-describedby="role-error"
        sx={{ my: 2 }}
      >
        {allowedRoles.map((role) => (
          <MenuItem 
            key={role} 
            value={role}
            role="option"
            aria-selected={selectedRole === role}
          >
            {role.replace('_', ' ')}
          </MenuItem>
        ))}
      </Select>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={isLoading || isSubmitting}
          aria-busy={isSubmitting}
        >
          {initialData ? 'Update User' : 'Create User'}
        </Button>
        
        <Button
          type="button"
          variant="outlined"
          onClick={onCancel}
          disabled={isLoading || isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
});

// Display name for debugging
UserForm.displayName = 'UserForm';

export default UserForm;