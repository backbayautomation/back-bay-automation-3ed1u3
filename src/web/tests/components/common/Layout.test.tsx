import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ErrorBoundary } from 'react-error-boundary';
import MainLayout from '../../../src/components/common/Layout/MainLayout';
import Header from '../../../src/components/common/Layout/Header';
import Sidebar from '../../../src/components/common/Layout/Sidebar';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock hooks and providers
jest.mock('@mui/material/styles', () => ({
  ...jest.requireActual('@mui/material/styles'),
  useTheme: jest.fn(),
}));

jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useMediaQuery: jest.fn(),
}));

jest.mock('../../../src/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: true,
    user: {
      id: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
    },
    logout: jest.fn(),
  })),
}));

// Test data
const navigationItems = {
  admin: [
    { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: 'DashboardIcon', roles: ['admin'] },
    { id: 'clients', label: 'Clients', path: '/admin/clients', icon: 'GroupIcon', roles: ['admin'] },
    { id: 'documents', label: 'Documents', path: '/admin/documents', icon: 'DocumentIcon', roles: ['admin'] }
  ],
  client: [
    { id: 'search', label: 'Search', path: '/search', icon: 'SearchIcon', roles: ['user'] },
    { id: 'history', label: 'History', path: '/history', icon: 'HistoryIcon', roles: ['user'] },
    { id: 'settings', label: 'Settings', path: '/settings', icon: 'SettingsIcon', roles: ['user'] }
  ]
};

// Utility function for rendering with theme
const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={{ palette: { mode: 'light' } }}>
      <ErrorBoundary fallback={<div>Error</div>}>
        {component}
      </ErrorBoundary>
    </ThemeProvider>
  );
};

describe('MainLayout Component', () => {
  beforeEach(() => {
    (useMediaQuery as jest.Mock).mockImplementation(() => false);
    (useTheme as jest.Mock).mockImplementation(() => ({
      palette: { mode: 'light' },
      breakpoints: { down: () => false },
      spacing: (value: number) => value * 8,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders admin portal layout correctly', () => {
    renderWithTheme(
      <MainLayout portalType="admin">
        <div>Admin Content</div>
      </MainLayout>
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('renders client portal layout correctly', () => {
    renderWithTheme(
      <MainLayout portalType="client">
        <div>Client Content</div>
      </MainLayout>
    );

    expect(screen.getByText('Client Content')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('handles responsive sidebar behavior', async () => {
    (useMediaQuery as jest.Mock).mockImplementation(() => true);

    renderWithTheme(
      <MainLayout portalType="admin">
        <div>Content</div>
      </MainLayout>
    );

    const toggleButton = screen.getByLabelText('Toggle sidebar navigation');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByRole('navigation')).toHaveStyle({ transform: 'translateX(0)' });
    });
  });

  it('meets accessibility standards', async () => {
    const { container } = renderWithTheme(
      <MainLayout portalType="admin">
        <div>Content</div>
      </MainLayout>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('Header Component', () => {
  const mockToggleSidebar = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders admin portal header correctly', () => {
    renderWithTheme(
      <Header onToggleSidebar={mockToggleSidebar} portalType="admin" />
    );

    expect(screen.getByText('Admin Portal')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle sidebar navigation')).toBeInTheDocument();
  });

  it('renders user menu and handles interactions', async () => {
    renderWithTheme(
      <Header onToggleSidebar={mockToggleSidebar} portalType="admin" />
    );

    const userMenuButton = screen.getByLabelText('Open user menu');
    fireEvent.click(userMenuButton);

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
  });

  it('handles mobile responsive design', () => {
    (useMediaQuery as jest.Mock).mockImplementation(() => true);

    renderWithTheme(
      <Header onToggleSidebar={mockToggleSidebar} portalType="admin" />
    );

    expect(screen.getByLabelText('Toggle sidebar navigation')).toHaveStyle({
      padding: '8px',
    });
  });

  it('meets accessibility standards', async () => {
    const { container } = renderWithTheme(
      <Header onToggleSidebar={mockToggleSidebar} portalType="admin" />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('Sidebar Component', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders navigation items based on portal type and role', () => {
    renderWithTheme(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        items={navigationItems.admin}
        variant="persistent"
      />
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    renderWithTheme(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        items={navigationItems.admin}
        variant="persistent"
      />
    );

    const dashboardItem = screen.getByText('Dashboard').closest('div');
    fireEvent.keyDown(dashboardItem!, { key: 'Enter' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('supports nested navigation items', async () => {
    const nestedItems = [
      {
        ...navigationItems.admin[0],
        children: [
          { id: 'sub1', label: 'Sub Item 1', path: '/sub1', icon: 'Icon', roles: ['admin'] }
        ]
      }
    ];

    renderWithTheme(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        items={nestedItems}
        variant="persistent"
      />
    );

    const expandButton = screen.getByLabelText('Expand Submenu');
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Sub Item 1')).toBeInTheDocument();
    });
  });

  it('meets accessibility standards', async () => {
    const { container } = renderWithTheme(
      <Sidebar
        isOpen={true}
        onClose={mockOnClose}
        items={navigationItems.admin}
        variant="persistent"
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});