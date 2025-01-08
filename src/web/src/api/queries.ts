/**
 * API service module for handling natural language queries and chat interactions
 * with the AI-powered catalog search system.
 * @version 1.0.0
 */

// External imports
import axios from 'axios'; // v1.5.0

// Internal imports
import { ApiResponse } from './types';
import { Message, ChatSession } from '../types/chat';
import { API_ENDPOINTS, createApiClient } from '../config/api';

/**
 * Interface for search query requests
 */
export interface SearchQuery {
  query: string;
  limit?: number;
  threshold?: number;
}

/**
 * Interface for document reference in search results
 */
interface Document {
  id: string;
  title: string;
  relevance: number;
  excerpt: string;
  metadata: Record<string, unknown>;
}

/**
 * Interface for search query responses
 */
export interface SearchResult {
  answer: string;
  relevantDocuments: Document[];
  confidence: number;
}

/**
 * Interface for chat query requests
 */
export interface ChatQuery {
  message: string;
  sessionId: string;
  context?: Message[];
}

/**
 * Cache configuration for query responses
 */
const CACHE_CONFIG = {
  TTL: 3600000, // 1 hour
  MAX_SIZE: 1000
} as const;

/**
 * Query validation configuration
 */
const QUERY_VALIDATION = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 1000,
  THRESHOLD_RANGE: { MIN: 0, MAX: 1 }
} as const;

/**
 * Submits a natural language query to search through product catalogs
 * @param query - Search query parameters
 * @returns Promise resolving to search results with relevant documents
 */
export async function submitQuery(
  query: SearchQuery
): Promise<ApiResponse<SearchResult>> {
  // Validate query parameters
  if (!query.query || 
      query.query.length < QUERY_VALIDATION.MIN_LENGTH || 
      query.query.length > QUERY_VALIDATION.MAX_LENGTH) {
    throw new Error('Invalid query length');
  }

  if (query.threshold !== undefined && 
      (query.threshold < QUERY_VALIDATION.THRESHOLD_RANGE.MIN || 
       query.threshold > QUERY_VALIDATION.THRESHOLD_RANGE.MAX)) {
    throw new Error('Invalid threshold value');
  }

  // Create API client with configuration
  const apiClient = createApiClient();

  try {
    const response = await apiClient.post<ApiResponse<SearchResult>>(
      API_ENDPOINTS.QUERIES.SEARCH,
      {
        query: query.query,
        limit: query.limit || 10,
        threshold: query.threshold || 0.7
      },
      {
        headers: {
          'X-Request-Type': 'Search',
          'X-Query-ID': crypto.randomUUID()
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(error.response?.data?.message || 'Search query failed');
    }
    throw error;
  }
}

/**
 * Sends a chat message and receives AI-generated response
 * @param query - Chat query parameters
 * @returns Promise resolving to AI assistant's response message
 */
export async function sendChatMessage(
  query: ChatQuery
): Promise<ApiResponse<Message>> {
  // Validate chat message
  if (!query.message || 
      query.message.length < QUERY_VALIDATION.MIN_LENGTH || 
      query.message.length > QUERY_VALIDATION.MAX_LENGTH) {
    throw new Error('Invalid message length');
  }

  if (!query.sessionId) {
    throw new Error('Session ID is required');
  }

  // Create API client
  const apiClient = createApiClient();

  try {
    const response = await apiClient.post<ApiResponse<Message>>(
      API_ENDPOINTS.QUERIES.CHAT,
      {
        message: query.message,
        sessionId: query.sessionId,
        context: query.context || []
      },
      {
        headers: {
          'X-Request-Type': 'Chat',
          'X-Session-ID': query.sessionId,
          'X-Message-ID': crypto.randomUUID()
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Session expired. Please login again.');
      }
      throw new Error(error.response?.data?.message || 'Chat message failed');
    }
    throw error;
  }
}

/**
 * Retrieves paginated chat history for a specific session
 * @param sessionId - Chat session identifier
 * @returns Promise resolving to list of chat messages
 */
export async function getChatHistory(
  sessionId: string
): Promise<ApiResponse<Message[]>> {
  if (!sessionId) {
    throw new Error('Session ID is required');
  }

  const apiClient = createApiClient();

  try {
    const response = await apiClient.get<ApiResponse<Message[]>>(
      `${API_ENDPOINTS.QUERIES.HISTORY}/${sessionId}`,
      {
        headers: {
          'X-Request-Type': 'History',
          'X-Session-ID': sessionId
        },
        params: {
          limit: 100,
          order: 'desc'
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error('Chat session not found');
      }
      throw new Error(error.response?.data?.message || 'Failed to retrieve chat history');
    }
    throw error;
  }
}