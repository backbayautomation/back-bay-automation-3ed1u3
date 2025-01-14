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

// Layout and settings components
import MainLayout from '../../components/common/Layout/MainLayout';
import ApiSettings from '../../components/admin/Settings/ApiSettings';
import BrandingSettings from '../../components/admin/Settings/BrandingSettings';
import SecuritySettings from '../../components/admin/Settings/SecuritySettings';

// Interfaces for settings tab panel
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

// Tab panel component with accessibility support
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

// Main settings component with error boundary
const Settings = withErrorBoundary(() => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState<SettingsState>({
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
        setSettings(prev => ({ ...prev, loading: true, error: null }));
        // API call to load settings would go here
        const response = await fetch('/api/v1/settings');
        const data = await response.json();
        
        setSettings(prev => ({
          ...prev,
          loading: false,
          data,
          error: null
        }));
      } catch (error) {
        setSettings(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load settings'
        }));
      }
    };

    loadSettings();
  }, []);

  // Handle tab changes with unsaved changes warning
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    if (settings.unsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to switch tabs?')) {
        setActiveTab(newValue);
      }
    } else {
      setActiveTab(newValue);
    }
  }, [settings.unsavedChanges]);

  // Generic save handler for all settings types
  const handleSaveSettings = useCallback(async (type: string, data: any) => {
    try {
      setSettings(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch(`/api/v1/settings/${type}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSettings(prev => ({
        ...prev,
        loading: false,
        unsavedChanges: false,
        lastSaved: new Date(),
        error: null
      }));

    } catch (error) {
      setSettings(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to save settings'
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

        {settings.error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {settings.error}
          </Alert>
        )}

        {settings.loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TabPanel
              value={activeTab}
              index={0}
              ariaLabel="API settings panel"
              hasUnsavedChanges={settings.unsavedChanges}
              onSave={(data) => handleSaveSettings('api', data)}
            >
              <ApiSettings
                initialSettings={settings.data.api}
                onSave={(data) => handleSaveSettings('api', data)}
                isLoading={settings.loading}
                onDirtyChange={(isDirty) => 
                  setSettings(prev => ({ ...prev, unsavedChanges: isDirty }))
                }
              />
            </TabPanel>

            <TabPanel
              value={activeTab}
              index={1}
              ariaLabel="Branding settings panel"
              hasUnsavedChanges={settings.unsavedChanges}
              onSave={(data) => handleSaveSettings('branding', data)}
            >
              <BrandingSettings
                initialBranding={settings.data.branding}
                onSave={(data) => handleSaveSettings('branding', data)}
                isLoading={settings.loading}
                onDirtyChange={(isDirty) => 
                  setSettings(prev => ({ ...prev, unsavedChanges: isDirty }))
                }
              />
            </TabPanel>

            <TabPanel
              value={activeTab}
              index={2}
              ariaLabel="Security settings panel"
              hasUnsavedChanges={settings.unsavedChanges}
              onSave={(data) => handleSaveSettings('security', data)}
            >
              <SecuritySettings
                isLoading={settings.loading}
                isValidating={false}
                onSave={() => handleSaveSettings('security', settings.data.security)}
                onCancel={() => setSettings(prev => ({ ...prev, unsavedChanges: false }))}
                onError={(error) => setSettings(prev => ({ 
                  ...prev, 
                  error: error.message 
                }))}
              />
            </TabPanel>
          </>
        )}

        {settings.lastSaved && (
          <Typography 
            variant="caption" 
            sx={{ p: 2, display: 'block', textAlign: 'right' }}
          >
            Last saved: {settings.lastSaved.toLocaleString()}
          </Typography>
        )}
      </Paper>
    </MainLayout>
  );
}, {
  fallback: (
    <MainLayout portalType="admin">
      <Alert severity="error">
        Failed to load settings. Please refresh the page.
      </Alert>
    </MainLayout>
  )
});

Settings.displayName = 'Settings';

export default Settings;