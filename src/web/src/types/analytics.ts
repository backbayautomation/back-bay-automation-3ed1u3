/**
 * TypeScript type definitions for analytics data structures.
 * Provides comprehensive type safety for analytics features with enhanced support
 * for performance monitoring and trend analysis.
 * @version 1.0.0
 */

import { PaginatedResponse } from './common';

/**
 * Union type for flexible metric value representation
 */
export type MetricValue = number | string | boolean | null;

/**
 * Type for detailed metric data points with metadata
 */
export type MetricDataPoint = {
  timestamp: string;
  value: MetricValue;
  metadata?: Record<string, unknown>;
  confidence?: number;
};

/**
 * Enum for metric trend directions with additional context
 */
export enum TrendDirection {
  INCREASING = 'INCREASING',
  DECREASING = 'DECREASING',
  STABLE = 'STABLE',
  CRITICAL = 'CRITICAL',
  OPTIMAL = 'OPTIMAL'
}

/**
 * Enum for metric time periods with granular options
 */
export enum MetricPeriod {
  REALTIME = 'REALTIME',
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  CUSTOM = 'CUSTOM'
}

/**
 * Interface for comprehensive user and system usage metrics with success criteria tracking
 */
export interface UsageMetrics {
  totalQueries: number;
  activeUsers: number;
  averageResponseTime: number;
  querySuccessRate: number;
  userSatisfactionRate: number;
  timeReductionPercentage: number;
  accuracyRate: number;
  userAdoptionRate: number;
}

/**
 * Interface for detailed document processing metrics and queue status
 */
export interface DocumentMetrics {
  totalDocuments: number;
  processedDocuments: number;
  processingQueue: number;
  averageProcessingTime: number;
  processingSuccessRate: number;
  documentErrorRate: number;
  queueWaitTime: number;
  readonly processingCapacity: number;
}

/**
 * Interface for detailed system performance metrics targeting SLA requirements
 */
export interface PerformanceMetrics {
  uptime: number;
  apiLatency: number;
  errorRate: number;
  concurrentUsers: number;
  resourceUtilization: number;
  queryResponseTime: number;
  systemLoadAverage: number;
  memoryUsage: number;
}

/**
 * Interface for time-based analytics data with enhanced granularity
 */
export interface TimeSeriesData {
  timestamp: string;
  metricName: string;
  value: MetricValue;
  dimension: string | null;
  period: MetricPeriod;
  isRealTime: boolean;
}

/**
 * Interface for detailed metric trend analysis
 */
export interface MetricTrend {
  currentValue: number;
  previousValue: number;
  percentageChange: number;
  direction: TrendDirection;
  metricName: string;
  unit: string;
  meetsSLA: boolean;
}

/**
 * Main interface for analytics dashboard data with real-time updates
 */
export interface AnalyticsDashboard {
  usage: UsageMetrics;
  documents: DocumentMetrics;
  performance: PerformanceMetrics;
  trends: TimeSeriesData[];
  keyMetrics: MetricTrend[];
  readonly lastUpdated: Date;
}

/**
 * Type for paginated analytics data responses
 */
export type PaginatedAnalytics<T> = PaginatedResponse<T>;

/**
 * Type guard to check if a metric trend is critical
 */
export function isCriticalTrend(trend: MetricTrend): boolean {
  return trend.direction === TrendDirection.CRITICAL;
}

/**
 * Type guard to check if performance meets SLA requirements
 */
export function meetsSLARequirements(metrics: PerformanceMetrics): boolean {
  return (
    metrics.uptime >= 99.9 &&
    metrics.queryResponseTime < 60000 && // 60 seconds in milliseconds
    metrics.errorRate < 0.01 // 1% error rate threshold
  );
}