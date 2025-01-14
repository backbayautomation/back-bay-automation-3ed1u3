import React from 'react';
import { Select, MenuItem, Button } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import FormField from '../../common/Forms/FormField';
import type { FormFieldProps } from '../../common/Forms/FormField';
import { User, UserRole, UserCreateInput, UserUpdateInput } from '../../../types/user';
import { userCreateSchema, userUpdateSchema } from '../../../validators/user';

/**
 * Props interface for UserForm component with enhanced type safety
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
 * Enhanced form component for creating and editing users with accessibility and validation
 */
export const UserForm = React.memo<UserFormProps>(({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  clientId,
  allowedRoles,
}) => {
  // Initialize form with Zod schema validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<UserCreateInput | UserUpdateInput>({
    resolver: zodResolver(initialData ? userUpdateSchema : userCreateSchema),
    defaultValues: {
      email: initialData?.email || '',
      fullName: initialData?.fullName || '',
      role: initialData?.role || UserRole.REGULAR_USER,
      clientId: clientId,
      isActive: initialData?.isActive ?? true,
    },
  });

  // Watch form values for dynamic validation
  const selectedRole = watch('role');

  // Common field props for accessibility
  const getFieldProps = (name: string): Partial<FormFieldProps> => ({
    fullWidth: true,
    required: true,
    error: errors[name]?.message as string,
    disabled: isLoading,
    'aria-describedby': `${name}-error`,
  });

  // Handle form submission with validation
  const handleFormSubmit = async (data: UserCreateInput | UserUpdateInput) => {
    try {
      await onSubmit(data);
    } catch (error) {
      // Error handling is managed by the parent component
      console.error('Form submission error:', error);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit)}
      aria-label={initialData ? 'Edit User Form' : 'Create User Form'}
      noValidate
    >
      <FormField
        {...register('email')}
        {...getFieldProps('email')}
        label="Email Address"
        type="email"
        placeholder="user@example.com"
        inputMode="email"
      />

      <FormField
        {...register('fullName')}
        {...getFieldProps('fullName')}
        label="Full Name"
        type="text"
        placeholder="John Doe"
      />

      {!initialData && (
        <FormField
          {...register('password')}
          {...getFieldProps('password')}
          label="Password"
          type="password"
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
        aria-label="User Role"
        sx={{ my: 2 }}
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

      {selectedRole === UserRole.CLIENT_ADMIN && (
        <FormField
          {...register('clientId')}
          {...getFieldProps('clientId')}
          label="Client ID"
          type="text"
          value={clientId}
          disabled={true}
        />
      )}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={isLoading || isSubmitting}
          aria-busy={isLoading || isSubmitting}
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