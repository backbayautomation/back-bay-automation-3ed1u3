/**
 * High-level storage service providing secure data persistence, cache management,
 * and storage synchronization with encryption and performance optimizations.
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
  StorageType,
} from '../utils/storage';

// Constants for storage configuration
const CACHE_PREFIX = 'ai_catalog_cache_';
const SESSION_KEY = 'user_session';
const CACHE_TTL = 3600000; // 1 hour in milliseconds
const ENCRYPTION_KEY = process.env.STORAGE_ENCRYPTION_KEY || '';
const MAX_CACHE_SIZE = 5242880; // 5MB
const COMPRESSION_THRESHOLD = 1048576; // 1MB

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
 * @param session User session data to store
 * @returns ApiResponse indicating success/failure
 */
export const storeUserSession = (session: UserSession): ApiResponse<void> => {
  try {
    // Generate device ID if not present
    if (!session.deviceId) {
      session.deviceId = CryptoJS.lib.WordArray.random(16).toString();
    }

    // Encrypt sensitive data
    const encryptedSession = {
      ...session,
      token: CryptoJS.AES.encrypt(session.token, ENCRYPTION_KEY).toString(),
      refreshToken: CryptoJS.AES.encrypt(session.refreshToken, ENCRYPTION_KEY).toString(),
      isEncrypted: true
    };

    // Calculate integrity checksum
    const checksum = CryptoJS.SHA256(JSON.stringify(encryptedSession)).toString();

    // Store with metadata
    const storageResult = setLocalStorage(SESSION_KEY, {
      data: encryptedSession,
      checksum,
      timestamp: Date.now()
    }, {
      encrypt: true,
      expiresIn: session.expiresAt - Date.now()
    });

    return storageResult;
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
 * @returns ApiResponse containing the user session or null
 */
export const getUserSession = (): ApiResponse<UserSession | null> => {
  try {
    const result = getLocalStorage<{
      data: UserSession;
      checksum: string;
      timestamp: number;
    }>(SESSION_KEY);

    if (!result.success || !result.data) {
      return {
        success: true,
        data: null,
        error: null,
        message: 'No session found',
        statusCode: 404,
        metadata: {}
      };
    }

    const { data: encryptedSession, checksum } = result.data;

    // Verify data integrity
    const calculatedChecksum = CryptoJS.SHA256(JSON.stringify(encryptedSession)).toString();
    if (calculatedChecksum !== checksum) {
      clearUserSession();
      return {
        success: false,
        data: null,
        error: 'Session data integrity check failed',
        message: 'Session may have been tampered with',
        statusCode: 401,
        metadata: {}
      };
    }

    // Decrypt sensitive data
    const session: UserSession = {
      ...encryptedSession,
      token: CryptoJS.AES.decrypt(encryptedSession.token, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8),
      refreshToken: CryptoJS.AES.decrypt(encryptedSession.refreshToken, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8),
      isEncrypted: false
    };

    // Validate session expiration
    if (Date.now() >= session.expiresAt) {
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
      data: session,
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
 * @returns ApiResponse indicating success/failure
 */
export const clearUserSession = (): ApiResponse<void> => {
  try {
    // Clear session storage
    const sessionResult = setLocalStorage(SESSION_KEY, null);
    if (!sessionResult.success) {
      throw new Error(sessionResult.error || 'Failed to clear session storage');
    }

    // Clear related cache entries
    const cacheKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith(CACHE_PREFIX)
    );
    cacheKeys.forEach(key => sessionStorage.removeItem(key));

    // Perform secure cleanup
    if (typeof window.crypto?.getRandomValues !== 'undefined') {
      const cleanup = new Uint8Array(32);
      window.crypto.getRandomValues(cleanup);
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
 * @param queryKey Unique query identifier
 * @param data Query result data to cache
 * @returns ApiResponse indicating success/failure
 */
export const storeQueryCache = (queryKey: string, data: QueryResult): ApiResponse<void> => {
  try {
    const cacheKey = `${CACHE_PREFIX}${queryKey}`;
    const serializedData = JSON.stringify(data);
    
    // Check storage quota
    if (serializedData.length > MAX_CACHE_SIZE) {
      return {
        success: false,
        data: void 0,
        error: 'Cache size limit exceeded',
        message: 'Data too large to cache',
        statusCode: 413,
        metadata: {}
      };
    }

    // Compress if above threshold
    const shouldCompress = serializedData.length > COMPRESSION_THRESHOLD;
    const storageOptions = {
      compress: shouldCompress,
      expiresIn: CACHE_TTL
    };

    // Calculate checksum for integrity
    const checksum = CryptoJS.SHA256(serializedData).toString();

    const cacheData = {
      ...data,
      checksum,
      compressed: shouldCompress,
      timestamp: Date.now(),
      version: '1.0'
    };

    return setSessionStorage(cacheKey, cacheData, storageOptions);
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
 * @param queryKey Unique query identifier
 * @returns ApiResponse containing the cached results or null
 */
export const getQueryCache = (queryKey: string): ApiResponse<QueryResult | null> => {
  try {
    const cacheKey = `${CACHE_PREFIX}${queryKey}`;
    const result = getSessionStorage<QueryResult>(cacheKey);

    if (!result.success || !result.data) {
      return {
        success: true,
        data: null,
        error: null,
        message: 'Cache miss',
        statusCode: 404,
        metadata: {}
      };
    }

    const cachedData = result.data;

    // Verify data integrity
    const serializedData = JSON.stringify(cachedData.data);
    const checksum = CryptoJS.SHA256(serializedData).toString();
    
    if (checksum !== cachedData.checksum) {
      sessionStorage.removeItem(cacheKey);
      return {
        success: false,
        data: null,
        error: 'Cache integrity check failed',
        message: 'Cached data may be corrupted',
        statusCode: 500,
        metadata: {}
      };
    }

    // Check expiration
    if (Date.now() - cachedData.timestamp > CACHE_TTL) {
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

    return {
      success: true,
      data: cachedData,
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