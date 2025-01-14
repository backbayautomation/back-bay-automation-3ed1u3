import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { setupServer } from 'msw';
import { rest } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import ClientList from '../../../src/components/admin/ClientManagement/ClientList';
import ClientForm from '../../../src/components/admin/ClientManagement/ClientForm';
import ClientTable from '../../../src/components/admin/ClientManagement/ClientTable';
import { ClientStatus } from '../../../src/types/client';

// Mock data setup
const mockClients = [
  {
    id: '1',
    name: 'ACME Corporation',
    status: ClientStatus.ACTIVE,
    metadata: {
      documentCount: 150,
      lastActive: '2024-01-20T10:00:00Z'
    }
  },
  {
    id: '2',
    name: 'TechCorp Industries',
    status: ClientStatus.PENDING,
    metadata: {
      documentCount: 75,
      lastActive: '2024-01-19T15:30:00Z'
    }
  }
];

// MSW server setup for API mocking
const server = setupServer(
  rest.get('/api/clients', (req, res, ctx) => {
    const page = Number(req.url.searchParams.get('page')) || 1;
    const pageSize = Number(req.url.searchParams.get('pageSize')) || 10;
    const search = req.url.searchParams.get('search') || '';

    const filteredClients = mockClients.filter(client => 
      client.name.toLowerCase().includes(search.toLowerCase())
    );

    return res(
      ctx.status(200),
      ctx.json({
        items: filteredClients.slice((page - 1) * pageSize, page * pageSize),
        total: filteredClients.length,
        page,
        pageSize
      })
    );
  }),

  rest.post('/api/clients', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: { ...req.body, id: '3' }
      })
    );
  }),

  rest.delete('/api/clients/:id', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true
      })
    );
  })
);

// Test setup utilities
const renderWithProviders = (ui: React.ReactElement) => {
  const store = configureStore({
    reducer: {
      auth: () => ({
        user: { role: 'SYSTEM_ADMIN' }
      })
    }
  });

  return render(
    <Provider store={store}>
      {ui}
    </Provider>
  );
};

// Start server before tests
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ClientList Component', () => {
  test('renders client list with search and pagination', async () => {
    renderWithProviders(<ClientList />);

    // Verify initial loading state
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('ACME Corporation')).toBeInTheDocument();
    });

    // Verify search functionality
    const searchInput = screen.getByRole('searchbox');
    await userEvent.type(searchInput, 'Tech');

    await waitFor(() => {
      expect(screen.getByText('TechCorp Industries')).toBeInTheDocument();
      expect(screen.queryByText('ACME Corporation')).not.toBeInTheDocument();
    });
  });

  test('handles client deletion with confirmation', async () => {
    renderWithProviders(<ClientList />);

    await waitFor(() => {
      expect(screen.getByText('ACME Corporation')).toBeInTheDocument();
    });

    // Click delete button and confirm
    const deleteButton = screen.getAllByRole('button', { name: /delete client/i })[0];
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByText('ACME Corporation')).not.toBeInTheDocument();
    });
  });

  test('meets accessibility standards', async () => {
    const { container } = renderWithProviders(<ClientList />);
    
    await waitFor(() => {
      expect(screen.getByText('ACME Corporation')).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('ClientForm Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('validates required fields', async () => {
    renderWithProviders(
      <ClientForm
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
        isSubmitting={false}
        csrfToken="test-token"
      />
    );

    // Submit empty form
    fireEvent.click(screen.getByRole('button', { name: /save client/i }));

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/industry is required/i)).toBeInTheDocument();
    });
  });

  test('handles successful form submission', async () => {
    renderWithProviders(
      <ClientForm
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
        isSubmitting={false}
        csrfToken="test-token"
      />
    );

    // Fill form fields
    await userEvent.type(screen.getByLabelText(/client name/i), 'New Client');
    await userEvent.type(screen.getByLabelText(/industry/i), 'Technology');
    await userEvent.type(screen.getByLabelText(/maximum users/i), '100');

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /save client/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  test('handles form cancellation', () => {
    renderWithProviders(
      <ClientForm
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
        isSubmitting={false}
        csrfToken="test-token"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalled();
  });
});

describe('ClientTable Component', () => {
  const mockOnPageChange = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnSettings = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders client data correctly', () => {
    render(
      <ClientTable
        clients={mockClients}
        page={1}
        pageSize={10}
        total={mockClients.length}
        loading={false}
        error={null}
        onPageChange={mockOnPageChange}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onSettings={mockOnSettings}
      />
    );

    expect(screen.getByText('ACME Corporation')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument(); // Document count
  });

  test('handles sorting', async () => {
    render(
      <ClientTable
        clients={mockClients}
        page={1}
        pageSize={10}
        total={mockClients.length}
        loading={false}
        error={null}
        onPageChange={mockOnPageChange}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onSettings={mockOnSettings}
      />
    );

    const nameHeader = screen.getByRole('columnheader', { name: /client name/i });
    fireEvent.click(nameHeader);

    expect(mockOnPageChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: 'name',
        sortOrder: 'asc'
      })
    );
  });

  test('displays loading state correctly', () => {
    render(
      <ClientTable
        clients={[]}
        page={1}
        pageSize={10}
        total={0}
        loading={true}
        error={null}
        onPageChange={mockOnPageChange}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onSettings={mockOnSettings}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('handles row actions correctly', async () => {
    render(
      <ClientTable
        clients={mockClients}
        page={1}
        pageSize={10}
        total={mockClients.length}
        loading={false}
        error={null}
        onPageChange={mockOnPageChange}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onSettings={mockOnSettings}
      />
    );

    // Test edit action
    const editButton = screen.getAllByRole('button', { name: /edit client/i })[0];
    fireEvent.click(editButton);
    expect(mockOnEdit).toHaveBeenCalledWith(mockClients[0]);

    // Test settings action
    const settingsButton = screen.getAllByRole('button', { name: /client settings/i })[0];
    fireEvent.click(settingsButton);
    expect(mockOnSettings).toHaveBeenCalledWith(mockClients[0]);

    // Test delete action
    const deleteButton = screen.getAllByRole('button', { name: /delete client/i })[0];
    fireEvent.click(deleteButton);
    expect(mockOnDelete).toHaveBeenCalledWith(mockClients[0]);
  });
});