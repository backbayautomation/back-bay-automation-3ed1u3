/**
 * Advanced browser storage utility module with encryption, compression, and type safety.
 * Provides secure storage operations with quota management and multi-tenant support.
 * @version 1.0.0
 */

import CryptoJS from 'crypto-js'; // v4.1.1
import * as pako from 'pako'; // v2.1.0
import { ApiResponse } from '../types/common';

// Global constants
const STORAGE_PREFIX = 'ai_catalog_';
const STORAGE_VERSION = 'v1';
const ENCRYPTION_KEY = process.env.VITE_STORAGE_ENCRYPTION_KEY || '';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Storage type enumeration for type-safe storage selection
 */
export enum StorageType {
  LOCAL = 'localStorage',
  SESSION = 'sessionStorage'
}

/**
 * Configuration options for storage operations
 */
export interface StorageOptions {
  encrypt?: boolean;
  compress?: boolean;
  expiresIn?: number; // Milliseconds
}

/**
 * Metadata structure for stored items
 */
interface StorageMetadata {
  version: string;
  timestamp: number;
  expiresAt: number;
  encrypted: boolean;
  compressed: boolean;
}

/**
 * Storage quota information
 */
interface StorageQuota {
  used: number;
  available: number;
  percentage: number;
}

/**
 * Storage item wrapper
 */
interface StorageItem<T> {
  data: string;
  metadata: StorageMetadata;
}

/**
 * Validates storage availability and quota
 */
const validateStorage = (type: StorageType): ApiResponse<void> => {
  try {
    const storage = window[type];
    const testKey = `${STORAGE_PREFIX}test`;
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return { success: true, data: void 0, error: null, message: null, statusCode: 200, metadata: {} };
  } catch (error) {
    return {
      success: false,
      data: void 0,
      error: 'Storage not available',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Encrypts data using AES encryption
 */
const encryptData = (data: string): string => {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

/**
 * Decrypts AES encrypted data
 */
const decryptData = (encrypted: string): string => {
  const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Compresses data using pako
 */
const compressData = (data: string): string => {
  const compressed = pako.deflate(data);
  return Buffer.from(compressed).toString('base64');
};

/**
 * Decompresses pako compressed data
 */
const decompressData = (compressed: string): string => {
  const data = Buffer.from(compressed, 'base64');
  const decompressed = pako.inflate(data);
  return Buffer.from(decompressed).toString();
};

/**
 * Sets data in localStorage with encryption and compression support
 */
export const setLocalStorage = <T>(
  key: string,
  value: T,
  options: StorageOptions = {}
): ApiResponse<void> => {
  const validation = validateStorage(StorageType.LOCAL);
  if (!validation.success) return validation;

  try {
    const metadata: StorageMetadata = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      expiresAt: Date.now() + (options.expiresIn || DEFAULT_EXPIRATION),
      encrypted: !!options.encrypt,
      compressed: !!options.compress
    };

    let serializedData = JSON.stringify(value);

    if (options.compress) {
      serializedData = compressData(serializedData);
    }

    if (options.encrypt) {
      serializedData = encryptData(serializedData);
    }

    const storageItem: StorageItem<T> = {
      data: serializedData,
      metadata
    };

    const storageKey = `${STORAGE_PREFIX}${key}`;
    localStorage.setItem(storageKey, JSON.stringify(storageItem));

    return {
      success: true,
      data: void 0,
      error: null,
      message: 'Data stored successfully',
      statusCode: 200,
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: void 0,
      error: 'Failed to store data',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Retrieves data from localStorage with automatic decryption and decompression
 */
export const getLocalStorage = <T>(key: string): ApiResponse<T | null> => {
  try {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    const rawItem = localStorage.getItem(storageKey);

    if (!rawItem) {
      return {
        success: true,
        data: null,
        error: null,
        message: 'Item not found',
        statusCode: 404,
        metadata: {}
      };
    }

    const storageItem: StorageItem<T> = JSON.parse(rawItem);
    const { data, metadata } = storageItem;

    if (metadata.expiresAt < Date.now()) {
      localStorage.removeItem(storageKey);
      return {
        success: true,
        data: null,
        error: null,
        message: 'Item expired',
        statusCode: 404,
        metadata: {}
      };
    }

    let processedData = data;

    if (metadata.encrypted) {
      processedData = decryptData(processedData);
    }

    if (metadata.compressed) {
      processedData = decompressData(processedData);
    }

    return {
      success: true,
      data: JSON.parse(processedData) as T,
      error: null,
      message: 'Data retrieved successfully',
      statusCode: 200,
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: 'Failed to retrieve data',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Sets data in sessionStorage with encryption and compression support
 */
export const setSessionStorage = <T>(
  key: string,
  value: T,
  options: StorageOptions = {}
): ApiResponse<void> => {
  const validation = validateStorage(StorageType.SESSION);
  if (!validation.success) return validation;

  try {
    const metadata: StorageMetadata = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      expiresAt: Date.now() + (options.expiresIn || DEFAULT_EXPIRATION),
      encrypted: !!options.encrypt,
      compressed: !!options.compress
    };

    let serializedData = JSON.stringify(value);

    if (options.compress) {
      serializedData = compressData(serializedData);
    }

    if (options.encrypt) {
      serializedData = encryptData(serializedData);
    }

    const storageItem: StorageItem<T> = {
      data: serializedData,
      metadata
    };

    const storageKey = `${STORAGE_PREFIX}${key}`;
    sessionStorage.setItem(storageKey, JSON.stringify(storageItem));

    return {
      success: true,
      data: void 0,
      error: null,
      message: 'Data stored successfully',
      statusCode: 200,
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: void 0,
      error: 'Failed to store data',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Monitors storage quota usage and triggers cleanup if needed
 */
export const monitorStorageQuota = (type: StorageType): ApiResponse<StorageQuota> => {
  try {
    const storage = window[type];
    let totalSize = 0;

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const value = storage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
    }

    const quota: StorageQuota = {
      used: totalSize,
      available: MAX_STORAGE_SIZE - totalSize,
      percentage: (totalSize / MAX_STORAGE_SIZE) * 100
    };

    if (quota.percentage > 90) {
      cleanExpiredItems(type);
    }

    return {
      success: true,
      data: quota,
      error: null,
      message: 'Storage quota calculated',
      statusCode: 200,
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: { used: 0, available: 0, percentage: 0 },
      error: 'Failed to calculate storage quota',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Removes expired items from storage
 */
export const cleanExpiredItems = (type: StorageType): ApiResponse<number> => {
  try {
    const storage = window[type];
    let cleanedCount = 0;
    const now = Date.now();

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const rawItem = storage.getItem(key);
        if (rawItem) {
          const storageItem: StorageItem<unknown> = JSON.parse(rawItem);
          if (storageItem.metadata.expiresAt < now) {
            storage.removeItem(key);
            cleanedCount++;
          }
        }
      }
    }

    return {
      success: true,
      data: cleanedCount,
      error: null,
      message: `Cleaned ${cleanedCount} expired items`,
      statusCode: 200,
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: 0,
      error: 'Failed to clean expired items',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};