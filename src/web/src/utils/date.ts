/**
 * Date utility functions for consistent date handling across the frontend application.
 * Provides formatting, manipulation, and validation with timezone support.
 * @version 1.0.0
 */

import { format, formatDistance, parseISO, isValid, differenceInDays, isBefore, isAfter } from 'date-fns'; // v2.30.0
import type { Timestamp } from '../types/common';

// Cache for memoized chart date formatting
const chartDateCache = new Map<string, string>();

/**
 * Formats a date string or Date object into a standardized display format
 * @param date - Input date to format
 * @param formatString - Format string pattern (e.g., 'yyyy-MM-dd')
 * @returns Formatted date string or empty string if invalid
 */
export const formatDate = (date: Date | string | null, formatString: string): string => {
  try {
    if (!date) return '';

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';

    return format(dateObj, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Formats a date relative to current time (e.g., "2 days ago")
 * @param date - Input date to format
 * @returns Relative time string or empty string if invalid
 */
export const formatRelativeTime = (date: Date | string | null): string => {
  try {
    if (!date) return '';

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';

    return formatDistance(dateObj, new Date(), { addSuffix: true });
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return '';
  }
};

/**
 * Checks if one date is before another with timezone consideration
 * @param date - Date to compare
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

    if (!isValid(dateObj) || !isValid(compareDateObj)) return false;

    return isBefore(dateObj, compareDateObj);
  } catch (error) {
    console.error('Error comparing dates:', error);
    return false;
  }
};

/**
 * Checks if one date is after another with timezone consideration
 * @param date - Date to compare
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

    if (!isValid(dateObj) || !isValid(compareDateObj)) return false;

    return isAfter(dateObj, compareDateObj);
  } catch (error) {
    console.error('Error comparing dates:', error);
    return false;
  }
};

/**
 * Calculates the absolute number of days between two dates
 * @param startDate - Start date for calculation
 * @param endDate - End date for calculation
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

    if (!isValid(startDateObj) || !isValid(endDateObj)) return 0;

    return Math.abs(differenceInDays(endDateObj, startDateObj));
  } catch (error) {
    console.error('Error calculating days difference:', error);
    return 0;
  }
};

/**
 * Formats a date specifically for chart axis display with memoization
 * @param date - Input date to format
 * @returns Formatted date string for chart display or empty string if invalid
 */
export const formatChartDate = (date: Date | string | null): string => {
  try {
    if (!date) return '';

    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';

    const dateKey = dateObj.toISOString();
    
    if (chartDateCache.has(dateKey)) {
      return chartDateCache.get(dateKey)!;
    }

    const formattedDate = format(dateObj, 'MMM d, yyyy');
    chartDateCache.set(dateKey, formattedDate);

    // Limit cache size to prevent memory leaks
    if (chartDateCache.size > 1000) {
      const firstKey = chartDateCache.keys().next().value;
      chartDateCache.delete(firstKey);
    }

    return formattedDate;
  } catch (error) {
    console.error('Error formatting chart date:', error);
    return '';
  }
};