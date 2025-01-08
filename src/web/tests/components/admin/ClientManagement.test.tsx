import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { setupServer, rest } from 'msw';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import ClientList from '../../../src/components/admin/ClientManagement/ClientList';
import ClientForm from '../../../src/components/admin/ClientManagement/ClientForm';
import ClientTable from '../../../src/components/admin/ClientManagement/ClientTable';
import { clientApi } from '../../../src/api/clients';
import { Client, ClientStatus } from '../../../src/types/client';

// Mock data setup
const mockClients: Client[] = [
  {
    id: '1',
    name: 'ACME Corporation',
    status: ClientStatus.ACTIVE,
    config: {
      maxUsers: 100,
      chatEnabled: true,
      exportEnabled: true,
      features: {},
      theme: {
        mode: 'light',
        fontFamily: 'Roboto',
        spacing: 8,
        borderRadius: 4,
        shadows: {}
      }
    },
    branding: {
      primaryColor: '#0066CC',
      logoUrl: 'https://example.com/logo.png',
      companyName: 'ACME Corp',
      customStyles: {},
      theme: null
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
    metadata: {}
  },
  // Add more mock clients as needed
];

// MSW server setup for API mocking
const server = setupServer(
  rest.get('/api/clients', (req, res, ctx) => {
    const page = Number(req.url.searchParams.get('page')) || 1;
    const pageSize = Number(req.url.searchParams.get('pageSize')) || 10;
    const searchQuery = req.url.searchParams.get('searchQuery') || '';

    const filteredClients = mockClients.filter(client =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase())
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
      ctx.json({ success: true, data: { ...req.body, id: '123' } })
    );
  }),

  rest.put('/api/clients/:id', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ success: true, data: req.body })
    );
  }),

  rest.delete('/api/clients/:id', (req, res, ctx) => {
    return res(
      ctx.status(204)
    );
  })
);

// Test setup and teardown
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Custom render function with providers
const renderWithProviders = (ui: React.ReactElement) => {
  const store = configureStore({
    reducer: {
      // Add reducers as needed
    }
  });

  return render(
    <Provider store={store}>
      {ui}
    </Provider>
  );
};

describe('ClientList Component', () => {
  test('renders client list with search and pagination', async () => {
    renderWithProviders(<ClientList />);

    // Check initial loading state
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    // Verify search field
    const searchField = screen.getByRole('searchbox');
    expect(searchField).toBeInTheDocument();

    // Verify client table
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('ACME Corporation')).toBeInTheDocument();

    // Verify pagination
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  test('handles search functionality with debounce', async () => {
    renderWithProviders(<ClientList />);

    const searchField = await screen.findByRole('searchbox');
    await userEvent.type(searchField, 'ACME');

    // Wait for debounced search
    await waitFor(() => {
      expect(screen.getByText('ACME Corporation')).toBeInTheDocument();
    }, { timeout: 500 });
  });

  test('meets accessibility standards', async () => {
    const { container } = renderWithProviders(<ClientList />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('ClientForm Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    onSuccess: mockOnSuccess,
    onCancel: mockOnCancel,
    isSubmitting: false,
    csrfToken: 'test-token'
  };

  test('renders form fields with validation', async () => {
    render(<ClientForm {...defaultProps} />);

    // Verify required fields
    expect(screen.getByLabelText(/client name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/industry/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/maximum users/i)).toBeInTheDocument();

    // Test validation
    const submitButton = screen.getByRole('button', { name: /create client/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getAllByRole('alert')).toHaveLength(3); // Required field errors
    });
  });

  test('handles form submission successfully', async () => {
    render(<ClientForm {...defaultProps} />);

    // Fill form
    await userEvent.type(screen.getByLabelText(/client name/i), 'Test Client');
    await userEvent.type(screen.getByLabelText(/industry/i), 'Technology');
    await userEvent.type(screen.getByLabelText(/maximum users/i), '50');

    // Submit form
    await userEvent.click(screen.getByRole('button', { name: /create client/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});

describe('ClientTable Component', () => {
  const mockOnPageChange = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnSettings = jest.fn();

  const defaultProps = {
    clients: mockClients,
    page: 1,
    pageSize: 10,
    total: mockClients.length,
    loading: false,
    error: null,
    onPageChange: mockOnPageChange,
    onEdit: mockOnEdit,
    onDelete: mockOnDelete,
    onSettings: mockOnSettings
  };

  test('renders client data correctly', () => {
    render(<ClientTable {...defaultProps} />);

    // Verify table headers
    expect(screen.getByText('Client Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();

    // Verify client data
    expect(screen.getByText('ACME Corporation')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  test('handles row actions correctly', async () => {
    render(<ClientTable {...defaultProps} />);

    // Test edit action
    const editButton = screen.getAllByRole('button', { name: /edit/i })[0];
    await userEvent.click(editButton);
    expect(mockOnEdit).toHaveBeenCalledWith(mockClients[0]);

    // Test settings action
    const settingsButton = screen.getAllByRole('button', { name: /settings/i })[0];
    await userEvent.click(settingsButton);
    expect(mockOnSettings).toHaveBeenCalledWith(mockClients[0]);

    // Test delete action
    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
    await userEvent.click(deleteButton);
    expect(mockOnDelete).toHaveBeenCalledWith(mockClients[0]);
  });

  test('handles loading and error states', () => {
    // Test loading state
    render(<ClientTable {...defaultProps} loading={true} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Test error state
    render(<ClientTable {...defaultProps} error={new Error('Test error')} />);
    expect(screen.getByText(/test error/i)).toBeInTheDocument();
  });

  test('supports keyboard navigation', async () => {
    render(<ClientTable {...defaultProps} />);

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    // Focus first row
    rows[1].focus();
    expect(document.activeElement).toBe(rows[1]);

    // Test arrow key navigation
    fireEvent.keyDown(rows[1], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[2]);

    fireEvent.keyDown(rows[2], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rows[1]);
  });
});