/**
 * Advanced browser storage utility module providing secure, type-safe storage operations
 * with encryption, compression, and comprehensive error handling.
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
  expiresIn?: number; // Expiration time in milliseconds
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
 * Storage item wrapper containing data and metadata
 */
interface StorageItem<T> {
  data: T;
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
  return new TextDecoder().decode(decompressed);
};

/**
 * Sets data in localStorage with encryption, compression, and expiration
 */
export const setLocalStorage = <T>(
  key: string,
  value: T,
  options: StorageOptions = {}
): ApiResponse<void> => {
  const validation = validateStorage(StorageType.LOCAL);
  if (!validation.success) return validation;

  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    let serializedData = JSON.stringify(value);

    const metadata: StorageMetadata = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      expiresAt: Date.now() + (options.expiresIn || DEFAULT_EXPIRATION),
      encrypted: options.encrypt || false,
      compressed: options.compress || false
    };

    if (options.compress) {
      serializedData = compressData(serializedData);
    }

    if (options.encrypt) {
      serializedData = encryptData(serializedData);
    }

    const storageItem: StorageItem<string> = {
      data: serializedData,
      metadata
    };

    localStorage.setItem(prefixedKey, JSON.stringify(storageItem));

    return { success: true, data: void 0, error: null, message: null, statusCode: 200, metadata: {} };
  } catch (error) {
    return {
      success: false,
      data: void 0,
      error: 'Storage operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Retrieves and processes data from localStorage
 */
export const getLocalStorage = <T>(key: string): ApiResponse<T | null> => {
  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    const rawItem = localStorage.getItem(prefixedKey);

    if (!rawItem) {
      return { success: true, data: null, error: null, message: 'Item not found', statusCode: 404, metadata: {} };
    }

    const storageItem: StorageItem<string> = JSON.parse(rawItem);
    const { data, metadata } = storageItem;

    if (Date.now() > metadata.expiresAt) {
      localStorage.removeItem(prefixedKey);
      return { success: true, data: null, error: null, message: 'Item expired', statusCode: 404, metadata: {} };
    }

    let processedData = data;

    if (metadata.encrypted) {
      processedData = decryptData(processedData);
    }

    if (metadata.compressed) {
      processedData = decompressData(processedData);
    }

    const parsedData = JSON.parse(processedData) as T;

    return { success: true, data: parsedData, error: null, message: null, statusCode: 200, metadata };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: 'Failed to retrieve storage item',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Sets data in sessionStorage with encryption and compression
 */
export const setSessionStorage = <T>(
  key: string,
  value: T,
  options: StorageOptions = {}
): ApiResponse<void> => {
  const validation = validateStorage(StorageType.SESSION);
  if (!validation.success) return validation;

  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    let serializedData = JSON.stringify(value);

    const metadata: StorageMetadata = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      expiresAt: Date.now() + (options.expiresIn || DEFAULT_EXPIRATION),
      encrypted: options.encrypt || false,
      compressed: options.compress || false
    };

    if (options.compress) {
      serializedData = compressData(serializedData);
    }

    if (options.encrypt) {
      serializedData = encryptData(serializedData);
    }

    const storageItem: StorageItem<string> = {
      data: serializedData,
      metadata
    };

    sessionStorage.setItem(prefixedKey, JSON.stringify(storageItem));

    return { success: true, data: void 0, error: null, message: null, statusCode: 200, metadata: {} };
  } catch (error) {
    return {
      success: false,
      data: void 0,
      error: 'Session storage operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Monitors storage quota and triggers cleanup if needed
 */
export const monitorStorageQuota = (type: StorageType): ApiResponse<StorageQuota> => {
  try {
    const storage = window[type];
    let totalSize = 0;

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        totalSize += storage.getItem(key)?.length || 0;
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

    return { success: true, data: quota, error: null, message: null, statusCode: 200, metadata: {} };
  } catch (error) {
    return {
      success: false,
      data: { used: 0, available: 0, percentage: 0 },
      error: 'Failed to monitor storage quota',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Removes expired items from storage
 */
const cleanExpiredItems = (type: StorageType): ApiResponse<number> => {
  try {
    const storage = window[type];
    let cleanedCount = 0;

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const rawItem = storage.getItem(key);
        if (rawItem) {
          const storageItem: StorageItem<string> = JSON.parse(rawItem);
          if (Date.now() > storageItem.metadata.expiresAt) {
            storage.removeItem(key);
            cleanedCount++;
          }
        }
      }
    }

    return { success: true, data: cleanedCount, error: null, message: null, statusCode: 200, metadata: {} };
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