import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Container, Grid, Paper, Typography, Tabs, Tab, CircularProgress } from '@mui/material';
import { useSnackbar } from 'notistack';
import { ErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@segment/analytics-next';

import AdminLayout from '../../layouts/AdminLayout';
import DocumentList from '../../components/admin/DocumentProcessing/DocumentList';
import UploadForm from '../../components/admin/DocumentProcessing/UploadForm';
import ProcessingQueue from '../../components/admin/DocumentProcessing/ProcessingQueue';
import { useWebSocket } from '../../hooks/useWebSocket';

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
    style={{ width: '100%' }}
  >
    {value === index && (
      <Box sx={{ p: 3 }}>
        {children}
      </Box>
    )}
  </div>
));

TabPanel.displayName = 'TabPanel';

// Main Documents component
const Documents = React.memo<DocumentsProps>(({
  className,
  analyticsEnabled = true
}) => {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  // WebSocket connection for real-time updates
  const { addListener, removeListener } = useWebSocket({
    baseUrl: `${process.env.VITE_WS_URL}/documents`,
    autoConnect: true,
    monitoringEnabled: true
  });

  // Track component mount for analytics
  useEffect(() => {
    if (analyticsEnabled) {
      Analytics.track('admin_documents_view', {
        timestamp: new Date().toISOString()
      });
    }
  }, [analyticsEnabled]);

  // Handle document upload success
  const handleUploadSuccess = useCallback((document) => {
    enqueueSnackbar(`Document "${document.filename}" uploaded successfully`, {
      variant: 'success'
    });
    setRefreshTrigger(prev => !prev);

    if (analyticsEnabled) {
      Analytics.track('document_upload_success', {
        documentId: document.id,
        filename: document.filename,
        type: document.type
      });
    }
  }, [enqueueSnackbar, analyticsEnabled]);

  // Handle document upload error
  const handleUploadError = useCallback((error) => {
    enqueueSnackbar(`Upload failed: ${error.message}`, {
      variant: 'error'
    });

    if (analyticsEnabled) {
      Analytics.track('document_upload_error', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }, [enqueueSnackbar, analyticsEnabled]);

  // Handle document processing completion
  const handleProcessingComplete = useCallback((document) => {
    enqueueSnackbar(`Document "${document.filename}" processing completed`, {
      variant: 'success'
    });
    setRefreshTrigger(prev => !prev);

    if (analyticsEnabled) {
      Analytics.track('document_processing_complete', {
        documentId: document.id,
        filename: document.filename,
        processingTime: document.processed_at
      });
    }
  }, [enqueueSnackbar, analyticsEnabled]);

  // Handle tab change
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);

    if (analyticsEnabled) {
      Analytics.track('documents_tab_change', {
        tabIndex: newValue,
        tabName: ['upload', 'documents', 'queue'][newValue]
      });
    }
  }, [analyticsEnabled]);

  // Clean up WebSocket listeners
  useEffect(() => {
    return () => {
      removeListener('document.processing', handleProcessingComplete);
    };
  }, [removeListener, handleProcessingComplete]);

  return (
    <AdminLayout>
      <Container maxWidth={false} className={className}>
        <Box sx={{ width: '100%', mb: 4 }}>
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
                id="documents-tab-0"
                aria-controls="documents-tabpanel-0"
              />
              <Tab 
                label="Documents" 
                id="documents-tab-1"
                aria-controls="documents-tabpanel-1"
              />
              <Tab 
                label="Processing Queue" 
                id="documents-tab-2"
                aria-controls="documents-tabpanel-2"
              />
            </Tabs>

            <ErrorBoundary
              fallback={
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="error">
                    An error occurred while loading the content.
                  </Typography>
                </Box>
              }
              onError={(error) => {
                if (analyticsEnabled) {
                  Analytics.track('documents_error', {
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
                id="documents-tabpanel-0"
                aria-labelledby="documents-tab-0"
              >
                <UploadForm
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                  allowMultiple={false}
                  maxFileSize={10 * 1024 * 1024} // 10MB
                  allowedTypes={['pdf', 'docx', 'xlsx', 'txt']}
                />
              </TabPanel>

              <TabPanel 
                value={activeTab} 
                index={1}
                role="tabpanel"
                id="documents-tabpanel-1"
                aria-labelledby="documents-tab-1"
              >
                <DocumentList
                  autoRefresh={true}
                  refreshInterval={30000}
                  onDocumentDeleted={() => setRefreshTrigger(prev => !prev)}
                  onError={handleUploadError}
                  paginationConfig={{
                    initialPage: 1,
                    pageSize: 10
                  }}
                />
              </TabPanel>

              <TabPanel 
                value={activeTab} 
                index={2}
                role="tabpanel"
                id="documents-tabpanel-2"
                aria-labelledby="documents-tab-2"
              >
                <ProcessingQueue
                  autoRefresh={true}
                  refreshInterval={30000}
                  onProcessingComplete={handleProcessingComplete}
                  onError={handleUploadError}
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