import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockWebSocket, Server } from 'mock-socket';

import UploadForm from '../../../src/components/admin/DocumentProcessing/UploadForm';
import DocumentList from '../../../src/components/admin/DocumentProcessing/DocumentList';
import ProcessingQueue from '../../../src/components/admin/DocumentProcessing/ProcessingQueue';
import { Document, DocumentType, ProcessingStatus } from '../../../src/types/document';

// Mock WebSocket setup
const WS_URL = 'ws://localhost:1234';
let mockServer: Server;

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
    client_id: 'client1',
    filename: 'test1.pdf',
    type: 'pdf' as DocumentType,
    status: 'completed' as ProcessingStatus,
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
    error_message: null
  },
  {
    id: '2',
    client_id: 'client1',
    filename: 'test2.docx',
    type: 'docx' as DocumentType,
    status: 'processing' as ProcessingStatus,
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
    error_message: null
  }
];

describe('UploadForm', () => {
  const mockOnUploadSuccess = vi.fn();
  const mockOnUploadError = vi.fn();

  beforeEach(() => {
    documentService.uploadDocument.mockReset();
  });

  it('renders upload form with all required elements', () => {
    render(
      <UploadForm
        clientId="client1"
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    expect(screen.getByLabelText(/Document upload form/i)).toBeInTheDocument();
    expect(screen.getByText(/Select File/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload Document/i)).toBeInTheDocument();
  });

  it('validates file type restrictions', async () => {
    render(
      <UploadForm
        clientId="client1"
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    const file = new File(['test'], 'test.invalid', { type: 'text/plain' });
    const input = screen.getByLabelText(/file input/i);

    await userEvent.upload(input, file);

    expect(await screen.findByText(/Unsupported file type/i)).toBeInTheDocument();
  });

  it('handles successful file upload with progress', async () => {
    documentService.uploadDocument.mockResolvedValue({
      data: mockDocuments[0]
    });

    render(
      <UploadForm
        clientId="client1"
        onUploadSuccess={mockOnUploadSuccess}
        onUploadError={mockOnUploadError}
      />
    );

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/file input/i);

    await userEvent.upload(input, file);
    await userEvent.type(screen.getByLabelText(/Description/i), 'Test document');
    await userEvent.click(screen.getByText(/Upload Document/i));

    expect(screen.getByText(/Uploading/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith(mockDocuments[0]);
    });
  });
});

describe('DocumentList', () => {
  beforeEach(() => {
    documentService.getDocumentList.mockReset();
    documentService.removeDocument.mockReset();
  });

  it('renders document list with data', async () => {
    documentService.getDocumentList.mockResolvedValue({
      items: mockDocuments,
      total_count: 2,
      page_size: 10,
      current_page: 1
    });

    render(
      <DocumentList
        clientId="client1"
        autoRefresh={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test1.pdf')).toBeInTheDocument();
      expect(screen.getByText('test2.docx')).toBeInTheDocument();
    });
  });

  it('handles document deletion with confirmation', async () => {
    documentService.getDocumentList.mockResolvedValue({
      items: mockDocuments,
      total_count: 2,
      page_size: 10,
      current_page: 1
    });

    documentService.removeDocument.mockResolvedValue({});

    const { container } = render(
      <DocumentList
        clientId="client1"
        autoRefresh={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test1.pdf')).toBeInTheDocument();
    });

    // Mock window.confirm
    const mockConfirm = vi.spyOn(window, 'confirm');
    mockConfirm.mockImplementation(() => true);

    const deleteButton = container.querySelector('[aria-label="Delete document"]');
    await userEvent.click(deleteButton!);

    expect(mockConfirm).toHaveBeenCalled();
    expect(documentService.removeDocument).toHaveBeenCalledWith('1');
  });
});

describe('ProcessingQueue', () => {
  beforeEach(() => {
    mockServer = new Server(WS_URL);
  });

  afterEach(() => {
    mockServer.close();
  });

  it('renders processing queue with real-time updates', async () => {
    documentService.getDocumentList.mockResolvedValue({
      items: [mockDocuments[1]], // Only processing document
      total_count: 1,
      page_size: 10,
      current_page: 1
    });

    render(
      <ProcessingQueue
        autoRefresh={false}
        onProcessingComplete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test2.docx')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });

    // Simulate WebSocket update
    mockServer.emit('document.processing', {
      documentId: '2',
      status: 'completed',
      progress: 100
    });

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  it('handles processing cancellation', async () => {
    documentService.getDocumentList.mockResolvedValue({
      items: [mockDocuments[1]],
      total_count: 1,
      page_size: 10,
      current_page: 1
    });

    documentService.cancelProcessing.mockResolvedValue({});

    render(
      <ProcessingQueue
        autoRefresh={false}
        onProcessingComplete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test2.docx')).toBeInTheDocument();
    });

    const cancelButton = screen.getByLabelText('Cancel Processing');
    await userEvent.click(cancelButton);

    expect(documentService.cancelProcessing).toHaveBeenCalledWith('2');
  });

  it('displays error state and retry option', async () => {
    const failedDocument = {
      ...mockDocuments[1],
      status: 'failed' as ProcessingStatus,
      error_message: 'Processing failed'
    };

    documentService.getDocumentList.mockResolvedValue({
      items: [failedDocument],
      total_count: 1,
      page_size: 10,
      current_page: 1
    });

    render(
      <ProcessingQueue
        autoRefresh={false}
        onProcessingComplete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByLabelText('Retry Processing')).toBeInTheDocument();
    });

    const retryButton = screen.getByLabelText('Retry Processing');
    await userEvent.click(retryButton);

    expect(documentService.retryProcessing).toHaveBeenCalledWith('2');
  });
});