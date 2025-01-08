import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockWebSocket } from 'mock-socket';

import UploadForm from '../../../src/components/admin/DocumentProcessing/UploadForm';
import DocumentList from '../../../src/components/admin/DocumentProcessing/DocumentList';
import ProcessingQueue from '../../../src/components/admin/DocumentProcessing/ProcessingQueue';
import { Document, DocumentType, ProcessingStatus } from '../../../src/types/document';

// Mock WebSocket
vi.mock('mock-socket');

// Mock document service
const documentService = {
  uploadDocument: vi.fn(),
  getDocumentList: vi.fn(),
  removeDocument: vi.fn(),
  startDocumentProcessing: vi.fn(),
  cancelProcessing: vi.fn(),
  retryProcessing: vi.fn()
};

// Mock test data
const mockDocuments: Document[] = [
  {
    id: '1',
    filename: 'test.pdf',
    type: 'pdf' as DocumentType,
    status: 'completed' as ProcessingStatus,
    client_id: 'client1',
    metadata: {
      page_count: 5,
      file_size_bytes: 1024,
      mime_type: 'application/pdf',
      languages: ['en'],
      encoding: 'utf-8',
      has_text_content: true,
      requires_ocr: false,
      additional_metadata: {}
    },
    processed_at: new Date().toISOString(),
    error_message: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user1',
    updatedBy: 'user1',
    isActive: true
  },
  {
    id: '2',
    filename: 'test.docx',
    type: 'docx' as DocumentType,
    status: 'processing' as ProcessingStatus,
    client_id: 'client1',
    metadata: {
      page_count: 3,
      file_size_bytes: 512,
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      languages: ['en'],
      encoding: 'utf-8',
      has_text_content: true,
      requires_ocr: false,
      additional_metadata: {}
    },
    processed_at: null,
    error_message: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'user1',
    updatedBy: 'user1',
    isActive: true
  }
];

describe('UploadForm', () => {
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
    expect(screen.getByRole('button', { name: /drop zone/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('handles file selection via drag and drop', async () => {
    render(
      <UploadForm
        clientId="client1"
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const dropZone = screen.getByRole('button', { name: /drop zone/i });

    fireEvent.dragEnter(dropZone);
    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file]
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/test\.pdf/)).toBeInTheDocument();
    });
  });

  it('validates file size and type restrictions', async () => {
    render(
      <UploadForm
        clientId="client1"
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
        maxFileSize={1024}
        allowedTypes={['pdf']}
      />
    );

    const largeFile = new File(['x'.repeat(2048)], 'large.pdf', { type: 'application/pdf' });
    const invalidFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    const dropZone = screen.getByRole('button', { name: /drop zone/i });

    // Test large file
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [largeFile]
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/file size exceeds maximum limit/i)).toBeInTheDocument();
    });

    // Test invalid file type
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [invalidFile]
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/file type not supported/i)).toBeInTheDocument();
    });
  });
});

describe('DocumentList', () => {
  beforeEach(() => {
    documentService.getDocumentList.mockResolvedValue({
      items: mockDocuments,
      total_count: mockDocuments.length,
      page_size: 10,
      current_page: 1
    });
  });

  it('renders document list with correct columns and data', async () => {
    render(
      <DocumentList
        clientId="client1"
        autoRefresh={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
      expect(screen.getByText('test.docx')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('row')).toHaveLength(mockDocuments.length + 1); // +1 for header
  });

  it('handles document deletion with confirmation', async () => {
    documentService.removeDocument.mockResolvedValue(true);

    render(
      <DocumentList
        clientId="client1"
        autoRefresh={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
    
    // Mock confirmation
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(documentService.removeDocument).toHaveBeenCalledWith('1');
    });
  });

  it('handles pagination and sorting', async () => {
    render(
      <DocumentList
        clientId="client1"
        autoRefresh={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    // Test sorting
    const filenameHeader = screen.getByRole('columnheader', { name: /document name/i });
    fireEvent.click(filenameHeader);

    await waitFor(() => {
      expect(documentService.getDocumentList).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'filename',
          order: 'asc'
        })
      );
    });
  });
});

describe('ProcessingQueue', () => {
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    mockWebSocket = new MockWebSocket('ws://localhost:8080');
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockWebSocket.close();
  });

  it('renders processing queue with real-time updates', async () => {
    const mockOnProcessingComplete = vi.fn();

    render(
      <ProcessingQueue
        autoRefresh={false}
        onProcessingComplete={mockOnProcessingComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Processing Queue')).toBeInTheDocument();
    });

    // Simulate WebSocket message
    mockWebSocket.send(JSON.stringify({
      event: 'document.processing',
      data: {
        documentId: '2',
        status: 'completed',
        progress: 100
      }
    }));

    await waitFor(() => {
      expect(mockOnProcessingComplete).toHaveBeenCalled();
    });
  });

  it('handles retry and cancel actions', async () => {
    documentService.startDocumentProcessing.mockResolvedValue(true);
    documentService.cancelProcessing.mockResolvedValue(true);

    render(
      <ProcessingQueue
        autoRefresh={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test.docx')).toBeInTheDocument();
    });

    // Test cancel action
    const cancelButton = screen.getByRole('button', { name: /cancel processing/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(documentService.cancelProcessing).toHaveBeenCalledWith('2');
    });

    // Simulate failed document
    mockWebSocket.send(JSON.stringify({
      event: 'document.processing',
      data: {
        documentId: '2',
        status: 'failed',
        error: 'Processing failed'
      }
    }));

    // Test retry action
    const retryButton = await screen.findByRole('button', { name: /retry processing/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(documentService.startDocumentProcessing).toHaveBeenCalledWith('2');
    });
  });

  it('displays progress indicators correctly', async () => {
    render(
      <ProcessingQueue
        autoRefresh={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test.docx')).toBeInTheDocument();
    });

    // Verify progress bar exists for processing document
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Simulate progress update
    mockWebSocket.send(JSON.stringify({
      event: 'document.processing',
      data: {
        documentId: '2',
        status: 'processing',
        progress: 50
      }
    }));

    await waitFor(() => {
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });
  });
});