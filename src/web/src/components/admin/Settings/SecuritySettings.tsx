import React, { useCallback, useEffect, useState } from 'react'; // v18.2.0
import { useDispatch, useSelector } from 'react-redux'; // v8.1.0
import { 
  Card, 
  CardContent, 
  Typography, 
  Switch, 
  Grid, 
  Alert, 
  CircularProgress 
} from '@mui/material'; // v5.14.0
import { FormField, FormFieldProps } from '../../common/Forms/FormField';
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

export interface SecuritySettingsProps {
  isLoading: boolean;
  isValidating: boolean;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onError: (error: Error) => void;
}

const defaultSecurityConfig: SecurityConfig = {
  mfaEnabled: false,
  ssoEnabled: false,
  sessionTimeout: 3600,
  passwordExpiryDays: 90,
  auditLoggingEnabled: true,
  allowedAuthProviders: ['azure-ad', 'google-workspace'],
  rolePermissions: {
    [UserRole.SYSTEM_ADMIN]: ['*'],
    [UserRole.CLIENT_ADMIN]: ['read:*', 'write:client_data'],
    [UserRole.REGULAR_USER]: ['read:documents']
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
    gdprEnabled: false,
    soc2Enabled: false,
    hipaaEnabled: false,
    auditRetentionDays: 365,
    dataResidency: ['us-east']
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
  const [config, setConfig] = useState<SecurityConfig>(defaultSecurityConfig);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Validation function for security configuration
  const validateConfig = useCallback((newConfig: SecurityConfig): string[] => {
    const errors: string[] = [];

    if (newConfig.sessionTimeout < 300 || newConfig.sessionTimeout > 86400) {
      errors.push('Session timeout must be between 5 minutes and 24 hours');
    }

    if (newConfig.passwordExpiryDays < 30 || newConfig.passwordExpiryDays > 365) {
      errors.push('Password expiry must be between 30 and 365 days');
    }

    if (newConfig.securityPolicies.passwordMinLength < 8) {
      errors.push('Minimum password length must be at least 8 characters');
    }

    return errors;
  }, []);

  // Enhanced change handler with audit logging
  const handleConfigChange = useCallback(async (
    field: keyof SecurityConfig | string,
    value: any
  ) => {
    try {
      const newConfig = {
        ...config,
        [field]: value
      };

      // Validate changes
      const errors = validateConfig(newConfig);
      setValidationErrors(errors);

      // Update state
      setConfig(newConfig);
      setHasUnsavedChanges(true);

      // Log configuration change attempt
      console.log(`Security configuration change attempted: ${field}`, {
        previousValue: config[field as keyof SecurityConfig],
        newValue: value,
        timestamp: new Date().toISOString(),
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      onError(error as Error);
    }
  }, [config, validateConfig, onError]);

  // Save handler with validation
  const handleSave = async () => {
    try {
      if (validationErrors.length > 0) {
        throw new Error('Please fix validation errors before saving');
      }

      await onSave();
      setHasUnsavedChanges(false);
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
                    name="mfa"
                    label="Multi-Factor Authentication"
                    type="text"
                    value={config.mfaEnabled ? 'Enabled' : 'Disabled'}
                    disabled={true}
                    onChange={() => {}}
                  />
                  <Switch
                    checked={config.mfaEnabled}
                    onChange={(e) => handleConfigChange('mfaEnabled', e.target.checked)}
                    disabled={isValidating}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormField
                    name="sessionTimeout"
                    label="Session Timeout (seconds)"
                    type="number"
                    value={config.sessionTimeout.toString()}
                    onChange={(e) => handleConfigChange('sessionTimeout', parseInt(e.target.value))}
                    disabled={isValidating}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Password Policies */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Password Policies
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormField
                    name="passwordMinLength"
                    label="Minimum Password Length"
                    type="number"
                    value={config.securityPolicies.passwordMinLength.toString()}
                    onChange={(e) => handleConfigChange('securityPolicies.passwordMinLength', parseInt(e.target.value))}
                    disabled={isValidating}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormField
                    name="passwordExpiryDays"
                    label="Password Expiry (days)"
                    type="number"
                    value={config.passwordExpiryDays.toString()}
                    onChange={(e) => handleConfigChange('passwordExpiryDays', parseInt(e.target.value))}
                    disabled={isValidating}
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
                  <Typography>GDPR Compliance</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Switch
                    checked={config.complianceSettings.soc2Enabled}
                    onChange={(e) => handleConfigChange('complianceSettings.soc2Enabled', e.target.checked)}
                    disabled={isValidating}
                  />
                  <Typography>SOC 2 Compliance</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormField
                    name="auditRetentionDays"
                    label="Audit Log Retention (days)"
                    type="number"
                    value={config.complianceSettings.auditRetentionDays.toString()}
                    onChange={(e) => handleConfigChange('complianceSettings.auditRetentionDays', parseInt(e.target.value))}
                    disabled={isValidating}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="error">
                  <ul>
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </Alert>
              </Grid>
            )}

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Grid container spacing={2} justifyContent="flex-end">
                <Grid item>
                  <button
                    onClick={onCancel}
                    disabled={isValidating || !hasUnsavedChanges}
                  >
                    Cancel
                  </button>
                </Grid>
                <Grid item>
                  <button
                    onClick={handleSave}
                    disabled={isValidating || validationErrors.length > 0 || !hasUnsavedChanges}
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

export default SecuritySettings;