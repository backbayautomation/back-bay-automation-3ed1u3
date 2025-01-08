/**
 * Date utility functions for consistent date handling across the frontend application.
 * Provides formatting, manipulation, and validation with timezone support.
 * @module utils/date
 * @version 1.0.0
 */

import { format, formatDistance, parseISO, isValid, differenceInDays, isBefore, isAfter } from 'date-fns'; // v2.30.0
import type { Timestamp } from '../types/common';

// Memoization cache for chart date formatting
const chartDateCache = new Map<string, string>();
const CACHE_MAX_SIZE = 1000;

/**
 * Default date format for general display
 */
const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';

/**
 * Chart-specific date format
 */
const CHART_DATE_FORMAT = 'MMM dd, yyyy';

/**
 * Formats a date string or Date object into a standardized display format
 * @param date - Date to format
 * @param formatString - Optional format string (defaults to DEFAULT_DATE_FORMAT)
 * @returns Formatted date string or empty string if invalid
 */
export const formatDate = (
  date: Date | string | null,
  formatString: string = DEFAULT_DATE_FORMAT
): string => {
  try {
    if (!date) return '';

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      console.warn('Invalid date provided to formatDate:', date);
      return '';
    }

    return format(dateObj, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Formats a date relative to current time (e.g., "2 days ago")
 * @param date - Date to format
 * @returns Relative time string or empty string if invalid
 */
export const formatRelativeTime = (date: Date | string | null): string => {
  try {
    if (!date) return '';

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      console.warn('Invalid date provided to formatRelativeTime:', date);
      return '';
    }

    return formatDistance(dateObj, new Date(), { addSuffix: true });
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return '';
  }
};

/**
 * Checks if one date is before another with timezone consideration
 * @param date - Date to check
 * @param compareDate - Date to compare against
 * @returns True if date is before compareDate, false if invalid input
 */
export const isDateBefore = (
  date: Date | string | null,
  compareDate: Date | string | null
): boolean => {
  try {
    if (!date || !compareDate) return false;

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const compareDateObj = typeof compareDate === 'string' ? parseISO(compareDate) : compareDate;

    if (!isValid(dateObj) || !isValid(compareDateObj)) {
      console.warn('Invalid date(s) provided to isDateBefore:', { date, compareDate });
      return false;
    }

    return isBefore(dateObj, compareDateObj);
  } catch (error) {
    console.error('Error comparing dates:', error);
    return false;
  }
};

/**
 * Checks if one date is after another with timezone consideration
 * @param date - Date to check
 * @param compareDate - Date to compare against
 * @returns True if date is after compareDate, false if invalid input
 */
export const isDateAfter = (
  date: Date | string | null,
  compareDate: Date | string | null
): boolean => {
  try {
    if (!date || !compareDate) return false;

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const compareDateObj = typeof compareDate === 'string' ? parseISO(compareDate) : compareDate;

    if (!isValid(dateObj) || !isValid(compareDateObj)) {
      console.warn('Invalid date(s) provided to isDateAfter:', { date, compareDate });
      return false;
    }

    return isAfter(dateObj, compareDateObj);
  } catch (error) {
    console.error('Error comparing dates:', error);
    return false;
  }
};

/**
 * Calculates the absolute number of days between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Absolute number of days between dates, 0 if invalid input
 */
export const getDaysDifference = (
  startDate: Date | string | null,
  endDate: Date | string | null
): number => {
  try {
    if (!startDate || !endDate) return 0;

    const startDateObj = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const endDateObj = typeof endDate === 'string' ? parseISO(endDate) : endDate;

    if (!isValid(startDateObj) || !isValid(endDateObj)) {
      console.warn('Invalid date(s) provided to getDaysDifference:', { startDate, endDate });
      return 0;
    }

    return Math.abs(differenceInDays(endDateObj, startDateObj));
  } catch (error) {
    console.error('Error calculating days difference:', error);
    return 0;
  }
};

/**
 * Formats a date specifically for chart axis display with performance optimization
 * @param date - Date to format
 * @returns Formatted date string for chart display or empty string if invalid
 */
export const formatChartDate = (date: Date | string | null): string => {
  try {
    if (!date) return '';

    const dateString = typeof date === 'string' ? date : date.toISOString();
    
    // Check cache first
    const cached = chartDateCache.get(dateString);
    if (cached) return cached;

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      console.warn('Invalid date provided to formatChartDate:', date);
      return '';
    }

    const formatted = format(dateObj, CHART_DATE_FORMAT);

    // Implement LRU-like cache management
    if (chartDateCache.size >= CACHE_MAX_SIZE) {
      const firstKey = chartDateCache.keys().next().value;
      chartDateCache.delete(firstKey);
    }
    chartDateCache.set(dateString, formatted);

    return formatted;
  } catch (error) {
    console.error('Error formatting chart date:', error);
    return '';
  }
};