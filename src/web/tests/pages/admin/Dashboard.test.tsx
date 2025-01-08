import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';
import { MockWebSocket } from 'mock-socket';
import { ErrorBoundary } from 'react-error-boundary';

import Dashboard from '../../../../src/pages/admin/Dashboard';
import { analyticsService } from '../../../services/analytics';
import { WebSocketClient } from '../../../api/websocket';

// Mock dependencies
vi.mock('../../../../src/components/admin/AnalyticsDashboard/AnalyticsDashboard', () => ({
  default: vi.fn().mockImplementation(({ onExport }) => (
    <div data-testid="analytics-dashboard">
      Analytics Dashboard
      <button onClick={() => onExport('csv')}>Export</button>
    </div>
  ))
}));

vi.mock('../../../../src/components/admin/DocumentProcessing/ProcessingQueue', () => ({
  default: vi.fn().mockImplementation(({ onProcessingComplete, onError }) => (
    <div data-testid="processing-queue">
      Processing Queue
      <button onClick={() => onProcessingComplete({ id: '123' })}>Complete</button>
      <button onClick={() => onError(new Error('Test error'))}>Trigger Error</button>
    </div>
  ))
}));

// Mock Application Insights
vi.mock('@microsoft/applicationinsights-web', () => ({
  ApplicationInsights: vi.fn().mockImplementation(() => ({
    loadAppInsights: vi.fn(),
    trackPageView: vi.fn(),
    trackEvent: vi.fn(),
    trackException: vi.fn()
  }))
}));

// Mock WebSocket service
const mockWebSocket = {
  connect: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn()
};

// Mock real-time updates data
const mockRealTimeUpdates = {
  activeClients: 46,
  processingQueue: 11,
  systemHealth: 99.95,
  lastUpdate: '2024-01-20T10:30:00Z'
};

// Mock performance metrics
const mockPerformanceMetrics = {
  responseTime: 150,
  uptime: 99.93,
  errorRate: 0.01,
  throughput: 1000
};

describe('Dashboard', () => {
  let mockWsServer: MockWebSocket;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Initialize mock WebSocket server
    mockWsServer = new MockWebSocket('ws://localhost:8080');
    
    // Mock WebSocket connection
    global.WebSocket = vi.fn().mockImplementation(() => mockWsServer);
    
    // Mock auth context
    vi.mock('../../../../src/hooks/useAuth', () => ({
      useAuth: () => ({
        isAuthenticated: true,
        user: { id: 'test-user', name: 'Test User' }
      })
    }));
  });

  afterEach(() => {
    mockWsServer.close();
  });

  it('renders dashboard components correctly', async () => {
    render(
      <Provider store={{}}>
        <Dashboard />
      </Provider>
    );

    expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('processing-queue')).toBeInTheDocument();
  });

  it('handles real-time updates via WebSocket', async () => {
    render(
      <Provider store={{}}>
        <Dashboard enableRealtime={true} />
      </Provider>
    );

    // Simulate WebSocket message
    mockWsServer.send(JSON.stringify({
      type: 'dashboard.update',
      data: mockRealTimeUpdates
    }));

    await waitFor(() => {
      expect(screen.getByText(`Active Clients: ${mockRealTimeUpdates.activeClients}`)).toBeInTheDocument();
      expect(screen.getByText(`Queue Size: ${mockRealTimeUpdates.processingQueue}`)).toBeInTheDocument();
    });
  });

  it('maintains accessibility compliance', async () => {
    const { container } = render(
      <Provider store={{}}>
        <Dashboard />
      </Provider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles document processing events correctly', async () => {
    const onProcessingComplete = vi.fn();

    render(
      <Provider store={{}}>
        <Dashboard onProcessingComplete={onProcessingComplete} />
      </Provider>
    );

    const completeButton = screen.getByText('Complete');
    fireEvent.click(completeButton);

    expect(onProcessingComplete).toHaveBeenCalledWith({ id: '123' });
  });

  it('tracks analytics events correctly', async () => {
    const { container } = render(
      <Provider store={{}}>
        <Dashboard />
      </Provider>
    );

    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(ApplicationInsights.prototype.trackEvent).toHaveBeenCalledWith({
        name: 'DashboardExport',
        properties: expect.any(Object)
      });
    });
  });

  it('handles errors gracefully', async () => {
    render(
      <Provider store={{}}>
        <ErrorBoundary fallback={<div>Error Boundary</div>}>
          <Dashboard />
        </ErrorBoundary>
      </Provider>
    );

    const errorButton = screen.getByText('Trigger Error');
    fireEvent.click(errorButton);

    await waitFor(() => {
      expect(ApplicationInsights.prototype.trackException).toHaveBeenCalled();
      expect(screen.getByText('Error Boundary')).toBeInTheDocument();
    });
  });

  it('updates performance metrics periodically', async () => {
    vi.useFakeTimers();

    render(
      <Provider store={{}}>
        <Dashboard refreshInterval={300000} />
      </Provider>
    );

    // Fast-forward 5 minutes
    vi.advanceTimersByTime(300000);

    await waitFor(() => {
      expect(screen.getByText(`Response Time: ${mockPerformanceMetrics.responseTime}ms`)).toBeInTheDocument();
      expect(screen.getByText(`Uptime: ${mockPerformanceMetrics.uptime}%`)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('handles WebSocket reconnection', async () => {
    render(
      <Provider store={{}}>
        <Dashboard enableRealtime={true} />
      </Provider>
    );

    // Simulate WebSocket disconnection
    mockWsServer.close();

    // Simulate reconnection
    mockWsServer = new MockWebSocket('ws://localhost:8080');

    await waitFor(() => {
      expect(mockWebSocket.connect).toHaveBeenCalledTimes(2);
    });
  });

  it('cleans up resources on unmount', () => {
    const { unmount } = render(
      <Provider store={{}}>
        <Dashboard />
      </Provider>
    );

    unmount();

    expect(mockWebSocket.unsubscribe).toHaveBeenCalled();
  });
});