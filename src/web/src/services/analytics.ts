import axios from 'axios'; // v1.5.0
import { caching } from 'cache-manager'; // v4.1.0
import {
  UsageMetrics,
  DocumentMetrics,
  PerformanceMetrics,
  AnalyticsDashboard,
  TimeSeriesData,
  MetricPeriod,
  TrendDirection,
  MetricTrend
} from '../types/analytics';
import { ApiResponse, ApiError, ApiHeaders, createApiHeaders } from '../api/types';

/**
 * Cache configuration for analytics data
 */
const CACHE_CONFIG = {
  ttl: 300, // 5 minutes
  max: 100, // Maximum number of items
  refreshThreshold: 240 // Refresh if within 4 minutes of expiry
} as const;

/**
 * Retry configuration for API requests
 */
const RETRY_CONFIG = {
  retries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000
} as const;

/**
 * Initialize cache manager for analytics data
 */
const cache = caching({
  store: 'memory',
  max: CACHE_CONFIG.max,
  ttl: CACHE_CONFIG.ttl
});

/**
 * Analytics service class with comprehensive metrics handling
 */
class AnalyticsService {
  private readonly baseUrl: string;
  private readonly headers: ApiHeaders;

  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || '';
    this.headers = createApiHeaders();
  }

  /**
   * Retrieves complete dashboard metrics with caching
   */
  public async getDashboardMetrics(): Promise<AnalyticsDashboard> {
    const cacheKey = 'dashboard_metrics';
    const cached = await cache.get<AnalyticsDashboard>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get<ApiResponse<AnalyticsDashboard>>(
        `${this.baseUrl}/analytics/dashboard`,
        { headers: this.headers }
      );

      const dashboard = response.data.data;
      await cache.set(cacheKey, dashboard);
      return dashboard;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Fetches usage metrics with period filtering and retry mechanism
   */
  public async getUsageMetrics(period: MetricPeriod): Promise<UsageMetrics> {
    const cacheKey = `usage_metrics_${period}`;
    const cached = await cache.get<UsageMetrics>(cacheKey);

    if (cached) {
      return cached;
    }

    let retryCount = 0;
    while (retryCount < RETRY_CONFIG.retries) {
      try {
        const response = await axios.get<ApiResponse<UsageMetrics>>(
          `${this.baseUrl}/analytics/usage`,
          {
            headers: this.headers,
            params: { period }
          }
        );

        const metrics = response.data.data;
        await cache.set(cacheKey, metrics);
        return metrics;
      } catch (error) {
        if (retryCount === RETRY_CONFIG.retries - 1) {
          throw this.handleApiError(error);
        }
        await this.delay(this.getRetryDelay(retryCount));
        retryCount++;
      }
    }

    throw new Error('Failed to fetch usage metrics after retries');
  }

  /**
   * Retrieves document processing metrics
   */
  public async getDocumentMetrics(): Promise<DocumentMetrics> {
    const cacheKey = 'document_metrics';
    const cached = await cache.get<DocumentMetrics>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get<ApiResponse<DocumentMetrics>>(
        `${this.baseUrl}/analytics/documents`,
        { headers: this.headers }
      );

      const metrics = response.data.data;
      await cache.set(cacheKey, metrics);
      return metrics;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Fetches system performance metrics with real-time updates
   */
  public async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const cacheKey = 'performance_metrics';
    const cached = await cache.get<PerformanceMetrics>(cacheKey);

    if (cached && this.isMetricsFresh(cached)) {
      return cached;
    }

    try {
      const response = await axios.get<ApiResponse<PerformanceMetrics>>(
        `${this.baseUrl}/analytics/performance`,
        { headers: this.headers }
      );

      const metrics = response.data.data;
      await cache.set(cacheKey, metrics);
      return metrics;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Retrieves metric trends with time series analysis
   */
  public async getMetricTrends(
    metricNames: string[],
    period: MetricPeriod
  ): Promise<TimeSeriesData[]> {
    const cacheKey = `metric_trends_${metricNames.join('_')}_${period}`;
    const cached = await cache.get<TimeSeriesData[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const response = await axios.get<ApiResponse<TimeSeriesData[]>>(
        `${this.baseUrl}/analytics/trends`,
        {
          headers: this.headers,
          params: {
            metrics: metricNames.join(','),
            period
          }
        }
      );

      const trends = response.data.data;
      await cache.set(cacheKey, trends);
      return trends;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Analyzes metric trends and determines direction
   */
  private analyzeTrend(current: number, previous: number): TrendDirection {
    const percentageChange = ((current - previous) / previous) * 100;
    
    if (Math.abs(percentageChange) < 1) {
      return TrendDirection.STABLE;
    }
    
    if (percentageChange > 10) {
      return TrendDirection.CRITICAL;
    }
    
    return percentageChange > 0 
      ? TrendDirection.INCREASING 
      : TrendDirection.DECREASING;
  }

  /**
   * Checks if cached metrics are fresh enough for use
   */
  private isMetricsFresh(metrics: PerformanceMetrics): boolean {
    const lastUpdate = new Date(metrics.uptime).getTime();
    const now = Date.now();
    return now - lastUpdate < CACHE_CONFIG.refreshThreshold * 1000;
  }

  /**
   * Calculates exponential backoff delay for retries
   */
  private getRetryDelay(retryCount: number): number {
    const delay = Math.min(
      RETRY_CONFIG.initialDelayMs * Math.pow(2, retryCount),
      RETRY_CONFIG.maxDelayMs
    );
    return delay + Math.random() * 1000; // Add jitter
  }

  /**
   * Handles API errors with detailed error messages
   */
  private handleApiError(error: unknown): Error {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiError;
      return new Error(
        `Analytics API Error: ${apiError.message} (Code: ${apiError.statusCode})`
      );
    }
    return new Error('An unexpected error occurred while fetching analytics data');
  }

  /**
   * Utility method for implementing delay in retry mechanism
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();