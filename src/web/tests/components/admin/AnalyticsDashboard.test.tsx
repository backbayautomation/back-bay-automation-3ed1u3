import React from 'react'; // react@18.2.0
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'; // @testing-library/react@14.0.0
import { vi } from 'vitest'; // vitest@0.34.0
import { axe } from '@axe-core/react'; // @axe-core/react@4.7.3
import { ThemeProvider } from '@mui/material'; // @mui/material@5.14.0

import AnalyticsDashboard from '../../../src/components/admin/AnalyticsDashboard/AnalyticsDashboard';
import { AnalyticsService } from '../../../src/services/analytics';
import { lightTheme } from '../../../src/config/theme';
import { MetricPeriod, TrendDirection } from '../../../src/types/analytics';

// Mock analytics service
vi.mock('../../../src/services/analytics', () => ({
  getUsageMetrics: vi.fn(),
  getDocumentMetrics: vi.fn(),
  getPerformanceMetrics: vi.fn(),
  getMetricTrends: vi.fn()
}));

// Mock data for testing
const mockMetricsData = {
  usage: {
    totalQueries: 15000,
    activeUsers: 450,
    querySuccessRate: 98.5,
    userSatisfactionRate: 95.0,
    timeReductionPercentage: 80,
    accuracyRate: 97.5,
    userAdoptionRate: 92.0,
    averageResponseTime: 0.8
  },
  documents: {
    totalDocuments: 5000,
    processedDocuments: 4850,
    processingQueue: 150,
    averageProcessingTime: 2.5,
    processingSuccessRate: 97.0,
    documentErrorRate: 3.0,
    queueWaitTime: 1.5,
    processingCapacity: 100
  },
  performance: {
    uptime: 99.95,
    apiLatency: 150,
    errorRate: 0.5,
    concurrentUsers: 250,
    resourceUtilization: 65.0,
    queryResponseTime: 0.9,
    systemLoadAverage: 45.0,
    memoryUsage: 70.0
  }
};

const mockTimeSeriesData = [
  {
    timestamp: '2024-01-20T00:00:00Z',
    metricName: 'querySuccessRate',
    value: 98.5,
    dimension: 'success',
    period: MetricPeriod.DAILY,
    isRealTime: false
  },
  {
    timestamp: '2024-01-20T00:00:00Z',
    metricName: 'processingSuccessRate',
    value: 97.0,
    dimension: 'success',
    period: MetricPeriod.DAILY,
    isRealTime: false
  }
];

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
    // Setup mock responses
    vi.mocked(AnalyticsService.getUsageMetrics).mockResolvedValue(mockMetricsData.usage);
    vi.mocked(AnalyticsService.getDocumentMetrics).mockResolvedValue(mockMetricsData.documents);
    vi.mocked(AnalyticsService.getPerformanceMetrics).mockResolvedValue(mockMetricsData.performance);
    vi.mocked(AnalyticsService.getMetricTrends).mockResolvedValue(mockTimeSeriesData);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render loading state initially', () => {
      renderWithTheme(<AnalyticsDashboard />);
      expect(screen.getAllByRole('status')).toHaveLength(4); // 3 metric cards + 1 chart
    });

    it('should render all metrics cards after data loads', async () => {
      renderWithTheme(<AnalyticsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Query Success Rate')).toBeInTheDocument();
        expect(screen.getByText('Processing Success Rate')).toBeInTheDocument();
        expect(screen.getByText('System Uptime')).toBeInTheDocument();
      });
    });

    it('should render charts with correct data', async () => {
      renderWithTheme(<AnalyticsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText('Performance Trends')).toBeInTheDocument();
        expect(screen.getByText('Query Distribution')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch data on initial render', async () => {
      renderWithTheme(<AnalyticsDashboard />);
      
      await waitFor(() => {
        expect(AnalyticsService.getUsageMetrics).toHaveBeenCalledWith(MetricPeriod.DAILY);
        expect(AnalyticsService.getDocumentMetrics).toHaveBeenCalledWith(MetricPeriod.DAILY);
        expect(AnalyticsService.getPerformanceMetrics).toHaveBeenCalledWith(MetricPeriod.REALTIME);
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('Failed to fetch metrics');
      vi.mocked(AnalyticsService.getUsageMetrics).mockRejectedValue(error);

      renderWithTheme(<AnalyticsDashboard />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch dashboard data/i)).toBeInTheDocument();
      });
    });

    it('should refresh data periodically', async () => {
      vi.useFakeTimers();
      renderWithTheme(<AnalyticsDashboard refreshInterval={30000} />);

      await waitFor(() => {
        expect(AnalyticsService.getUsageMetrics).toHaveBeenCalledTimes(1);
      });

      act(() => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(AnalyticsService.getUsageMetrics).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });
  });

  describe('Date Range Selection', () => {
    it('should update data when date range changes', async () => {
      renderWithTheme(<AnalyticsDashboard />);
      
      const datePicker = await screen.findByRole('textbox', { name: /choose date range/i });
      fireEvent.click(datePicker);

      // Select new date range
      const dateInputs = screen.getAllByRole('textbox');
      fireEvent.change(dateInputs[0], { target: { value: '2024-01-01' } });
      fireEvent.change(dateInputs[1], { target: { value: '2024-01-20' } });

      await waitFor(() => {
        expect(AnalyticsService.getUsageMetrics).toHaveBeenCalledTimes(2);
      });
    });

    it('should show error for invalid date range', async () => {
      renderWithTheme(<AnalyticsDashboard />);
      
      const datePicker = await screen.findByRole('textbox', { name: /choose date range/i });
      fireEvent.click(datePicker);

      // Select date range > 90 days
      const dateInputs = screen.getAllByRole('textbox');
      fireEvent.change(dateInputs[0], { target: { value: '2023-01-01' } });
      fireEvent.change(dateInputs[1], { target: { value: '2024-01-20' } });

      await waitFor(() => {
        expect(screen.getByText(/Date range cannot exceed 90 days/i)).toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    it('should handle data export', async () => {
      const onExport = vi.fn();
      renderWithTheme(<AnalyticsDashboard onExport={onExport} />);
      
      const exportButton = await screen.findByText('Export Data');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(onExport).toHaveBeenCalledWith('csv');
      });
    });

    it('should show loading state during export', async () => {
      const onExport = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      renderWithTheme(<AnalyticsDashboard onExport={onExport} />);
      
      const exportButton = await screen.findByText('Export Data');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
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
      
      const exportButton = await screen.findByText('Export Data');
      exportButton.focus();
      expect(document.activeElement).toBe(exportButton);

      // Tab through interactive elements
      fireEvent.keyDown(document, { key: 'Tab' });
      await waitFor(() => {
        expect(document.activeElement).not.toBe(exportButton);
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
          expect(window.getComputedStyle(card).width).toBe('100%');
        });
      });
    });

    it('should maintain chart aspect ratio on resize', async () => {
      renderWithTheme(<AnalyticsDashboard />);
      
      global.innerWidth = 1024;
      global.dispatchEvent(new Event('resize'));
      
      await waitFor(() => {
        const charts = screen.getAllByRole('img');
        charts.forEach(chart => {
          const style = window.getComputedStyle(chart);
          expect(style.height).not.toBe('0px');
        });
      });
    });
  });
});