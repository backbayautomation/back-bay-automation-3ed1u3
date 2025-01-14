import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { Provider } from 'react-redux';
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
      id: 'test-user-id',
      orgId: 'test-org-id',
      fullName: 'Test User'
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

vi.mock('@microsoft/applicationinsights-web', () => ({
  ApplicationInsights: vi.fn().mockImplementation(() => ({
    loadAppInsights: vi.fn(),
    trackPageView: vi.fn(),
    trackEvent: vi.fn(),
    trackException: vi.fn()
  }))
}));

// Mock WebSocket server
const mockWebSocketServer = new MockWebSocket('ws://localhost:8080');

// Test data
const mockRealTimeUpdates = {
  activeClients: 46,
  processingQueue: 11,
  systemHealth: 99.95,
  lastUpdate: '2024-01-20T10:30:00Z'
};

const mockPerformanceMetrics = {
  responseTime: 150,
  uptime: 99.93,
  errorRate: 0.01,
  throughput: 1000
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSocketServer.resetHandlers();
  });

  it('renders dashboard with all required components', async () => {
    render(
      <Provider store={{}}>
        <Dashboard />
      </Provider>
    );

    // Verify main components are rendered
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /processing queue/i })).toBeInTheDocument();
  });

  it('handles real-time updates via WebSocket', async () => {
    render(
      <Provider store={{}}>
        <Dashboard enableRealtime={true} />
      </Provider>
    );

    // Simulate WebSocket message
    mockWebSocketServer.send(JSON.stringify({
      type: 'metrics.update',
      data: mockRealTimeUpdates
    }));

    // Verify metrics are updated
    await waitFor(() => {
      expect(screen.getByText(/46/)).toBeInTheDocument(); // Active clients
      expect(screen.getByText(/99.95%/)).toBeInTheDocument(); // System health
    });
  });

  it('maintains accessibility compliance', async () => {
    const { container } = render(
      <Provider store={{}}>
        <Dashboard />
      </Provider>
    );

    // Run accessibility audit
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);

    // Verify keyboard navigation
    const firstFocusableElement = screen.getByRole('button', { name: /refresh/i });
    firstFocusableElement.focus();
    expect(document.activeElement).toBe(firstFocusableElement);
  });

  it('handles error states gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <Provider store={{}}>
        <ErrorBoundary fallback={<div>Error state</div>}>
          <Dashboard />
        </ErrorBoundary>
      </Provider>
    );

    // Simulate error in AnalyticsDashboard
    mockWebSocketServer.send(JSON.stringify({
      type: 'error',
      data: { message: 'Failed to fetch metrics' }
    }));

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('tracks performance metrics correctly', async () => {
    const trackMetric = vi.fn();
    
    render(
      <Provider store={{}}>
        <Dashboard refreshInterval={30000} />
      </Provider>
    );

    // Simulate performance data
    mockWebSocketServer.send(JSON.stringify({
      type: 'performance.update',
      data: mockPerformanceMetrics
    }));

    await waitFor(() => {
      expect(screen.getByText(/99.93%/)).toBeInTheDocument(); // Uptime
      expect(screen.getByText(/150ms/)).toBeInTheDocument(); // Response time
    });
  });

  it('handles document processing updates', async () => {
    const onProcessingComplete = vi.fn();
    
    render(
      <Provider store={{}}>
        <Dashboard onProcessingComplete={onProcessingComplete} />
      </Provider>
    );

    // Simulate document processing update
    mockWebSocketServer.send(JSON.stringify({
      type: 'document.processing',
      data: {
        documentId: 'test-doc-1',
        status: 'completed',
        progress: 100
      }
    }));

    await waitFor(() => {
      expect(onProcessingComplete).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-doc-1',
        status: 'completed'
      }));
    });
  });

  it('handles authentication state correctly', async () => {
    vi.mocked(useAuth).mockImplementationOnce(() => ({
      isAuthenticated: false,
      user: null
    }));

    render(
      <Provider store={{}}>
        <Dashboard />
      </Provider>
    );

    expect(screen.getByText(/authentication required/i)).toBeInTheDocument();
  });

  it('supports custom refresh intervals', async () => {
    vi.useFakeTimers();
    
    render(
      <Provider store={{}}>
        <Dashboard refreshInterval={5000} />
      </Provider>
    );

    // Fast-forward time and verify refresh
    vi.advanceTimersByTime(5000);
    
    await waitFor(() => {
      expect(screen.getByText(/updating/i)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('integrates with Application Insights correctly', async () => {
    const trackPageView = vi.fn();
    const ApplicationInsights = vi.mocked(ApplicationInsights);
    ApplicationInsights.mockImplementation(() => ({
      loadAppInsights: vi.fn(),
      trackPageView,
      trackEvent: vi.fn(),
      trackException: vi.fn()
    }));

    render(
      <Provider store={{}}>
        <Dashboard />
      </Provider>
    );

    expect(trackPageView).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Admin Dashboard'
    }));
  });
});