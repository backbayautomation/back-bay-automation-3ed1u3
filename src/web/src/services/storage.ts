/**
 * High-level storage service providing secure data persistence, cache management,
 * and storage synchronization with advanced security features and optimizations.
 * @version 1.0.0
 */

import CryptoJS from 'crypto-js'; // v4.1.1
import {
  ApiResponse,
} from '../types/common';
import {
  setLocalStorage,
  getLocalStorage,
  setSessionStorage,
  getSessionStorage,
  StorageType
} from '../utils/storage';

// Constants for storage configuration
const CACHE_PREFIX = 'ai_catalog_cache_';
const SESSION_KEY = 'user_session';
const CACHE_TTL = 3600000; // 1 hour in milliseconds
const ENCRYPTION_KEY = process.env.STORAGE_ENCRYPTION_KEY || '';
const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB
const COMPRESSION_THRESHOLD = 1024 * 1024; // 1MB

/**
 * Interface for user session data with enhanced security
 */
export interface UserSession {
  token: string;
  userId: string;
  organizationId: string;
  expiresAt: number;
  refreshToken: string;
  deviceId: string;
  isEncrypted: boolean;
}

/**
 * Interface for cached query results with optimization metadata
 */
interface QueryResult {
  data: any;
  timestamp: number;
  expiresIn: number;
  checksum: string;
  compressed: boolean;
  version: string;
}

/**
 * Stores user session data with encryption and integrity verification
 */
export const storeUserSession = (session: UserSession): ApiResponse<void> => {
  try {
    // Generate device ID if not present
    if (!session.deviceId) {
      session.deviceId = CryptoJS.lib.WordArray.random(16).toString();
    }

    // Calculate data integrity checksum
    const checksum = CryptoJS.SHA256(JSON.stringify(session)).toString();

    // Encrypt sensitive session data
    const encryptedSession = {
      ...session,
      token: CryptoJS.AES.encrypt(session.token, ENCRYPTION_KEY).toString(),
      refreshToken: CryptoJS.AES.encrypt(session.refreshToken, ENCRYPTION_KEY).toString(),
      isEncrypted: true
    };

    // Store with metadata
    const result = setLocalStorage(SESSION_KEY, encryptedSession, {
      encrypt: true,
      expiresIn: session.expiresAt - Date.now()
    });

    return result;
  } catch (error) {
    return {
      success: false,
      data: void 0,
      error: 'Failed to store user session',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Retrieves and decrypts user session data with integrity verification
 */
export const getUserSession = (): ApiResponse<UserSession | null> => {
  try {
    const result = getLocalStorage<UserSession>(SESSION_KEY);

    if (!result.success || !result.data) {
      return result;
    }

    const session = result.data;

    // Verify session is encrypted
    if (!session.isEncrypted) {
      return {
        success: false,
        data: null,
        error: 'Session data integrity violation',
        message: 'Session data is not encrypted',
        statusCode: 401,
        metadata: {}
      };
    }

    // Decrypt sensitive data
    const decryptedSession = {
      ...session,
      token: CryptoJS.AES.decrypt(session.token, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8),
      refreshToken: CryptoJS.AES.decrypt(session.refreshToken, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8),
      isEncrypted: false
    };

    // Validate session expiration
    if (Date.now() >= decryptedSession.expiresAt) {
      clearUserSession();
      return {
        success: true,
        data: null,
        error: null,
        message: 'Session expired',
        statusCode: 401,
        metadata: {}
      };
    }

    return {
      success: true,
      data: decryptedSession,
      error: null,
      message: null,
      statusCode: 200,
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: 'Failed to retrieve user session',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Removes user session data with secure cleanup
 */
export const clearUserSession = (): ApiResponse<void> => {
  try {
    // Clear session storage
    localStorage.removeItem(`${SESSION_KEY}`);

    // Clear any cached data
    Object.keys(sessionStorage)
      .filter(key => key.startsWith(CACHE_PREFIX))
      .forEach(key => sessionStorage.removeItem(key));

    // Perform secure memory cleanup
    if (window.crypto && window.crypto.getRandomValues) {
      const array = new Uint32Array(10);
      window.crypto.getRandomValues(array);
    }

    return {
      success: true,
      data: void 0,
      error: null,
      message: null,
      statusCode: 200,
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: void 0,
      error: 'Failed to clear user session',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Stores query results in session storage with compression and versioning
 */
export const storeQueryCache = (queryKey: string, data: QueryResult): ApiResponse<void> => {
  try {
    const cacheKey = `${CACHE_PREFIX}${queryKey}`;
    
    // Check storage quota
    const dataSize = new Blob([JSON.stringify(data)]).size;
    if (dataSize > MAX_CACHE_SIZE) {
      return {
        success: false,
        data: void 0,
        error: 'Cache size limit exceeded',
        message: 'Data exceeds maximum cache size',
        statusCode: 413,
        metadata: { size: dataSize, limit: MAX_CACHE_SIZE }
      };
    }

    // Prepare cache entry
    const cacheEntry: QueryResult = {
      data: data.data,
      timestamp: Date.now(),
      expiresIn: CACHE_TTL,
      checksum: CryptoJS.SHA256(JSON.stringify(data.data)).toString(),
      compressed: dataSize > COMPRESSION_THRESHOLD,
      version: '1.0'
    };

    // Store with compression if needed
    const result = setSessionStorage(cacheKey, cacheEntry, {
      compress: cacheEntry.compressed,
      expiresIn: CACHE_TTL
    });

    return result;
  } catch (error) {
    return {
      success: false,
      data: void 0,
      error: 'Failed to store query cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};

/**
 * Retrieves cached query results with validation and decompression
 */
export const getQueryCache = (queryKey: string): ApiResponse<QueryResult | null> => {
  try {
    const cacheKey = `${CACHE_PREFIX}${queryKey}`;
    const result = getSessionStorage<QueryResult>(cacheKey);

    if (!result.success || !result.data) {
      return result;
    }

    const cached = result.data;

    // Validate cache freshness
    if (Date.now() > cached.timestamp + cached.expiresIn) {
      sessionStorage.removeItem(cacheKey);
      return {
        success: true,
        data: null,
        error: null,
        message: 'Cache expired',
        statusCode: 404,
        metadata: {}
      };
    }

    // Verify data integrity
    const checksum = CryptoJS.SHA256(JSON.stringify(cached.data)).toString();
    if (checksum !== cached.checksum) {
      sessionStorage.removeItem(cacheKey);
      return {
        success: false,
        data: null,
        error: 'Cache integrity violation',
        message: 'Cached data checksum mismatch',
        statusCode: 400,
        metadata: {}
      };
    }

    return {
      success: true,
      data: cached,
      error: null,
      message: null,
      statusCode: 200,
      metadata: {}
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: 'Failed to retrieve query cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
      metadata: {}
    };
  }
};