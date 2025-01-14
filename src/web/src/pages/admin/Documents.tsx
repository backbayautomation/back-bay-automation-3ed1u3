import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  CircularProgress
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { ErrorBoundary } from 'react-error-boundary';
import { useWebSocket } from '../../hooks/useWebSocket';
import Analytics from '@segment/analytics-next';

import AdminLayout from '../../layouts/AdminLayout';
import DocumentList from '../../components/admin/DocumentProcessing/DocumentList';
import UploadForm from '../../components/admin/DocumentProcessing/UploadForm';
import ProcessingQueue from '../../components/admin/DocumentProcessing/ProcessingQueue';

// Interface for tab panel props
interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
  role: string;
  id: string;
  'aria-labelledby': string;
}

// Interface for Documents component props
interface DocumentsProps {
  className?: string;
  analyticsEnabled?: boolean;
}

// Tab panel component with accessibility support
const TabPanel = React.memo<TabPanelProps>(({
  children,
  value,
  index,
  ...props
}) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    {...props}
    style={{ padding: '24px 0' }}
  >
    {value === index && children}
  </div>
));

TabPanel.displayName = 'TabPanel';

// Main Documents component
const Documents = React.memo<DocumentsProps>(({ className, analyticsEnabled = true }) => {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  // WebSocket connection for real-time updates
  const { isConnected, addListener, removeListener } = useWebSocket({
    baseUrl: `${process.env.VITE_WS_URL}/documents`,
    autoConnect: true,
    monitoringEnabled: true
  });

  // Analytics initialization
  const analytics = useMemo(() => {
    if (analyticsEnabled) {
      return new Analytics({
        writeKey: process.env.VITE_SEGMENT_WRITE_KEY || '',
        defaultSettings: {
          integrations: {
            'Segment.io': true
          }
        }
      });
    }
    return null;
  }, [analyticsEnabled]);

  // Handle document upload success
  const handleUploadSuccess = useCallback((document) => {
    enqueueSnackbar(`Document "${document.filename}" uploaded successfully`, {
      variant: 'success'
    });
    setRefreshTrigger(prev => !prev);
    
    if (analytics) {
      analytics.track('Document Uploaded', {
        documentId: document.id,
        documentType: document.type,
        timestamp: new Date().toISOString()
      });
    }
  }, [enqueueSnackbar, analytics]);

  // Handle document upload error
  const handleUploadError = useCallback((error: Error) => {
    enqueueSnackbar(`Upload failed: ${error.message}`, {
      variant: 'error'
    });

    if (analytics) {
      analytics.track('Document Upload Failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }, [enqueueSnackbar, analytics]);

  // Handle tab change
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    
    if (analytics) {
      analytics.track('Document Tab Changed', {
        tabIndex: newValue,
        timestamp: new Date().toISOString()
      });
    }
  }, [analytics]);

  // Handle processing completion
  const handleProcessingComplete = useCallback((document) => {
    enqueueSnackbar(`Document "${document.filename}" processing completed`, {
      variant: 'success'
    });
    setRefreshTrigger(prev => !prev);
  }, [enqueueSnackbar]);

  // Handle processing error
  const handleProcessingError = useCallback((error: Error) => {
    enqueueSnackbar(`Processing error: ${error.message}`, {
      variant: 'error'
    });
  }, [enqueueSnackbar]);

  return (
    <AdminLayout>
      <Container maxWidth={false}>
        <Box sx={{ py: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Document Management
          </Typography>

          <Paper sx={{ width: '100%', mb: 2 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="Document management tabs"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab 
                label="Upload" 
                id="doc-tab-0"
                aria-controls="doc-tabpanel-0"
              />
              <Tab 
                label="Documents" 
                id="doc-tab-1"
                aria-controls="doc-tabpanel-1"
              />
              <Tab 
                label="Processing Queue" 
                id="doc-tab-2"
                aria-controls="doc-tabpanel-2"
              />
            </Tabs>

            <ErrorBoundary
              fallback={
                <Box p={3}>
                  <Typography color="error">
                    An error occurred while loading the content.
                  </Typography>
                </Box>
              }
              onError={(error) => {
                if (analytics) {
                  analytics.track('Document Error', {
                    error: error.message,
                    timestamp: new Date().toISOString()
                  });
                }
              }}
            >
              <TabPanel 
                value={activeTab} 
                index={0}
                role="tabpanel"
                id="doc-tabpanel-0"
                aria-labelledby="doc-tab-0"
              >
                <UploadForm
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                  clientId={process.env.VITE_CLIENT_ID || ''}
                />
              </TabPanel>

              <TabPanel 
                value={activeTab} 
                index={1}
                role="tabpanel"
                id="doc-tabpanel-1"
                aria-labelledby="doc-tab-1"
              >
                <DocumentList
                  autoRefresh={true}
                  refreshInterval={30000}
                  onDocumentDeleted={() => setRefreshTrigger(prev => !prev)}
                  onError={handleProcessingError}
                />
              </TabPanel>

              <TabPanel 
                value={activeTab} 
                index={2}
                role="tabpanel"
                id="doc-tabpanel-2"
                aria-labelledby="doc-tab-2"
              >
                <ProcessingQueue
                  autoRefresh={true}
                  onProcessingComplete={handleProcessingComplete}
                  onError={handleProcessingError}
                />
              </TabPanel>
            </ErrorBoundary>
          </Paper>
        </Box>
      </Container>
    </AdminLayout>
  );
});

Documents.displayName = 'Documents';

export default Documents;