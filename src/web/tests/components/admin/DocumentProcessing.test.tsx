import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockWebSocket, Server } from 'mock-socket';

import UploadForm from '../../../src/components/admin/DocumentProcessing/UploadForm';
import DocumentList from '../../../src/components/admin/DocumentProcessing/DocumentList';
import ProcessingQueue from '../../../src/components/admin/DocumentProcessing/ProcessingQueue';
import { Document, DocumentType, ProcessingStatus } from '../../../src/types/document';

// Mock WebSocket implementation
global.WebSocket = MockWebSocket;

// Mock document service
vi.mock('../../../src/services/documents', () => ({
  uploadDocument: vi.fn(),
  getDocumentList: vi.fn(),
  removeDocument: vi.fn(),
  processDocument: vi.fn(),
  cancelProcessing: vi.fn(),
  retryProcessing: vi.fn()
}));

// Test data setup
const mockDocuments: Document[] = [
  {
    id: '1',
    client_id: 'client1',
    filename: 'test.pdf',
    type: 'pdf' as DocumentType,
    status: 'pending' as ProcessingStatus,
    metadata: {
      page_count: 1,
      file_size_bytes: 1024,
      mime_type: 'application/pdf',
      languages: ['en'],
      encoding: 'utf-8',
      has_text_content: true,
      requires_ocr: false,
      additional_metadata: {}
    },
    processed_at: null,
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    updated_by: null,
    is_active: true
  }
];

describe('UploadForm Component', () => {
  const mockOnUploadSuccess = vi.fn();
  const mockOnUploadError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload form with all required elements', () => {
    render(
      <UploadForm
        clientId="client1"
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    expect(screen.getByText('Upload Document')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('validates file type restrictions', async () => {
    render(
      <UploadForm
        clientId="client1"
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
        allowedTypes={['pdf']}
      />
    );

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/file/i);

    await userEvent.upload(input, file);

    expect(screen.getByText(/file type must be/i)).toBeInTheDocument();
  });

  it('handles file upload with progress tracking', async () => {
    const mockUpload = vi.fn().mockResolvedValue({ data: mockDocuments[0] });
    vi.spyOn(require('../../../src/services/documents'), 'uploadDocument')
      .mockImplementation(mockUpload);

    render(
      <UploadForm
        clientId="client1"
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/file/i);

    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole('button', { name: /upload document/i }));

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith(mockDocuments[0]);
    });
  });
});

describe('DocumentList Component', () => {
  const mockGetDocuments = vi.fn();

  beforeEach(() => {
    mockGetDocuments.mockResolvedValue({
      items: mockDocuments,
      total_count: 1,
      page_size: 10,
      current_page: 1
    });
    vi.spyOn(require('../../../src/services/documents'), 'getDocumentList')
      .mockImplementation(mockGetDocuments);
  });

  it('renders document list with correct columns', async () => {
    render(<DocumentList clientId="client1" />);

    await waitFor(() => {
      expect(screen.getByText('Document Name')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  it('handles document deletion with confirmation', async () => {
    const mockRemove = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(require('../../../src/services/documents'), 'removeDocument')
      .mockImplementation(mockRemove);

    render(<DocumentList clientId="client1" />);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete test.pdf/i });
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    
    await userEvent.click(deleteButton);

    expect(mockRemove).toHaveBeenCalledWith('1');
  });

  it('supports pagination and sorting', async () => {
    render(<DocumentList clientId="client1" />);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    const sortButton = screen.getByRole('button', { name: /sort by document name/i });
    await userEvent.click(sortButton);

    expect(mockGetDocuments).toHaveBeenCalledWith(expect.objectContaining({
      sortBy: 'filename',
      order: 'asc'
    }));
  });
});

describe('ProcessingQueue Component', () => {
  let mockWebSocketServer: Server;

  beforeEach(() => {
    mockWebSocketServer = new Server('ws://localhost:1234');
  });

  afterEach(() => {
    mockWebSocketServer.close();
  });

  it('renders processing queue with real-time updates', async () => {
    render(
      <ProcessingQueue
        refreshInterval={1000}
        autoRefresh={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /document processing queue/i }))
        .toBeInTheDocument();
    });

    // Simulate WebSocket message
    mockWebSocketServer.emit('document.update', {
      documentId: '1',
      status: 'processing',
      progress: 50
    });

    await waitFor(() => {
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });
  });

  it('handles processing cancellation', async () => {
    const mockCancel = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(require('../../../src/services/documents'), 'cancelProcessing')
      .mockImplementation(mockCancel);

    render(<ProcessingQueue />);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel processing/i });
    await userEvent.click(cancelButton);

    expect(mockCancel).toHaveBeenCalledWith('1');
  });

  it('handles retry for failed documents', async () => {
    const mockRetry = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(require('../../../src/services/documents'), 'retryProcessing')
      .mockImplementation(mockRetry);

    const failedDocument = {
      ...mockDocuments[0],
      status: 'failed' as ProcessingStatus,
      error_message: 'Processing failed'
    };

    vi.spyOn(require('../../../src/services/documents'), 'getDocumentList')
      .mockResolvedValue({
        items: [failedDocument],
        total_count: 1,
        page_size: 10,
        current_page: 1
      });

    render(<ProcessingQueue />);

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /retry processing/i });
    await userEvent.click(retryButton);

    expect(mockRetry).toHaveBeenCalledWith('1');
  });

  it('displays connection status alerts', async () => {
    render(<ProcessingQueue />);

    // Simulate WebSocket disconnection
    mockWebSocketServer.close();

    await waitFor(() => {
      expect(screen.getByText(/real-time updates are currently unavailable/i))
        .toBeInTheDocument();
    });
  });
});