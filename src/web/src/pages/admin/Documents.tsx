import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Container, Grid, Paper, Typography, Tabs, Tab, CircularProgress } from '@mui/material';
import { useSnackbar } from 'notistack';
import { ErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@segment/analytics-next';

import AdminLayout from '../../layouts/AdminLayout';
import DocumentList from '../../components/admin/DocumentProcessing/DocumentList';
import UploadForm from '../../components/admin/DocumentProcessing/UploadForm';
import ProcessingQueue from '../../components/admin/DocumentProcessing/ProcessingQueue';
import { Document } from '../../types/document';
import { useWebSocket } from '../../hooks/useWebSocket';

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
  role?: string;
  id?: string;
  'aria-labelledby'?: string;
}

interface DocumentsProps {
  className?: string;
  analyticsEnabled?: boolean;
}

const TabPanel = React.memo<TabPanelProps>(({
  children,
  value,
  index,
  ...props
}) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`documents-tabpanel-${index}`}
    aria-labelledby={`documents-tab-${index}`}
    {...props}
  >
    {value === index && (
      <Box sx={{ p: 3 }}>
        {children}
      </Box>
    )}
  </div>
));

const Documents = React.memo<DocumentsProps>(({
  className,
  analyticsEnabled = true
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  // WebSocket setup for real-time updates
  const { isConnected, addListener, removeListener } = useWebSocket({
    baseUrl: `${process.env.VITE_WS_URL}/documents`,
    autoConnect: true,
    monitoringEnabled: true
  });

  // Handle document upload success
  const handleUploadSuccess = useCallback((document: Document) => {
    enqueueSnackbar('Document uploaded successfully', { variant: 'success' });
    setRefreshTrigger(prev => !prev);

    if (analyticsEnabled) {
      Analytics.track('document_uploaded', {
        documentId: document.id,
        documentType: document.type,
        timestamp: new Date().toISOString()
      });
    }
  }, [enqueueSnackbar, analyticsEnabled]);

  // Handle document upload error
  const handleUploadError = useCallback((error: Error) => {
    enqueueSnackbar(error.message || 'Failed to upload document', { variant: 'error' });

    if (analyticsEnabled) {
      Analytics.track('document_upload_error', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }, [enqueueSnackbar, analyticsEnabled]);

  // Handle document processing completion
  const handleProcessingComplete = useCallback((document: Document) => {
    enqueueSnackbar(`Document "${document.filename}" processing completed`, { variant: 'success' });
    setRefreshTrigger(prev => !prev);

    if (analyticsEnabled) {
      Analytics.track('document_processing_completed', {
        documentId: document.id,
        processingTime: document.processed_at ? 
          new Date(document.processed_at).getTime() - new Date(document.createdAt).getTime() : 
          null
      });
    }
  }, [enqueueSnackbar, analyticsEnabled]);

  // Handle tab change
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);

    if (analyticsEnabled) {
      Analytics.track('document_tab_changed', {
        tabIndex: newValue,
        tabName: ['upload', 'documents', 'queue'][newValue]
      });
    }
  }, [analyticsEnabled]);

  // Tab accessibility props
  const a11yProps = useCallback((index: number) => ({
    id: `documents-tab-${index}`,
    'aria-controls': `documents-tabpanel-${index}`,
  }), []);

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
              <Tab label="Upload Document" {...a11yProps(0)} />
              <Tab label="Document List" {...a11yProps(1)} />
              <Tab label="Processing Queue" {...a11yProps(2)} />
            </Tabs>

            <ErrorBoundary
              FallbackComponent={({ error }) => (
                <Box p={3}>
                  <Typography color="error">
                    Error: {error.message}
                  </Typography>
                </Box>
              )}
              onError={(error) => {
                if (analyticsEnabled) {
                  Analytics.track('document_error', {
                    error: error.message,
                    timestamp: new Date().toISOString()
                  });
                }
              }}
            >
              <TabPanel value={activeTab} index={0}>
                <UploadForm
                  clientId={process.env.VITE_CLIENT_ID || ''}
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                  allowMultiple={true}
                  maxFileSize={10 * 1024 * 1024} // 10MB
                />
              </TabPanel>

              <TabPanel value={activeTab} index={1}>
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

              <TabPanel value={activeTab} index={2}>
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