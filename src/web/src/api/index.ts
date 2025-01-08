/**
 * Main entry point for the frontend API layer that exports all API-related functionality
 * with enhanced error handling, circuit breaker pattern, request monitoring, and 
 * comprehensive security features.
 * @version 1.0.0
 */

// External dependencies
import axios from 'axios'; // v1.5.0

// Internal imports - Authentication
import * as auth from './auth';

// Internal imports - Client management
import * as clients from './clients';

// Internal imports - Document management
import * as documents from './documents';

// Type imports
import { ApiResponse, ApiError, ApiRequestConfig } from './types';
import { AuthTokens, UserProfile } from '../types/auth';
import { Client } from '../types/client';
import { Document, DocumentUploadRequest, ProcessingStatus } from '../types/document';

/**
 * Re-export authentication-related functionality
 */
export const authentication = {
  login: auth.login,
  logout: auth.logout,
  refreshToken: auth.refreshToken,
  getCurrentUser: auth.getCurrentUser
} as const;

/**
 * Re-export client management functionality
 */
export const clientManagement = {
  getClients: clients.getClients,
  getClientById: clients.getClientById,
  createClient: clients.createClient,
  updateClient: clients.updateClient,
  deleteClient: clients.deleteClient
} as const;

/**
 * Re-export document management functionality
 */
export const documentManagement = {
  uploadDocument: documents.documentApi.uploadDocument.bind(documents.documentApi),
  getDocuments: documents.documentApi.getDocuments.bind(documents.documentApi),
  getDocumentById: documents.documentApi.getProcessingStatus.bind(documents.documentApi),
  deleteDocument: documents.documentApi.deleteDocument.bind(documents.documentApi),
  processDocument: documents.documentApi.getProcessingStatus.bind(documents.documentApi)
} as const;

/**
 * Export type definitions for API consumers
 */
export type {
  // Authentication types
  AuthTokens,
  UserProfile,
  
  // Client types
  Client,
  
  // Document types
  Document,
  DocumentUploadRequest,
  ProcessingStatus,
  
  // API common types
  ApiResponse,
  ApiError,
  ApiRequestConfig
};

/**
 * Export API instance for direct access if needed
 * Note: Prefer using the exported functions instead of direct API access
 */
export { default as apiInstance } from '../utils/api';

/**
 * Export API configuration constants
 */
export { API_CONFIG, API_ENDPOINTS } from '../config/api';

/**
 * Default export for convenient importing
 */
export default {
  auth: authentication,
  clients: clientManagement,
  documents: documentManagement
};