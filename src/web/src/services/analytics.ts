/**
 * Analytics service for handling data fetching, processing, caching, and real-time monitoring.
 * Provides comprehensive methods for retrieving usage metrics, document processing statistics,
 * system performance data, and trend analysis.
 * @version 1.0.0
 */

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
import { ApiResponse, ApiError, DEFAULT_API_CONFIG } from '../api/types';
import { UUID } from '../types/common';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes in seconds
const REALTIME_TTL = 30; // 30 seconds for real-time data
const cache = caching({
    store: 'memory',
    max: 1000,
    ttl: CACHE_TTL
});

// API endpoints
const API_ENDPOINTS = {
    DASHBOARD: '/api/v1/analytics/dashboard',
    USAGE: '/api/v1/analytics/usage',
    DOCUMENTS: '/api/v1/analytics/documents',
    PERFORMANCE: '/api/v1/analytics/performance',
    TRENDS: '/api/v1/analytics/trends'
} as const;

// Retry configuration
const RETRY_CONFIG = {
    retries: 3,
    backoff: 1000,
    maxBackoff: 5000
};

/**
 * Handles API request retries with exponential backoff
 */
async function retryableRequest<T>(
    url: string,
    config: typeof DEFAULT_API_CONFIG,
    retryCount = 0
): Promise<ApiResponse<T>> {
    try {
        const response = await axios.get<ApiResponse<T>>(url, config);
        return response.data;
    } catch (error) {
        if (retryCount >= RETRY_CONFIG.retries) {
            throw error;
        }
        const backoff = Math.min(
            RETRY_CONFIG.backoff * Math.pow(2, retryCount),
            RETRY_CONFIG.maxBackoff
        );
        await new Promise(resolve => setTimeout(resolve, backoff));
        return retryableRequest(url, config, retryCount + 1);
    }
}

/**
 * Generates cache key based on parameters
 */
function generateCacheKey(endpoint: string, period?: MetricPeriod, params?: Record<string, any>): string {
    return `${endpoint}:${period || 'default'}:${JSON.stringify(params || {})}`;
}

/**
 * Analytics service implementation with caching and real-time updates
 */
const AnalyticsService = {
    /**
     * Retrieves comprehensive dashboard metrics with caching
     */
    async getDashboardMetrics(): Promise<AnalyticsDashboard> {
        const cacheKey = generateCacheKey(API_ENDPOINTS.DASHBOARD);
        const cachedData = await cache.get<AnalyticsDashboard>(cacheKey);
        
        if (cachedData) {
            return cachedData;
        }

        try {
            const response = await retryableRequest<AnalyticsDashboard>(
                API_ENDPOINTS.DASHBOARD,
                DEFAULT_API_CONFIG
            );

            await cache.set(cacheKey, response.data, {
                ttl: CACHE_TTL
            });

            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch dashboard metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    /**
     * Fetches usage metrics with period-based caching
     */
    async getUsageMetrics(period: MetricPeriod): Promise<UsageMetrics> {
        const cacheKey = generateCacheKey(API_ENDPOINTS.USAGE, period);
        const cachedData = await cache.get<UsageMetrics>(cacheKey);

        if (cachedData && period !== MetricPeriod.REALTIME) {
            return cachedData;
        }

        try {
            const response = await retryableRequest<UsageMetrics>(
                `${API_ENDPOINTS.USAGE}?period=${period}`,
                DEFAULT_API_CONFIG
            );

            const ttl = period === MetricPeriod.REALTIME ? REALTIME_TTL : CACHE_TTL;
            await cache.set(cacheKey, response.data, { ttl });

            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch usage metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    /**
     * Retrieves document processing metrics
     */
    async getDocumentMetrics(period: MetricPeriod): Promise<DocumentMetrics> {
        const cacheKey = generateCacheKey(API_ENDPOINTS.DOCUMENTS, period);
        const cachedData = await cache.get<DocumentMetrics>(cacheKey);

        if (cachedData && period !== MetricPeriod.REALTIME) {
            return cachedData;
        }

        try {
            const response = await retryableRequest<DocumentMetrics>(
                `${API_ENDPOINTS.DOCUMENTS}?period=${period}`,
                DEFAULT_API_CONFIG
            );

            const ttl = period === MetricPeriod.REALTIME ? REALTIME_TTL : CACHE_TTL;
            await cache.set(cacheKey, response.data, { ttl });

            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch document metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    /**
     * Fetches system performance metrics with real-time updates
     */
    async getPerformanceMetrics(period: MetricPeriod): Promise<PerformanceMetrics> {
        const cacheKey = generateCacheKey(API_ENDPOINTS.PERFORMANCE, period);
        const cachedData = await cache.get<PerformanceMetrics>(cacheKey);

        if (cachedData && period !== MetricPeriod.REALTIME) {
            return cachedData;
        }

        try {
            const response = await retryableRequest<PerformanceMetrics>(
                `${API_ENDPOINTS.PERFORMANCE}?period=${period}`,
                DEFAULT_API_CONFIG
            );

            const ttl = period === MetricPeriod.REALTIME ? REALTIME_TTL : CACHE_TTL;
            await cache.set(cacheKey, response.data, { ttl });

            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch performance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    /**
     * Retrieves and processes time series data for metric trends
     */
    async getMetricTrends(
        metricNames: string[],
        period: MetricPeriod
    ): Promise<TimeSeriesData[]> {
        const cacheKey = generateCacheKey(API_ENDPOINTS.TRENDS, period, { metrics: metricNames });
        const cachedData = await cache.get<TimeSeriesData[]>(cacheKey);

        if (cachedData && period !== MetricPeriod.REALTIME) {
            return cachedData;
        }

        try {
            const response = await retryableRequest<TimeSeriesData[]>(
                `${API_ENDPOINTS.TRENDS}?metrics=${metricNames.join(',')}&period=${period}`,
                DEFAULT_API_CONFIG
            );

            const ttl = period === MetricPeriod.REALTIME ? REALTIME_TTL : CACHE_TTL;
            await cache.set(cacheKey, response.data, { ttl });

            return response.data;
        } catch (error) {
            throw new Error(`Failed to fetch metric trends: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
};

export default AnalyticsService;