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
import {
  ApiResponse,
  ApiError,
  DEFAULT_API_CONFIG,
  isApiError
} from '../api/types';

// Cache configuration
const CACHE_TTL = {
  DASHBOARD: 5 * 60, // 5 minutes
  METRICS: 2 * 60, // 2 minutes
  TRENDS: 1 * 60 // 1 minute
};

const cache = caching({
  store: 'memory',
  max: 1000,
  ttl: CACHE_TTL.DASHBOARD
});

/**
 * Enhanced analytics service with caching, error handling, and real-time updates
 */
class AnalyticsService {
  private readonly baseUrl: string = process.env.REACT_APP_API_URL || '';
  private readonly config = {
    ...DEFAULT_API_CONFIG,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  /**
   * Retrieves comprehensive dashboard metrics with caching
   * @returns Promise<AnalyticsDashboard>
   */
  public async getDashboardMetrics(): Promise<AnalyticsDashboard> {
    const cacheKey = 'dashboard_metrics';
    const cachedData = await cache.get<AnalyticsDashboard>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await axios.get<ApiResponse<AnalyticsDashboard>>(
        `${this.baseUrl}/analytics/dashboard`,
        this.config
      );

      const dashboard = response.data.data;
      await cache.set(cacheKey, dashboard, CACHE_TTL.DASHBOARD);
      return dashboard;
    } catch (error) {
      if (isApiError(error)) {
        throw new Error(`Failed to fetch dashboard metrics: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetches usage metrics with period-based caching
   * @param period MetricPeriod
   * @returns Promise<UsageMetrics>
   */
  public async getUsageMetrics(period: MetricPeriod): Promise<UsageMetrics> {
    const cacheKey = `usage_metrics_${period}`;
    const cachedData = await cache.get<UsageMetrics>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await axios.get<ApiResponse<UsageMetrics>>(
        `${this.baseUrl}/analytics/usage`,
        {
          ...this.config,
          params: { period }
        }
      );

      const metrics = response.data.data;
      await cache.set(cacheKey, metrics, CACHE_TTL.METRICS);
      return metrics;
    } catch (error) {
      if (isApiError(error)) {
        throw new Error(`Failed to fetch usage metrics: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Retrieves document processing metrics
   * @returns Promise<DocumentMetrics>
   */
  public async getDocumentMetrics(): Promise<DocumentMetrics> {
    const cacheKey = 'document_metrics';
    const cachedData = await cache.get<DocumentMetrics>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await axios.get<ApiResponse<DocumentMetrics>>(
        `${this.baseUrl}/analytics/documents`,
        this.config
      );

      const metrics = response.data.data;
      await cache.set(cacheKey, metrics, CACHE_TTL.METRICS);
      return metrics;
    } catch (error) {
      if (isApiError(error)) {
        throw new Error(`Failed to fetch document metrics: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetches system performance metrics
   * @returns Promise<PerformanceMetrics>
   */
  public async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const cacheKey = 'performance_metrics';
    const cachedData = await cache.get<PerformanceMetrics>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await axios.get<ApiResponse<PerformanceMetrics>>(
        `${this.baseUrl}/analytics/performance`,
        this.config
      );

      const metrics = response.data.data;
      await cache.set(cacheKey, metrics, CACHE_TTL.METRICS);
      return metrics;
    } catch (error) {
      if (isApiError(error)) {
        throw new Error(`Failed to fetch performance metrics: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Retrieves time series data for metric trends with real-time updates
   * @param metricNames string[]
   * @param period MetricPeriod
   * @returns Promise<TimeSeriesData[]>
   */
  public async getMetricTrends(
    metricNames: string[],
    period: MetricPeriod
  ): Promise<TimeSeriesData[]> {
    const cacheKey = `metric_trends_${metricNames.join('_')}_${period}`;
    const cachedData = await cache.get<TimeSeriesData[]>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await axios.get<ApiResponse<TimeSeriesData[]>>(
        `${this.baseUrl}/analytics/trends`,
        {
          ...this.config,
          params: {
            metrics: metricNames.join(','),
            period
          }
        }
      );

      const trends = response.data.data;
      await cache.set(cacheKey, trends, CACHE_TTL.TRENDS);
      return trends;
    } catch (error) {
      if (isApiError(error)) {
        throw new Error(`Failed to fetch metric trends: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Analyzes metric trends and determines trend direction
   * @param current number
   * @param previous number
   * @returns TrendDirection
   */
  private analyzeTrendDirection(current: number, previous: number): TrendDirection {
    const percentageChange = ((current - previous) / previous) * 100;
    
    if (percentageChange > 10) return TrendDirection.INCREASING;
    if (percentageChange < -10) return TrendDirection.DECREASING;
    if (percentageChange >= -2 && percentageChange <= 2) return TrendDirection.STABLE;
    if (percentageChange < -20) return TrendDirection.CRITICAL;
    return TrendDirection.OPTIMAL;
  }

  /**
   * Invalidates specific cache entries
   * @param keys string[]
   */
  public async invalidateCache(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => cache.del(key)));
  }
}

export const analyticsService = new AnalyticsService();