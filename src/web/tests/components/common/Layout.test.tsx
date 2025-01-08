import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ErrorBoundary } from 'react-error-boundary';
import MainLayout from '../../../src/components/common/Layout/MainLayout';
import Header from '../../../src/components/common/Layout/Header';
import Sidebar from '../../../src/components/common/Layout/Sidebar';
import { AuthProvider } from '../../../src/contexts/AuthContext';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock hooks and components
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
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: '/admin/dashboard',
      icon: 'DashboardIcon',
      roles: ['admin'],
    },
    {
      id: 'clients',
      label: 'Clients',
      path: '/admin/clients',
      icon: 'GroupIcon',
      roles: ['admin'],
    },
  ],
  client: [
    {
      id: 'search',
      label: 'Search',
      path: '/search',
      icon: 'SearchIcon',
      roles: ['user'],
    },
    {
      id: 'history',
      label: 'History',
      path: '/history',
      icon: 'HistoryIcon',
      roles: ['user'],
    },
  ],
};

// Utility function to render components with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ErrorBoundary fallback={<div>Error</div>}>
      <AuthProvider>
        <ThemeProvider theme={{}}>
          {component}
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

describe('MainLayout Component', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    // Default theme mock
    (useTheme as jest.Mock).mockReturnValue({
      palette: { mode: 'light' },
      breakpoints: { down: () => {} },
    });
  });

  describe('Portal Type Rendering', () => {
    it('should render admin portal with correct structure', () => {
      renderWithProviders(
        <MainLayout portalType="admin">
          <div>Admin Content</div>
        </MainLayout>
      );

      expect(screen.getByText('Admin Portal')).toBeInTheDocument();
      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });

    it('should render client portal with correct structure', () => {
      renderWithProviders(
        <MainLayout portalType="client">
          <div>Client Content</div>
        </MainLayout>
      );

      expect(screen.getByText('Product Search')).toBeInTheDocument();
      expect(screen.getByText('Client Content')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should collapse sidebar on mobile viewport', () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true); // Mobile viewport

      renderWithProviders(
        <MainLayout portalType="admin">
          <div>Content</div>
        </MainLayout>
      );

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveStyle({ transform: 'translateX(-240px)' });
    });

    it('should show sidebar on desktop viewport', () => {
      (useMediaQuery as jest.Mock).mockReturnValue(false); // Desktop viewport

      renderWithProviders(
        <MainLayout portalType="admin">
          <div>Content</div>
        </MainLayout>
      );

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveStyle({ transform: 'none' });
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProviders(
        <MainLayout portalType="admin">
          <div>Content</div>
        </MainLayout>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', () => {
      renderWithProviders(
        <MainLayout portalType="admin">
          <div>Content</div>
        </MainLayout>
      );

      const sidebar = screen.getByRole('complementary');
      const navItems = within(sidebar).getAllByRole('button');

      navItems[0].focus();
      expect(document.activeElement).toBe(navItems[0]);

      fireEvent.keyDown(navItems[0], { key: 'Tab' });
      expect(document.activeElement).toBe(navItems[1]);
    });
  });
});

describe('Header Component', () => {
  const mockToggleSidebar = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Interactions', () => {
    it('should handle user menu interactions', async () => {
      renderWithProviders(
        <Header onToggleSidebar={mockToggleSidebar} portalType="admin" />
      );

      const userMenuButton = screen.getByTestId('user-menu-button');
      fireEvent.click(userMenuButton);

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
    });

    it('should handle sidebar toggle', () => {
      renderWithProviders(
        <Header onToggleSidebar={mockToggleSidebar} portalType="admin" />
      );

      const toggleButton = screen.getByTestId('sidebar-toggle');
      fireEvent.click(toggleButton);

      expect(mockToggleSidebar).toHaveBeenCalledTimes(1);
    });
  });

  describe('Portal-Specific Features', () => {
    it('should show settings option only in admin portal', () => {
      renderWithProviders(
        <Header onToggleSidebar={mockToggleSidebar} portalType="admin" />
      );

      const userMenuButton = screen.getByTestId('user-menu-button');
      fireEvent.click(userMenuButton);

      expect(screen.getByTestId('settings-menu-item')).toBeInTheDocument();
    });

    it('should not show settings option in client portal', () => {
      renderWithProviders(
        <Header onToggleSidebar={mockToggleSidebar} portalType="client" />
      );

      const userMenuButton = screen.getByTestId('user-menu-button');
      fireEvent.click(userMenuButton);

      expect(screen.queryByTestId('settings-menu-item')).not.toBeInTheDocument();
    });
  });
});

describe('Sidebar Component', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Navigation Items', () => {
    it('should render admin navigation items correctly', () => {
      renderWithProviders(
        <Sidebar
          isOpen={true}
          onClose={mockOnClose}
          items={navigationItems.admin}
          allowedRoles={['admin']}
        />
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Clients')).toBeInTheDocument();
    });

    it('should render client navigation items correctly', () => {
      renderWithProviders(
        <Sidebar
          isOpen={true}
          onClose={mockOnClose}
          items={navigationItems.client}
          allowedRoles={['user']}
        />
      );

      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should handle touch interactions on mobile', () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true); // Mobile viewport

      renderWithProviders(
        <Sidebar
          isOpen={true}
          onClose={mockOnClose}
          items={navigationItems.admin}
          variant="temporary"
        />
      );

      const closeButton = screen.getByLabelText('Toggle Navigation');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation in nested menus', () => {
      const nestedItems = [
        {
          ...navigationItems.admin[0],
          children: [
            { id: 'sub1', label: 'Sub Item 1', path: '/sub1', roles: ['admin'] },
          ],
        },
      ];

      renderWithProviders(
        <Sidebar
          isOpen={true}
          onClose={mockOnClose}
          items={nestedItems}
          allowedRoles={['admin']}
        />
      );

      const parentItem = screen.getByText('Dashboard');
      fireEvent.keyDown(parentItem, { key: 'Enter' });

      expect(screen.getByText('Sub Item 1')).toBeInTheDocument();
    });
  });
});