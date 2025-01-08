import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { setupServer } from 'msw';
import { rest } from 'msw';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import ClientList from '../../../src/components/admin/ClientManagement/ClientList';
import ClientForm from '../../../src/components/admin/ClientManagement/ClientForm';
import ClientTable from '../../../src/components/admin/ClientManagement/ClientTable';
import { Client, ClientStatus } from '../../../types/client';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock data setup
const mockClients: Client[] = [
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
  // GET clients
  rest.get('/api/clients', (req, res, ctx) => {
    const page = Number(req.url.searchParams.get('page')) || 1;
    const pageSize = Number(req.url.searchParams.get('pageSize')) || 10;
    const search = req.url.searchParams.get('search');

    let filteredClients = [...mockClients];
    if (search) {
      filteredClients = filteredClients.filter(client => 
        client.name.toLowerCase().includes(search.toLowerCase())
      );
    }

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

  // POST create client
  rest.post('/api/clients', async (req, res, ctx) => {
    const newClient = await req.json();
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: { ...newClient, id: '3' }
      })
    );
  }),

  // PUT update client
  rest.put('/api/clients/:id', async (req, res, ctx) => {
    const updatedClient = await req.json();
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        data: updatedClient
      })
    );
  }),

  // DELETE client
  rest.delete('/api/clients/:id', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true
      })
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
      // Add reducers if needed
    }
  });

  return render(
    <Provider store={store}>
      {ui}
    </Provider>
  );
};

describe('ClientList Component', () => {
  it('should render without accessibility violations', async () => {
    const { container } = renderWithProviders(<ClientList />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should display loading state initially', () => {
    renderWithProviders(<ClientList />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display clients after loading', async () => {
    renderWithProviders(<ClientList />);
    await waitFor(() => {
      expect(screen.getByText('ACME Corporation')).toBeInTheDocument();
    });
  });

  it('should handle search with debounce', async () => {
    renderWithProviders(<ClientList />);
    const searchInput = screen.getByRole('searchbox');
    await userEvent.type(searchInput, 'Tech');
    
    await waitFor(() => {
      expect(screen.getByText('TechCorp Industries')).toBeInTheDocument();
      expect(screen.queryByText('ACME Corporation')).not.toBeInTheDocument();
    }, { timeout: 500 });
  });

  it('should handle client deletion with confirmation', async () => {
    renderWithProviders(<ClientList />);
    await waitFor(() => {
      expect(screen.getByText('ACME Corporation')).toBeInTheDocument();
    });

    const deleteButton = screen.getByTestId('delete-client-1');
    window.confirm = jest.fn(() => true);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByText('ACME Corporation')).not.toBeInTheDocument();
    });
  });
});

describe('ClientForm Component', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  const defaultProps = {
    onSuccess: mockOnSuccess,
    onCancel: mockOnCancel,
    isSubmitting: false,
    csrfToken: 'mock-token'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without accessibility violations', async () => {
    const { container } = render(<ClientForm {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should validate required fields', async () => {
    render(<ClientForm {...defaultProps} />);
    const submitButton = screen.getByRole('button', { name: /create client/i });
    
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/industry is required/i)).toBeInTheDocument();
    });
  });

  it('should handle form submission successfully', async () => {
    render(<ClientForm {...defaultProps} />);
    
    await userEvent.type(screen.getByLabelText(/client name/i), 'New Client');
    await userEvent.type(screen.getByLabelText(/industry/i), 'Technology');
    await userEvent.type(screen.getByLabelText(/maximum users/i), '100');
    
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without accessibility violations', async () => {
    const { container } = render(<ClientTable {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations());
  });

  it('should render client data correctly', () => {
    render(<ClientTable {...defaultProps} />);
    expect(screen.getByText('ACME Corporation')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('should handle sorting', async () => {
    render(<ClientTable {...defaultProps} />);
    const nameHeader = screen.getByRole('columnheader', { name: /client name/i });
    
    fireEvent.click(nameHeader);
    await waitFor(() => {
      expect(mockOnPageChange).toHaveBeenCalledWith(expect.objectContaining({
        sortBy: 'name',
        sortOrder: 'asc'
      }));
    });
  });

  it('should handle row actions', async () => {
    render(<ClientTable {...defaultProps} />);
    
    const editButton = screen.getByTestId('edit-client-1');
    fireEvent.click(editButton);
    expect(mockOnEdit).toHaveBeenCalledWith(mockClients[0]);
    
    const deleteButton = screen.getByTestId('delete-client-1');
    fireEvent.click(deleteButton);
    expect(mockOnDelete).toHaveBeenCalledWith(mockClients[0]);
  });

  it('should display loading skeleton when loading', () => {
    render(<ClientTable {...defaultProps} loading={true} clients={[]} />);
    expect(screen.getAllByRole('progressbar')).toHaveLength(5);
  });

  it('should display error message when error occurs', () => {
    const error = new Error('Failed to load clients');
    render(<ClientTable {...defaultProps} error={error} />);
    expect(screen.getByText(/failed to load clients/i)).toBeInTheDocument();
  });
});