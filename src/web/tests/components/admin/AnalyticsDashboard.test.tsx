import React from 'react'; // ^18.2.0
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'; // ^14.0.0
import { vi } from 'vitest'; // ^0.34.0
import { axe } from '@axe-core/react'; // ^4.7.3
import { ThemeProvider } from '@mui/material'; // ^5.14.0
import { lightTheme } from '../../../config/theme';
import AnalyticsDashboard from '../../../src/components/admin/AnalyticsDashboard/AnalyticsDashboard';
import { analyticsService } from '../../../src/services/analytics';
import { MetricPeriod, TrendDirection } from '../../../types/analytics';

// Mock analytics service
vi.mock('../../../src/services/analytics', () => ({
  analyticsService: {
    getDashboardMetrics: vi.fn(),
    getMetricTrends: vi.fn()
  }
}));

// Mock WebSocket for real-time updates
const mockWebSocket = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn()
};

// Mock metrics data
const mockDashboardMetrics = {
  usage: {
    totalQueries: 15000,
    activeUsers: 450,
    querySuccessRate: 98.5,
    userSatisfactionRate: 95
  },
  documents: {
    totalDocuments: 5000,
    processedDocuments: 4800,
    processingQueue: 12
  },
  performance: {
    uptime: 99.95,
    apiLatency: 150,
    errorRate: 0.5,
    queryResponseTime: 250
  },
  trends: [
    {
      timestamp: '2024-01-20T10:00:00Z',
      metricName: 'queryResponseTime',
      value: 250,
      period: MetricPeriod.HOURLY
    }
  ],
  keyMetrics: [
    {
      metricName: 'totalQueries',
      currentValue: 15000,
      previousValue: 14000,
      percentageChange: 7.14,
      direction: TrendDirection.INCREASING,
      unit: 'queries',
      meetsSLA: true
    }
  ],
  lastUpdated: new Date()
};

// Custom render function with theme provider
const renderWithTheme = (component: React.ReactNode) => {
  return render(
    <ThemeProvider theme={lightTheme}>
      {component}
    </ThemeProvider>
  );
};

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock analytics service responses
    (analyticsService.getDashboardMetrics as jest.Mock).mockResolvedValue(mockDashboardMetrics);
    // Mock WebSocket
    global.WebSocket = vi.fn(() => mockWebSocket) as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockWebSocket.close();
  });

  describe('Rendering and Data Loading', () => {
    it('should render loading state initially', () => {
      renderWithTheme(<AnalyticsDashboard />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render dashboard data after loading', async () => {
      renderWithTheme(<AnalyticsDashboard />);
      
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      });

      // Verify metrics cards
      expect(screen.getByText('Total Queries')).toBeInTheDocument();
      expect(screen.getByText('15K')).toBeInTheDocument();
    });

    it('should handle error states gracefully', async () => {
      const error = new Error('Failed to fetch dashboard data');
      (analyticsService.getDashboardMetrics as jest.Mock).mockRejectedValue(error);

      renderWithTheme(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Error loading dashboard')).toBeInTheDocument();
        expect(screen.getByText(error.message)).toBeInTheDocument();
      });
    });
  });

  describe('Interactivity and Controls', () => {
    it('should handle date range changes', async () => {
      renderWithTheme(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const dateRangePicker = screen.getByRole('textbox', { name: /start date/i });
      fireEvent.change(dateRangePicker, { target: { value: '2024-01-01' } });

      expect(analyticsService.getDashboardMetrics).toHaveBeenCalledTimes(2);
    });

    it('should handle period selection changes', async () => {
      renderWithTheme(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const periodSelect = screen.getByRole('combobox', { name: /select time period/i });
      fireEvent.mouseDown(periodSelect);
      
      const dailyOption = screen.getByRole('option', { name: /daily/i });
      fireEvent.click(dailyOption);

      expect(analyticsService.getDashboardMetrics).toHaveBeenCalledTimes(2);
    });

    it('should handle refresh button click', async () => {
      renderWithTheme(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: /refresh dashboard data/i });
      fireEvent.click(refreshButton);

      expect(analyticsService.getDashboardMetrics).toHaveBeenCalledTimes(2);
    });
  });

  describe('Real-time Updates', () => {
    it('should establish WebSocket connection for real-time updates', async () => {
      renderWithTheme(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalled();
        expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      });
    });

    it('should update metrics when receiving WebSocket message', async () => {
      renderWithTheme(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const messageHandler = mockWebSocket.addEventListener.mock.calls[0][1];
      act(() => {
        messageHandler({
          data: JSON.stringify({
            type: 'metrics_update',
            data: {
              ...mockDashboardMetrics,
              usage: { ...mockDashboardMetrics.usage, totalQueries: 16000 }
            }
          })
        });
      });

      await waitFor(() => {
        expect(screen.getByText('16K')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should be accessible', async () => {
      const { container } = renderWithTheme(<AnalyticsDashboard />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle keyboard navigation', async () => {
      renderWithTheme(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      const controls = screen.getAllByRole('button');
      controls.forEach(control => {
        control.focus();
        expect(document.activeElement).toBe(control);
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adjust layout for mobile viewport', async () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      renderWithTheme(<AnalyticsDashboard />);

      await waitFor(() => {
        const metricsCards = screen.getAllByRole('article');
        metricsCards.forEach(card => {
          expect(card).toHaveStyle({ 'min-width': '200px' });
        });
      });
    });

    it('should adjust layout for tablet viewport', async () => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));

      renderWithTheme(<AnalyticsDashboard />);

      await waitFor(() => {
        const charts = screen.getAllByRole('img');
        expect(charts[0]).toHaveStyle({ height: '400px' });
      });
    });
  });

  describe('Performance', () => {
    it('should maintain performance during real-time updates', async () => {
      const startTime = performance.now();
      
      renderWithTheme(<AnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      // Simulate 10 rapid updates
      for (let i = 0; i < 10; i++) {
        const messageHandler = mockWebSocket.addEventListener.mock.calls[0][1];
        act(() => {
          messageHandler({
            data: JSON.stringify({
              type: 'metrics_update',
              data: {
                ...mockDashboardMetrics,
                usage: { ...mockDashboardMetrics.usage, totalQueries: 15000 + i * 1000 }
              }
            })
          });
        });
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});