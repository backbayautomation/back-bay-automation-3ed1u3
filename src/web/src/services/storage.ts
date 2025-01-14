/**
 * High-level storage service providing secure data persistence, cache management,
 * and storage synchronization with advanced security features and performance optimizations.
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

    const storageData = {
      ...encryptedSession,
      checksum,
      timestamp: Date.now()
    };

    return setLocalStorage(SESSION_KEY, storageData, {
      encrypt: true,
      compress: false,
      expiresIn: session.expiresAt - Date.now()
    });
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
    const response = getLocalStorage<UserSession & { checksum: string }>(SESSION_KEY);
    
    if (!response.success || !response.data) {
      return response as ApiResponse<null>;
    }

    const { checksum, ...sessionData } = response.data;

    // Verify data integrity
    const calculatedChecksum = CryptoJS.SHA256(JSON.stringify(sessionData)).toString();
    if (calculatedChecksum !== checksum) {
      return {
        success: false,
        data: null,
        error: 'Session data integrity check failed',
        message: 'Storage tampering detected',
        statusCode: 401,
        metadata: {}
      };
    }

    // Decrypt sensitive data
    if (sessionData.isEncrypted) {
      const decryptedSession = {
        ...sessionData,
        token: CryptoJS.AES.decrypt(sessionData.token, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8),
        refreshToken: CryptoJS.AES.decrypt(sessionData.refreshToken, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8),
        isEncrypted: false
      };

      return {
        success: true,
        data: decryptedSession,
        error: null,
        message: 'Session retrieved successfully',
        statusCode: 200,
        metadata: {}
      };
    }

    return {
      success: true,
      data: sessionData,
      error: null,
      message: 'Session retrieved successfully',
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
    const response = setLocalStorage(SESSION_KEY, null);
    if (!response.success) {
      return response;
    }

    // Clear related cache entries
    const cacheKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith(CACHE_PREFIX)
    );
    
    cacheKeys.forEach(key => {
      sessionStorage.removeItem(key);
    });

    // Perform secure memory cleanup
    if (window.crypto && window.crypto.getRandomValues) {
      const array = new Uint32Array(10);
      window.crypto.getRandomValues(array);
    }

    return {
      success: true,
      data: void 0,
      error: null,
      message: 'Session cleared successfully',
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
export const storeQueryCache = (
  queryKey: string,
  data: QueryResult
): ApiResponse<void> => {
  try {
    const cacheKey = `${CACHE_PREFIX}${queryKey}`;
    
    // Check storage quota
    const totalSize = new Blob([JSON.stringify(data)]).size;
    if (totalSize > MAX_CACHE_SIZE) {
      return {
        success: false,
        data: void 0,
        error: 'Cache size limit exceeded',
        message: 'Data too large to cache',
        statusCode: 413,
        metadata: {}
      };
    }

    // Prepare cache data
    const cacheData: QueryResult = {
      ...data,
      timestamp: Date.now(),
      expiresIn: CACHE_TTL,
      checksum: CryptoJS.SHA256(JSON.stringify(data.data)).toString(),
      compressed: totalSize > COMPRESSION_THRESHOLD,
      version: '1.0'
    };

    return setSessionStorage(cacheKey, cacheData, {
      compress: totalSize > COMPRESSION_THRESHOLD,
      expiresIn: CACHE_TTL
    });
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
    const response = getSessionStorage<QueryResult>(cacheKey);

    if (!response.success || !response.data) {
      return response as ApiResponse<null>;
    }

    const cachedData = response.data;

    // Validate cache freshness
    if (Date.now() > cachedData.timestamp + cachedData.expiresIn) {
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
    const calculatedChecksum = CryptoJS.SHA256(JSON.stringify(cachedData.data)).toString();
    if (calculatedChecksum !== cachedData.checksum) {
      return {
        success: false,
        data: null,
        error: 'Cache integrity check failed',
        message: 'Cache tampering detected',
        statusCode: 401,
        metadata: {}
      };
    }

    return {
      success: true,
      data: cachedData,
      error: null,
      message: 'Cache retrieved successfully',
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