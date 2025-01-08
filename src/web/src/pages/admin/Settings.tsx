import React, { useState, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Tabs, 
  Tab, 
  Box, 
  Paper, 
  Typography, 
  CircularProgress,
  Alert
} from '@mui/material';
import { withErrorBoundary } from 'react-error-boundary';

// Layout and Settings Components
import MainLayout from '../../components/common/Layout/MainLayout';
import ApiSettings from '../../components/admin/Settings/ApiSettings';
import BrandingSettings from '../../components/admin/Settings/BrandingSettings';
import SecuritySettings from '../../components/admin/Settings/SecuritySettings';

// Interface for tab panel props with accessibility support
interface SettingsTabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
  ariaLabel: string;
  hasUnsavedChanges: boolean;
  onSave: (data: any) => Promise<void>;
}

// Interface for settings state management
interface SettingsState {
  loading: boolean;
  error: string | null;
  data: Record<string, any>;
  unsavedChanges: boolean;
  lastSaved: Date | null;
}

// Enhanced tab panel component with accessibility
const TabPanel: React.FC<SettingsTabPanelProps> = ({
  children,
  value,
  index,
  ariaLabel,
  hasUnsavedChanges,
  onSave
}) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      aria-label={ariaLabel}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// Main Settings component with error boundary
const Settings = withErrorBoundary(() => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState(0);
  const [state, setState] = useState<SettingsState>({
    loading: true,
    error: null,
    data: {},
    unsavedChanges: false,
    lastSaved: null
  });

  // Load initial settings data
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        
        // Fetch settings from API
        const response = await fetch('/api/v1/settings');
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to load settings');
        }

        setState(prev => ({
          ...prev,
          loading: false,
          data,
          error: null
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'An error occurred'
        }));
      }
    };

    loadSettings();
  }, []);

  // Handle tab changes with unsaved changes warning
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    if (state.unsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to switch tabs?')) {
        setActiveTab(newValue);
      }
    } else {
      setActiveTab(newValue);
    }
  }, [state.unsavedChanges]);

  // Generic save handler with error handling and audit logging
  const handleSave = useCallback(async (section: string, data: any) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch(`/api/v1/settings/${section}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      // Create audit log entry
      await fetch('/api/v1/audit/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: `UPDATE_${section.toUpperCase()}_SETTINGS`,
          details: data
        })
      });

      setState(prev => ({
        ...prev,
        loading: false,
        unsavedChanges: false,
        lastSaved: new Date(),
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    }
  }, []);

  return (
    <MainLayout portalType="admin">
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="Settings tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="API Settings" id="settings-tab-0" aria-controls="settings-tabpanel-0" />
            <Tab label="Branding" id="settings-tab-1" aria-controls="settings-tabpanel-1" />
            <Tab label="Security" id="settings-tab-2" aria-controls="settings-tabpanel-2" />
          </Tabs>
        </Box>

        {state.error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {state.error}
          </Alert>
        )}

        {state.loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TabPanel
              value={activeTab}
              index={0}
              ariaLabel="API settings"
              hasUnsavedChanges={state.unsavedChanges}
              onSave={(data) => handleSave('api', data)}
            >
              <ApiSettings
                onSave={(data) => handleSave('api', data)}
                isLoading={state.loading}
              />
            </TabPanel>

            <TabPanel
              value={activeTab}
              index={1}
              ariaLabel="Branding settings"
              hasUnsavedChanges={state.unsavedChanges}
              onSave={(data) => handleSave('branding', data)}
            >
              <BrandingSettings
                initialBranding={state.data.branding}
                onSave={(data) => handleSave('branding', data)}
                isLoading={state.loading}
                onDirtyChange={(isDirty) => setState(prev => ({ ...prev, unsavedChanges: isDirty }))}
              />
            </TabPanel>

            <TabPanel
              value={activeTab}
              index={2}
              ariaLabel="Security settings"
              hasUnsavedChanges={state.unsavedChanges}
              onSave={(data) => handleSave('security', data)}
            >
              <SecuritySettings
                isLoading={state.loading}
                isValidating={false}
                onSave={() => handleSave('security', state.data.security)}
                onCancel={() => setState(prev => ({ ...prev, unsavedChanges: false }))}
                onError={(error) => setState(prev => ({ ...prev, error: error.message }))}
              />
            </TabPanel>
          </>
        )}

        {state.lastSaved && (
          <Typography variant="caption" sx={{ p: 2, display: 'block', color: 'text.secondary' }}>
            Last saved: {state.lastSaved.toLocaleString()}
          </Typography>
        )}
      </Paper>
    </MainLayout>
  );
}, {
  fallback: <div>Error loading settings page. Please refresh.</div>,
  onError: (error) => {
    console.error('Settings Page Error:', error);
  }
});

Settings.displayName = 'Settings';

export default Settings;