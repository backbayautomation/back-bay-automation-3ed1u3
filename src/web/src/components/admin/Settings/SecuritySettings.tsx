import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Card, 
  CardContent, 
  Typography, 
  Switch, 
  Grid, 
  Alert, 
  CircularProgress 
} from '@mui/material'; // v5.14.0
import FormField, { FormFieldProps } from '../../common/Forms/FormField';
import { UserRole } from '../../../types/auth';

// Enhanced interfaces for security configuration
interface SecurityPolicyConfig {
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireUppercase: boolean;
  maxLoginAttempts: number;
  lockoutDuration: number;
  ipWhitelist: string[];
}

interface ComplianceConfig {
  gdprEnabled: boolean;
  soc2Enabled: boolean;
  hipaaEnabled: boolean;
  auditRetentionDays: number;
  dataResidency: string[];
}

interface SecurityConfig {
  mfaEnabled: boolean;
  ssoEnabled: boolean;
  sessionTimeout: number;
  passwordExpiryDays: number;
  auditLoggingEnabled: boolean;
  allowedAuthProviders: string[];
  rolePermissions: Record<string, string[]>;
  securityPolicies: SecurityPolicyConfig;
  complianceSettings: ComplianceConfig;
}

interface SecuritySettingsProps {
  isLoading: boolean;
  isValidating: boolean;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onError: (error: Error) => void;
}

// Initial security configuration state
const initialSecurityConfig: SecurityConfig = {
  mfaEnabled: false,
  ssoEnabled: false,
  sessionTimeout: 3600,
  passwordExpiryDays: 90,
  auditLoggingEnabled: true,
  allowedAuthProviders: ['azure-ad', 'google-workspace'],
  rolePermissions: {
    [UserRole.SYSTEM_ADMIN]: ['*'],
    [UserRole.CLIENT_ADMIN]: ['read:*', 'write:own', 'manage:users'],
    [UserRole.REGULAR_USER]: ['read:own']
  },
  securityPolicies: {
    passwordMinLength: 12,
    passwordRequireSpecialChar: true,
    passwordRequireNumbers: true,
    passwordRequireUppercase: true,
    maxLoginAttempts: 5,
    lockoutDuration: 900,
    ipWhitelist: []
  },
  complianceSettings: {
    gdprEnabled: true,
    soc2Enabled: true,
    hipaaEnabled: false,
    auditRetentionDays: 365,
    dataResidency: ['us-east', 'eu-west']
  }
};

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  isLoading,
  isValidating,
  onSave,
  onCancel,
  onError
}) => {
  const dispatch = useDispatch();
  const [config, setConfig] = useState<SecurityConfig>(initialSecurityConfig);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Validation function for security settings
  const validateConfig = useCallback((newConfig: SecurityConfig): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (newConfig.sessionTimeout < 300 || newConfig.sessionTimeout > 86400) {
      errors.sessionTimeout = 'Session timeout must be between 5 minutes and 24 hours';
    }

    if (newConfig.passwordExpiryDays < 30 || newConfig.passwordExpiryDays > 365) {
      errors.passwordExpiryDays = 'Password expiry must be between 30 and 365 days';
    }

    if (newConfig.securityPolicies.passwordMinLength < 8) {
      errors['securityPolicies.passwordMinLength'] = 'Minimum password length must be at least 8 characters';
    }

    return errors;
  }, []);

  // Audit log function for security changes
  const logSecurityChange = useCallback(async (field: string, oldValue: any, newValue: any) => {
    try {
      // Implement audit logging logic here
      console.log(`Security setting changed: ${field}`, { oldValue, newValue });
    } catch (error) {
      console.error('Failed to log security change:', error);
    }
  }, []);

  // Enhanced change handler with validation and audit logging
  const handleConfigChange = useCallback(async (field: string, value: any) => {
    try {
      const oldValue = config[field as keyof SecurityConfig];
      const newConfig = { ...config, [field]: value };
      
      // Validate the new configuration
      const errors = validateConfig(newConfig);
      setValidationErrors(errors);

      // Update state if validation passes
      if (Object.keys(errors).length === 0) {
        setConfig(newConfig);
        setHasChanges(true);
        await logSecurityChange(field, oldValue, value);
      }
    } catch (error) {
      onError(error as Error);
    }
  }, [config, validateConfig, logSecurityChange, onError]);

  // Save handler with validation
  const handleSave = async () => {
    try {
      const errors = validateConfig(config);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      await onSave();
      setHasChanges(false);
    } catch (error) {
      onError(error as Error);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Security Settings
        </Typography>

        {isLoading ? (
          <CircularProgress />
        ) : (
          <Grid container spacing={3}>
            {/* Authentication Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Authentication
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormField
                    name="mfaEnabled"
                    label="Multi-Factor Authentication"
                    value={config.mfaEnabled.toString()}
                    type="text"
                    disabled={isValidating}
                    onChange={(e) => handleConfigChange('mfaEnabled', e.target.value === 'true')}
                    error={validationErrors.mfaEnabled}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormField
                    name="sessionTimeout"
                    label="Session Timeout (seconds)"
                    value={config.sessionTimeout.toString()}
                    type="number"
                    disabled={isValidating}
                    onChange={(e) => handleConfigChange('sessionTimeout', parseInt(e.target.value))}
                    error={validationErrors.sessionTimeout}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Password Policy Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Password Policy
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormField
                    name="passwordMinLength"
                    label="Minimum Password Length"
                    value={config.securityPolicies.passwordMinLength.toString()}
                    type="number"
                    disabled={isValidating}
                    onChange={(e) => handleConfigChange('securityPolicies.passwordMinLength', parseInt(e.target.value))}
                    error={validationErrors['securityPolicies.passwordMinLength']}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormField
                    name="passwordExpiryDays"
                    label="Password Expiry (days)"
                    value={config.passwordExpiryDays.toString()}
                    type="number"
                    disabled={isValidating}
                    onChange={(e) => handleConfigChange('passwordExpiryDays', parseInt(e.target.value))}
                    error={validationErrors.passwordExpiryDays}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Compliance Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Compliance
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Switch
                    checked={config.complianceSettings.gdprEnabled}
                    onChange={(e) => handleConfigChange('complianceSettings.gdprEnabled', e.target.checked)}
                    disabled={isValidating}
                  />
                  <Typography component="span">GDPR Compliance</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Switch
                    checked={config.complianceSettings.soc2Enabled}
                    onChange={(e) => handleConfigChange('complianceSettings.soc2Enabled', e.target.checked)}
                    disabled={isValidating}
                  />
                  <Typography component="span">SOC 2 Compliance</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Switch
                    checked={config.complianceSettings.hipaaEnabled}
                    onChange={(e) => handleConfigChange('complianceSettings.hipaaEnabled', e.target.checked)}
                    disabled={isValidating}
                  />
                  <Typography component="span">HIPAA Compliance</Typography>
                </Grid>
              </Grid>
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              {hasChanges && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  You have unsaved changes. Please save or cancel your changes.
                </Alert>
              )}
              <Grid container spacing={2} justifyContent="flex-end">
                <Grid item>
                  <button
                    onClick={onCancel}
                    disabled={isValidating || !hasChanges}
                  >
                    Cancel
                  </button>
                </Grid>
                <Grid item>
                  <button
                    onClick={handleSave}
                    disabled={isValidating || !hasChanges || Object.keys(validationErrors).length > 0}
                  >
                    Save Changes
                  </button>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
};

export type { SecuritySettingsProps };
export default SecuritySettings;