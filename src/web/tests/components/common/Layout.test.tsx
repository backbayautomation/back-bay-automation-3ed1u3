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

// Mock external dependencies
jest.mock('@mui/material/useMediaQuery');
jest.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: {
      id: 'test-user',
      fullName: 'Test User',
      role: 'admin',
      email: 'test@example.com'
    },
    logout: jest.fn()
  })
}));

// Test utilities
const renderWithTheme = (component: React.ReactElement) => {
  const mockTheme = {
    palette: {
      mode: 'light',
      primary: { main: '#0066CC' },
      background: { paper: '#FFFFFF', default: '#F8F9FA' }
    },
    spacing: (factor: number) => `${8 * factor}px`,
    breakpoints: {
      values: { xs: 0, sm: 576, md: 768, lg: 992, xl: 1200 }
    },
    zIndex: { appBar: 1100, drawer: 1200 }
  };

  return render(
    <ThemeProvider theme={mockTheme}>
      <ErrorBoundary fallback={<div>Error</div>}>
        {component}
      </ErrorBoundary>
    </ThemeProvider>
  );
};

// Mock navigation items
const mockNavigationItems = {
  admin: [
    { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: <div>Icon</div>, roles: ['admin'] },
    { id: 'clients', label: 'Clients', path: '/admin/clients', icon: <div>Icon</div>, roles: ['admin'] }
  ],
  client: [
    { id: 'search', label: 'Search', path: '/search', icon: <div>Icon</div>, roles: ['user'] },
    { id: 'history', label: 'History', path: '/history', icon: <div>Icon</div>, roles: ['user'] }
  ]
};

describe('MainLayout Component', () => {
  beforeEach(() => {
    (useMediaQuery as jest.Mock).mockReset();
  });

  test('renders admin portal layout correctly', async () => {
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    
    const { container } = renderWithTheme(
      <MainLayout portalType="admin">
        <div>Admin Content</div>
      </MainLayout>
    );

    // Check basic structure
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
    
    // Verify accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('renders client portal layout correctly', async () => {
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    
    const { container } = renderWithTheme(
      <MainLayout portalType="client">
        <div>Client Content</div>
      </MainLayout>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('Client Content')).toBeInTheDocument();
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('handles responsive sidebar behavior', async () => {
    // Mock mobile viewport
    (useMediaQuery as jest.Mock).mockReturnValue(true);
    
    renderWithTheme(
      <MainLayout portalType="admin">
        <div>Content</div>
      </MainLayout>
    );

    // Verify sidebar is closed by default on mobile
    const sidebar = screen.getByRole('complementary');
    expect(sidebar).not.toBeVisible();

    // Toggle sidebar
    const toggleButton = screen.getByLabelText(/toggle sidebar/i);
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(sidebar).toBeVisible();
    });
  });

  test('handles error boundary protection', () => {
    const ErrorComponent = () => {
      throw new Error('Test error');
      return null;
    };

    renderWithTheme(
      <MainLayout portalType="admin">
        <ErrorComponent />
      </MainLayout>
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});

describe('Header Component', () => {
  test('renders admin portal header correctly', async () => {
    const onToggleSidebar = jest.fn();
    
    const { container } = renderWithTheme(
      <Header 
        portalType="admin"
        onToggleSidebar={onToggleSidebar}
      />
    );

    expect(screen.getByText('Admin Portal')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('handles user menu interactions', async () => {
    const onToggleSidebar = jest.fn();
    
    renderWithTheme(
      <Header 
        portalType="admin"
        onToggleSidebar={onToggleSidebar}
      />
    );

    // Open user menu
    const userButton = screen.getByTestId('user-menu-button');
    fireEvent.click(userButton);

    // Verify menu items
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  test('adapts to mobile viewport', () => {
    (useMediaQuery as jest.Mock).mockReturnValue(true);
    
    const onToggleSidebar = jest.fn();
    
    renderWithTheme(
      <Header 
        portalType="admin"
        onToggleSidebar={onToggleSidebar}
      />
    );

    // Verify mobile adaptations
    expect(screen.queryByText('Test User')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-menu-button')).toBeInTheDocument();
  });
});

describe('Sidebar Component', () => {
  test('renders navigation items based on role', () => {
    const onClose = jest.fn();
    const onNavigate = jest.fn();

    renderWithTheme(
      <Sidebar
        isOpen={true}
        onClose={onClose}
        items={mockNavigationItems.admin}
        allowedRoles={['admin']}
        onNavigate={onNavigate}
      />
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
  });

  test('handles keyboard navigation', () => {
    const onClose = jest.fn();
    const onNavigate = jest.fn();

    renderWithTheme(
      <Sidebar
        isOpen={true}
        onClose={onClose}
        items={mockNavigationItems.admin}
        allowedRoles={['admin']}
        onNavigate={onNavigate}
      />
    );

    const dashboardItem = screen.getByText('Dashboard').closest('div');
    fireEvent.keyDown(dashboardItem!, { key: 'Enter' });
    
    expect(onNavigate).toHaveBeenCalledWith('/admin/dashboard');
  });

  test('supports nested navigation items', async () => {
    const nestedItems = [
      {
        ...mockNavigationItems.admin[0],
        children: [
          { id: 'sub1', label: 'Sub Item 1', path: '/sub1', icon: <div>Icon</div> }
        ]
      }
    ];

    renderWithTheme(
      <Sidebar
        isOpen={true}
        onClose={jest.fn()}
        items={nestedItems}
        allowedRoles={['admin']}
      />
    );

    // Expand submenu
    const expandButton = screen.getByLabelText(/expand submenu/i);
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Sub Item 1')).toBeInTheDocument();
    });
  });

  test('verifies accessibility compliance', async () => {
    const { container } = renderWithTheme(
      <Sidebar
        isOpen={true}
        onClose={jest.fn()}
        items={mockNavigationItems.admin}
        allowedRoles={['admin']}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});