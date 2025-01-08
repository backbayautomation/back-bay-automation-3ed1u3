import React, { useState, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  useTheme
} from '@mui/material';
import { withErrorBoundary } from 'react-error-boundary';

// Layout and Settings Components
import MainLayout from '../../components/common/Layout/MainLayout';
import ApiSettings from '../../components/admin/Settings/ApiSettings';
import BrandingSettings from '../../components/admin/Settings/BrandingSettings';
import SecuritySettings from '../../components/admin/Settings/SecuritySettings';

// Interface for settings tab panel props
interface SettingsTabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
  ariaLabel: string;
  hasUnsavedChanges: boolean;
  onSave: (data: any) => Promise<void>;
}

// Interface for settings state
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

// Main settings component with error boundary
const Settings: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();

  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [settingsState, setSettingsState] = useState<SettingsState>({
    loading: true,
    error: null,
    data: {},
    unsavedChanges: false,
    lastSaved: null
  });

  // Handle tab changes with unsaved changes warning
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    if (settingsState.unsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to switch tabs?')) {
        setActiveTab(newValue);
      }
    } else {
      setActiveTab(newValue);
    }
  }, [settingsState.unsavedChanges]);

  // Load initial settings data
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setSettingsState(prev => ({ ...prev, loading: true, error: null }));
        // TODO: Implement settings loading from API
        setSettingsState(prev => ({ ...prev, loading: false }));
      } catch (error) {
        setSettingsState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load settings'
        }));
      }
    };

    loadSettings();
  }, []);

  // Handle settings updates
  const handleSettingsUpdate = useCallback(async (section: string, data: any) => {
    try {
      setSettingsState(prev => ({ ...prev, loading: true, error: null }));
      // TODO: Implement settings update API call
      setSettingsState(prev => ({
        ...prev,
        loading: false,
        data: { ...prev.data, [section]: data },
        unsavedChanges: false,
        lastSaved: new Date()
      }));
    } catch (error) {
      setSettingsState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to save settings'
      }));
    }
  }, []);

  // Handle changes in settings forms
  const handleDirtyChange = useCallback((isDirty: boolean) => {
    setSettingsState(prev => ({ ...prev, unsavedChanges: isDirty }));
  }, []);

  return (
    <MainLayout portalType="admin">
      <Paper elevation={2} sx={{ margin: theme.spacing(3) }}>
        {/* Header with save status */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', p: 2 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            System Settings
          </Typography>
          {settingsState.lastSaved && (
            <Typography variant="caption" color="textSecondary">
              Last saved: {settingsState.lastSaved.toLocaleString()}
            </Typography>
          )}
        </Box>

        {/* Error display */}
        {settingsState.error && (
          <Alert severity="error" sx={{ margin: 2 }}>
            {settingsState.error}
          </Alert>
        )}

        {/* Settings tabs */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="Settings navigation tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="API Settings" id="settings-tab-0" aria-controls="settings-tabpanel-0" />
          <Tab label="Branding" id="settings-tab-1" aria-controls="settings-tabpanel-1" />
          <Tab label="Security" id="settings-tab-2" aria-controls="settings-tabpanel-2" />
        </Tabs>

        {/* Loading state */}
        {settingsState.loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Tab panels */}
        {!settingsState.loading && (
          <>
            <TabPanel
              value={activeTab}
              index={0}
              ariaLabel="API settings panel"
              hasUnsavedChanges={settingsState.unsavedChanges}
              onSave={(data) => handleSettingsUpdate('api', data)}
            >
              <ApiSettings
                onSave={(data) => handleSettingsUpdate('api', data)}
                isLoading={settingsState.loading}
                onDirtyChange={handleDirtyChange}
              />
            </TabPanel>

            <TabPanel
              value={activeTab}
              index={1}
              ariaLabel="Branding settings panel"
              hasUnsavedChanges={settingsState.unsavedChanges}
              onSave={(data) => handleSettingsUpdate('branding', data)}
            >
              <BrandingSettings
                initialBranding={settingsState.data.branding}
                onSave={(data) => handleSettingsUpdate('branding', data)}
                isLoading={settingsState.loading}
                onDirtyChange={handleDirtyChange}
              />
            </TabPanel>

            <TabPanel
              value={activeTab}
              index={2}
              ariaLabel="Security settings panel"
              hasUnsavedChanges={settingsState.unsavedChanges}
              onSave={(data) => handleSettingsUpdate('security', data)}
            >
              <SecuritySettings
                isLoading={settingsState.loading}
                isValidating={false}
                onSave={() => handleSettingsUpdate('security', {})}
                onCancel={() => setSettingsState(prev => ({ ...prev, unsavedChanges: false }))}
                onError={(error) => setSettingsState(prev => ({
                  ...prev,
                  error: error.message
                }))}
              />
            </TabPanel>
          </>
        )}
      </Paper>
    </MainLayout>
  );
};

// Error boundary wrapper
const SettingsWithErrorBoundary = withErrorBoundary(Settings, {
  fallback: (
    <Alert severity="error">
      An error occurred while loading the settings page. Please try refreshing the page.
    </Alert>
  ),
  onError: (error) => {
    console.error('Settings page error:', error);
    // TODO: Implement error reporting service
  }
});

export default SettingsWithErrorBoundary;