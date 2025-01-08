import React from 'react'; // v18.2.0
import { Select, MenuItem, Button } from '@mui/material'; // v5.14.0
import { useForm } from 'react-hook-form'; // v7.45.0
import { zodResolver } from '@hookform/resolvers/zod'; // v3.0.0

import FormField from '../../common/Forms/FormField';
import type { FormFieldProps } from '../../common/Forms/FormField';
import { User, UserRole, UserCreateInput, UserUpdateInput } from '../../../types/user';
import { userCreateSchema, userUpdateSchema } from '../../../validators/user';

/**
 * Props interface for UserForm component with enhanced type safety
 */
export interface UserFormProps {
  initialData?: User;
  onSubmit: (data: UserCreateInput | UserUpdateInput) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  clientId: string;
  allowedRoles: UserRole[];
}

/**
 * Enhanced form component for creating and editing users with accessibility and validation
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
  } = useForm<UserCreateInput | UserUpdateInput>({
    resolver: zodResolver(initialData ? userUpdateSchema : userCreateSchema),
    defaultValues: {
      email: initialData?.email || '',
      fullName: initialData?.fullName || '',
      role: initialData?.role || UserRole.REGULAR_USER,
      clientId: clientId,
      isActive: initialData?.isActive ?? true
    }
  });

  // Watch form values for dynamic validation
  const selectedRole = watch('role');

  // Common field props for accessibility
  const getFieldProps = (name: string): Partial<FormFieldProps> => ({
    required: true,
    fullWidth: true,
    disabled: isLoading || isSubmitting,
    error: errors[name]?.message as string,
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined
  });

  // Handle form submission with validation
  const onFormSubmit = async (data: UserCreateInput | UserUpdateInput) => {
    try {
      await onSubmit(data);
    } catch (error) {
      // Error handling is managed by the parent component
      console.error('Form submission error:', error);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(onFormSubmit)}
      noValidate
      aria-label={initialData ? 'Edit User Form' : 'Create User Form'}
    >
      <FormField
        {...register('email')}
        {...getFieldProps('email')}
        name="email"
        label="Email Address"
        type="email"
        inputMode="email"
        placeholder="user@example.com"
        data-testid="user-email-input"
      />

      <FormField
        {...register('fullName')}
        {...getFieldProps('fullName')}
        name="fullName"
        label="Full Name"
        type="text"
        placeholder="Enter full name"
        data-testid="user-fullname-input"
      />

      {!initialData && (
        <FormField
          {...register('password')}
          {...getFieldProps('password')}
          name="password"
          label="Password"
          type="password"
          placeholder="Enter password"
          helperText="Must be at least 8 characters with uppercase, lowercase, number and special character"
          data-testid="user-password-input"
        />
      )}

      <Select
        {...register('role')}
        value={selectedRole}
        onChange={(e) => setValue('role', e.target.value as UserRole)}
        fullWidth
        disabled={isLoading || isSubmitting}
        error={!!errors.role}
        aria-label="User Role"
        data-testid="user-role-select"
      >
        {allowedRoles.map((role) => (
          <MenuItem 
            key={role} 
            value={role}
            aria-label={`Role: ${role}`}
          >
            {role.replace('_', ' ')}
          </MenuItem>
        ))}
      </Select>

      {errors.role && (
        <div 
          role="alert" 
          aria-live="polite" 
          className="error-message"
          id="role-error"
        >
          {errors.role.message}
        </div>
      )}

      <div className="form-actions">
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={isLoading || isSubmitting}
          aria-busy={isSubmitting}
          data-testid="submit-button"
        >
          {initialData ? 'Update User' : 'Create User'}
        </Button>
        
        <Button
          type="button"
          variant="outlined"
          onClick={onCancel}
          disabled={isLoading || isSubmitting}
          data-testid="cancel-button"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
});

UserForm.displayName = 'UserForm';

export default UserForm;