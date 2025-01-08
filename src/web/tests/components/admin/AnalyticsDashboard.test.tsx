import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';
import { ThemeProvider } from '@mui/material';
import { lightTheme } from '../../../src/config/theme';
import AnalyticsDashboard from '../../../src/components/admin/AnalyticsDashboard/AnalyticsDashboard';
import { analyticsService } from '../../../src/services/analytics';
import { MetricPeriod, TrendDirection } from '../../../src/types/analytics';

// Mock analytics service
vi.mock('../../../src/services/analytics', () => ({
  analyticsService: {
    getUsageMetrics: vi.fn(),
    getDocumentMetrics: vi.fn(),
    getPerformanceMetrics: vi.fn(),
    getMetricTrends: vi.fn()
  }
}));

// Mock data for testing
const mockMetricsData = {
  usage: {
    totalQueries: 15000,
    activeUsers: 250,
    querySuccessRate: 98.5,
    averageResponseTime: 150
  },
  documents: {
    totalDocuments: 5000,
    processingQueue: 25,
    processingSuccessRate: 99.2
  },
  performance: {
    uptime: 99.99,
    apiLatency: 45,
    errorRate: 0.1,
    systemLoadAverage: 0.65
  },
  trends: [
    {
      timestamp: '2024-01-20T00:00:00Z',
      metricName: 'queries',
      value: 1500,
      period: MetricPeriod.DAILY,
      dimension: null,
      isRealTime: false
    }
  ]
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
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup mock responses
    analyticsService.getUsageMetrics.mockResolvedValue(mockMetricsData.usage);
    analyticsService.getDocumentMetrics.mockResolvedValue(mockMetricsData.documents);
    analyticsService.getPerformanceMetrics.mockResolvedValue(mockMetricsData.performance);
    analyticsService.getMetricTrends.mockResolvedValue(mockMetricsData.trends);

    // Mock window.matchMedia for responsive tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should render without crashing', () => {
    renderWithTheme(<AnalyticsDashboard />);
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
  });

  it('should pass accessibility audit', async () => {
    const { container } = renderWithTheme(<AnalyticsDashboard />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should load and display initial metrics data', async () => {
    renderWithTheme(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(analyticsService.getUsageMetrics).toHaveBeenCalled();
      expect(analyticsService.getDocumentMetrics).toHaveBeenCalled();
      expect(analyticsService.getPerformanceMetrics).toHaveBeenCalled();
      expect(analyticsService.getMetricTrends).toHaveBeenCalled();
    });

    expect(screen.getByText('15K')).toBeInTheDocument(); // Total Queries
    expect(screen.getByText('250')).toBeInTheDocument(); // Active Users
    expect(screen.getByText('99.99%')).toBeInTheDocument(); // System Uptime
  });

  it('should handle period change correctly', async () => {
    renderWithTheme(<AnalyticsDashboard />);

    const periodSelect = screen.getByLabelText('Select time period');
    fireEvent.mouseDown(periodSelect);
    
    const weeklyOption = screen.getByText('Weekly');
    fireEvent.click(weeklyOption);

    await waitFor(() => {
      expect(analyticsService.getUsageMetrics).toHaveBeenCalledWith(MetricPeriod.WEEKLY);
      expect(analyticsService.getMetricTrends).toHaveBeenCalledWith(
        ['queries', 'processing', 'response_time'],
        MetricPeriod.WEEKLY
      );
    });
  });

  it('should handle data refresh correctly', async () => {
    renderWithTheme(<AnalyticsDashboard />);

    const refreshButton = screen.getByLabelText('Refresh dashboard');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(analyticsService.getUsageMetrics).toHaveBeenCalledTimes(2);
      expect(analyticsService.getDocumentMetrics).toHaveBeenCalledTimes(2);
      expect(analyticsService.getPerformanceMetrics).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle export functionality', async () => {
    const onExport = vi.fn();
    renderWithTheme(<AnalyticsDashboard onExport={onExport} />);

    const exportButton = screen.getByLabelText('Export dashboard data');
    fireEvent.click(exportButton);

    expect(onExport).toHaveBeenCalledWith('csv');
  });

  it('should handle error states appropriately', async () => {
    const error = new Error('Failed to fetch metrics');
    analyticsService.getUsageMetrics.mockRejectedValue(error);

    renderWithTheme(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch metrics')).toBeInTheDocument();
    });
  });

  it('should update metrics automatically based on refresh interval', async () => {
    vi.useFakeTimers();
    renderWithTheme(<AnalyticsDashboard refreshInterval={5000} />);

    await waitFor(() => {
      expect(analyticsService.getUsageMetrics).toHaveBeenCalledTimes(1);
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(analyticsService.getUsageMetrics).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });

  it('should render charts with correct data', async () => {
    renderWithTheme(<AnalyticsDashboard />);

    await waitFor(() => {
      const lineChart = screen.getByLabelText('System metrics trends chart');
      expect(lineChart).toBeInTheDocument();
      
      const pieChart = screen.getByText('Query Success Rate');
      expect(pieChart).toBeInTheDocument();
    });
  });

  it('should handle responsive layout correctly', async () => {
    // Mock mobile viewport
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(max-width: 600px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { rerender } = renderWithTheme(<AnalyticsDashboard />);

    // Verify mobile layout adjustments
    expect(screen.getByText('Analytics Dashboard')).toHaveStyle({
      fontSize: expect.stringMatching(/1\.25rem|20px/)
    });

    // Mock desktop viewport
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(min-width: 1024px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    rerender(
      <ThemeProvider theme={lightTheme}>
        <AnalyticsDashboard />
      </ThemeProvider>
    );

    // Verify desktop layout adjustments
    const charts = screen.getAllByRole('img');
    expect(charts).toHaveLength(2);
  });

  it('should handle keyboard navigation correctly', async () => {
    renderWithTheme(<AnalyticsDashboard />);

    const periodSelect = screen.getByLabelText('Select time period');
    periodSelect.focus();
    expect(document.activeElement).toBe(periodSelect);

    fireEvent.keyDown(periodSelect, { key: 'Enter' });
    const weeklyOption = screen.getByText('Weekly');
    expect(weeklyOption).toBeInTheDocument();

    fireEvent.keyDown(weeklyOption, { key: 'Enter' });
    await waitFor(() => {
      expect(analyticsService.getUsageMetrics).toHaveBeenCalledWith(MetricPeriod.WEEKLY);
    });
  });
});