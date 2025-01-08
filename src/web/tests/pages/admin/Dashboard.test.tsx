import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';
import { MockWebSocket } from 'mock-socket';
import { ErrorBoundary } from 'react-error-boundary';

import Dashboard from '../../../../src/pages/admin/Dashboard';
import AnalyticsDashboard from '../../../../src/components/admin/AnalyticsDashboard/AnalyticsDashboard';
import ProcessingQueue from '../../../../src/components/admin/DocumentProcessing/ProcessingQueue';

// Mock services and hooks
vi.mock('../../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: {
      id: 'test-user',
      clientId: 'test-client',
      role: 'ADMIN'
    }
  })
}));

vi.mock('../../../../src/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    isConnected: true,
    addListener: vi.fn(),
    removeListener: vi.fn()
  })
}));

// Mock Application Insights
vi.mock('@microsoft/applicationinsights-web', () => ({
  ApplicationInsights: vi.fn().mockImplementation(() => ({
    loadAppInsights: vi.fn(),
    trackPageView: vi.fn(),
    trackException: vi.fn()
  }))
}));

describe('Dashboard Component', () => {
  // Mock WebSocket server
  let mockServer: MockWebSocket;
  
  beforeEach(() => {
    mockServer = new MockWebSocket('ws://localhost:8080');
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockServer.close();
  });

  const renderDashboard = () => {
    return render(
      <Provider store={mockStore}>
        <ErrorBoundary fallback={<div>Error</div>}>
          <Dashboard refreshInterval={30000} enableRealtime={true} />
        </ErrorBoundary>
      </Provider>
    );
  };

  it('renders dashboard with all required components', async () => {
    renderDashboard();

    // Verify main components are rendered
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('processing-queue')).toBeInTheDocument();
  });

  it('handles real-time metric updates correctly', async () => {
    renderDashboard();

    const mockMetricUpdate = {
      activeClients: 46,
      processingQueue: 11,
      systemHealth: 99.95,
      lastUpdate: '2024-01-20T10:30:00Z'
    };

    // Simulate WebSocket message
    mockServer.send(JSON.stringify({
      event: 'metrics.update',
      data: mockMetricUpdate
    }));

    await waitFor(() => {
      expect(screen.getByText('46')).toBeInTheDocument(); // Active clients
      expect(screen.getByText('11')).toBeInTheDocument(); // Processing queue
    });
  });

  it('maintains accessibility compliance', async () => {
    const { container } = renderDashboard();

    // Run accessibility audit
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);

    // Verify ARIA attributes
    expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Admin Dashboard');
    expect(screen.getByRole('complementary')).toHaveAttribute('aria-label', 'System Metrics');
  });

  it('handles error states gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    renderDashboard();

    // Simulate error in child component
    const error = new Error('Test error');
    const mockErrorUpdate = {
      type: 'error',
      message: error.message
    };

    mockServer.send(JSON.stringify({
      event: 'system.error',
      data: mockErrorUpdate
    }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('tracks performance metrics correctly', async () => {
    const mockPerformanceMetrics = {
      responseTime: 150,
      uptime: 99.93,
      errorRate: 0.01,
      throughput: 1000
    };

    renderDashboard();

    // Verify performance monitoring
    await waitFor(() => {
      const performanceSection = screen.getByTestId('performance-metrics');
      expect(within(performanceSection).getByText('99.93%')).toBeInTheDocument();
      expect(within(performanceSection).getByText('150ms')).toBeInTheDocument();
    });
  });

  it('updates document processing queue in real-time', async () => {
    renderDashboard();

    const mockQueueUpdate = {
      documentId: 'doc-123',
      status: 'processing',
      progress: 75
    };

    mockServer.send(JSON.stringify({
      event: 'document.processing',
      data: mockQueueUpdate
    }));

    await waitFor(() => {
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    });
  });

  it('handles WebSocket disconnection gracefully', async () => {
    vi.mock('../../../../src/hooks/useWebSocket', () => ({
      useWebSocket: () => ({
        isConnected: false,
        addListener: vi.fn(),
        removeListener: vi.fn()
      })
    }));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Real-time updates disconnected')).toBeInTheDocument();
    });
  });

  it('refreshes data at specified interval', async () => {
    vi.useFakeTimers();
    const mockRefresh = vi.fn();
    
    renderDashboard();

    // Fast-forward time
    vi.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });

    vi.useRealTimers();
  });

  it('validates dashboard layout responsiveness', async () => {
    const { rerender } = renderDashboard();

    // Test desktop layout
    expect(screen.getByTestId('dashboard-grid')).toHaveStyle({
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)'
    });

    // Test mobile layout
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));
    rerender(
      <Provider store={mockStore}>
        <Dashboard refreshInterval={30000} enableRealtime={true} />
      </Provider>
    );

    expect(screen.getByTestId('dashboard-grid')).toHaveStyle({
      display: 'grid',
      gridTemplateColumns: 'repeat(1, 1fr)'
    });
  });
});