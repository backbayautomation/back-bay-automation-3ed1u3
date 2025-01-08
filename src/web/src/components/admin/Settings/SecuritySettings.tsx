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

// Enhanced interfaces for comprehensive security configuration
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

// Default security configuration values aligned with enterprise standards
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  mfaEnabled: true,
  ssoEnabled: true,
  sessionTimeout: 3600,
  passwordExpiryDays: 90,
  auditLoggingEnabled: true,
  allowedAuthProviders: ['azure-ad', 'google-workspace', 'okta'],
  rolePermissions: {
    [UserRole.SYSTEM_ADMIN]: ['*'],
    [UserRole.CLIENT_ADMIN]: ['read:*', 'write:own', 'manage:users'],
    [UserRole.REGULAR_USER]: ['read:own', 'write:own']
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
  const [config, setConfig] = useState<SecurityConfig>(DEFAULT_SECURITY_CONFIG);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Enhanced validation with comprehensive security checks
  const validateConfig = useCallback((newConfig: SecurityConfig): string[] => {
    const errors: string[] = [];

    if (!newConfig.mfaEnabled && !newConfig.ssoEnabled) {
      errors.push('At least one authentication method (MFA or SSO) must be enabled');
    }

    if (newConfig.sessionTimeout < 300 || newConfig.sessionTimeout > 86400) {
      errors.push('Session timeout must be between 5 minutes and 24 hours');
    }

    if (newConfig.securityPolicies.passwordMinLength < 12) {
      errors.push('Password minimum length must be at least 12 characters');
    }

    if (newConfig.passwordExpiryDays < 30 || newConfig.passwordExpiryDays > 180) {
      errors.push('Password expiry must be between 30 and 180 days');
    }

    return errors;
  }, []);

  // Enhanced change handler with audit logging
  const handleConfigChange = useCallback(async (field: string, value: any) => {
    try {
      const newConfig = {
        ...config,
        [field]: value
      };

      const errors = validateConfig(newConfig);
      setValidationErrors(errors);

      // Log security configuration change attempt
      console.log(`Security configuration change attempted: ${field}`, {
        previousValue: config[field as keyof SecurityConfig],
        newValue: value,
        timestamp: new Date().toISOString(),
        errors: errors.length > 0 ? errors : undefined
      });

      setConfig(newConfig);
      setHasChanges(true);
    } catch (error) {
      onError(error as Error);
    }
  }, [config, validateConfig, onError]);

  // Handle form submission with validation
  const handleSubmit = async () => {
    try {
      if (validationErrors.length > 0) {
        throw new Error('Please fix validation errors before saving');
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

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Authentication
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography component="div">
                    Multi-Factor Authentication
                    <Switch
                      checked={config.mfaEnabled}
                      onChange={(e) => handleConfigChange('mfaEnabled', e.target.checked)}
                      disabled={isValidating}
                    />
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography component="div">
                    Single Sign-On
                    <Switch
                      checked={config.ssoEnabled}
                      onChange={(e) => handleConfigChange('ssoEnabled', e.target.checked)}
                      disabled={isValidating}
                    />
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <FormField
                    name="sessionTimeout"
                    label="Session Timeout (seconds)"
                    type="number"
                    value={config.sessionTimeout.toString()}
                    onChange={(e) => handleConfigChange('sessionTimeout', parseInt(e.target.value))}
                    disabled={isValidating}
                    required
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Password Policy
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormField
                    name="passwordMinLength"
                    label="Minimum Password Length"
                    type="number"
                    value={config.securityPolicies.passwordMinLength.toString()}
                    onChange={(e) => handleConfigChange('securityPolicies', {
                      ...config.securityPolicies,
                      passwordMinLength: parseInt(e.target.value)
                    })}
                    disabled={isValidating}
                    required
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormField
                    name="passwordExpiryDays"
                    label="Password Expiry (days)"
                    type="number"
                    value={config.passwordExpiryDays.toString()}
                    onChange={(e) => handleConfigChange('passwordExpiryDays', parseInt(e.target.value))}
                    disabled={isValidating}
                    required
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Compliance Settings
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography component="div">
                    GDPR Compliance
                    <Switch
                      checked={config.complianceSettings.gdprEnabled}
                      onChange={(e) => handleConfigChange('complianceSettings', {
                        ...config.complianceSettings,
                        gdprEnabled: e.target.checked
                      })}
                      disabled={isValidating}
                    />
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography component="div">
                    SOC 2 Compliance
                    <Switch
                      checked={config.complianceSettings.soc2Enabled}
                      onChange={(e) => handleConfigChange('complianceSettings', {
                        ...config.complianceSettings,
                        soc2Enabled: e.target.checked
                      })}
                      disabled={isValidating}
                    />
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <FormField
                    name="auditRetentionDays"
                    label="Audit Log Retention (days)"
                    type="number"
                    value={config.complianceSettings.auditRetentionDays.toString()}
                    onChange={(e) => handleConfigChange('complianceSettings', {
                      ...config.complianceSettings,
                      auditRetentionDays: parseInt(e.target.value)
                    })}
                    disabled={isValidating}
                    required
                  />
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12}>
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
                    onClick={handleSubmit}
                    disabled={isValidating || !hasChanges || validationErrors.length > 0}
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