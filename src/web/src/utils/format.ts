/**
 * Utility functions for formatting various data types with internationalization support.
 * Provides consistent data presentation across the frontend application.
 * @version 1.0.0
 */

import numeral from 'numeral'; // version: 2.0.6
import { JsonValue } from '../types/common';
import { VALIDATION_CONSTANTS } from '../config/constants';

/**
 * Formats a number with specified decimal places and thousands separators
 * @param value - Number or string to format
 * @param format - Numeral.js format string (e.g., '0,0.00')
 * @returns Formatted number string with proper locale support
 */
export const formatNumber = (value: number | string, format: string = '0,0'): string => {
  if (value === null || value === undefined) {
    return '0';
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return '0';
  }

  const formatted = numeral(numValue).format(format);
  return formatted === 'NaN' ? '0' : formatted;
};

/**
 * Formats a file size in bytes to human-readable format
 * @param bytes - File size in bytes
 * @returns Human-readable file size with appropriate unit
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === null || bytes === undefined || bytes < 0) {
    return '0 B';
  }

  if (bytes > VALIDATION_CONSTANTS.MAX_FILE_SIZE) {
    return `>${formatNumber(VALIDATION_CONSTANTS.MAX_FILE_SIZE / 1024 / 1024)} MB`;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${formatNumber(value, '0,0.00')} ${units[unitIndex]}`;
};

/**
 * Truncates text to specified length with proper UTF-8 character handling
 * @param text - Text to truncate
 * @param maxLength - Maximum length of the truncated text
 * @returns Truncated text with ellipsis and preserved UTF-8 characters
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || maxLength <= 0) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  // Preserve word boundaries when possible
  const truncated = text.substring(0, maxLength - 1);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return `${truncated.substring(0, lastSpace)}…`;
  }

  return `${truncated}…`;
};

/**
 * Formats a decimal number as a percentage with locale support
 * @param value - Decimal value to format as percentage
 * @param decimalPlaces - Number of decimal places to display
 * @returns Locale-aware formatted percentage string
 */
export const formatPercentage = (value: number, decimalPlaces: number = 2): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }

  const percentage = value * 100;
  const format = `0,0.${'0'.repeat(decimalPlaces)}`;
  return `${formatNumber(percentage, format)}%`;
};

/**
 * Formats a number as currency with comprehensive locale support
 * @param value - Number to format as currency
 * @param currencyCode - ISO 4217 currency code
 * @param locale - BCP 47 language tag
 * @returns Locale-specific formatted currency string
 */
export const formatCurrency = (
  value: number,
  currencyCode: string = 'USD',
  locale: string = 'en-US'
): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode
    }).format(0);
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch (error) {
    console.error(`Currency formatting error: ${error}`);
    return `${currencyCode} ${formatNumber(value, '0,0.00')}`;
  }
};

/**
 * Formats a JSON value as a pretty-printed string with circular reference handling
 * @param value - JSON value to format
 * @returns Pretty-printed JSON string with proper indentation
 */
export const formatJson = (value: JsonValue): string => {
  if (value === null || value === undefined) {
    return '';
  }

  try {
    const seen = new WeakSet();
    const formatted = JSON.stringify(
      value,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        return value;
      },
      2
    );
    return formatted;
  } catch (error) {
    console.error(`JSON formatting error: ${error}`);
    return String(value);
  }
};