/**
 * API service module for handling natural language queries and chat interactions.
 * Implements enterprise-grade search capabilities with comprehensive error handling.
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
    clientId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Interface for document reference in search results
 */
export interface Document {
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
    metadata: {
        processingTime: number;
        modelVersion: string;
        sourceCount: number;
    };
}

/**
 * Interface for chat query requests
 */
export interface ChatQuery {
    message: string;
    sessionId: string;
    context?: Message[];
    metadata?: Record<string, unknown>;
}

/**
 * Cache implementation for search results
 */
const searchCache = new Map<string, { result: SearchResult; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Submits a natural language query to search through product catalogs
 * @param query Search query parameters
 * @returns Promise resolving to search results with relevant documents
 */
export async function submitQuery(
    query: SearchQuery
): Promise<ApiResponse<SearchResult>> {
    try {
        // Input validation
        if (!query.query.trim()) {
            throw new Error('Search query cannot be empty');
        }

        // Check cache for recent identical queries
        const cacheKey = JSON.stringify(query);
        const cached = searchCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return {
                data: cached.result,
                success: true,
                message: 'Results retrieved from cache',
                statusCode: 200,
                metadata: { cached: true }
            };
        }

        // Create API client with enhanced configuration
        const apiClient = createApiClient();

        // Execute search request with timeout and retry logic
        const response = await apiClient.post<ApiResponse<SearchResult>>(
            API_ENDPOINTS.QUERIES.SEARCH,
            {
                ...query,
                timestamp: new Date().toISOString()
            },
            {
                timeout: 30000,
                validateStatus: (status) => status === 200
            }
        );

        // Cache successful results
        if (response.data.success) {
            searchCache.set(cacheKey, {
                result: response.data.data,
                timestamp: Date.now()
            });
        }

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(
                `Search query failed: ${error.response?.data?.message || error.message}`
            );
        }
        throw error;
    }
}

/**
 * Sends a chat message and receives AI-generated response
 * @param query Chat query parameters
 * @returns Promise resolving to AI assistant's response
 */
export async function sendChatMessage(
    query: ChatQuery
): Promise<ApiResponse<Message>> {
    try {
        // Input validation
        if (!query.message.trim() || !query.sessionId) {
            throw new Error('Invalid chat message or session ID');
        }

        // Create API client with WebSocket support
        const apiClient = createApiClient();

        // Send chat message with context
        const response = await apiClient.post<ApiResponse<Message>>(
            API_ENDPOINTS.QUERIES.CHAT,
            {
                ...query,
                timestamp: new Date().toISOString()
            },
            {
                timeout: 45000, // Extended timeout for complex responses
                headers: {
                    'X-Session-ID': query.sessionId
                }
            }
        );

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(
                `Chat message failed: ${error.response?.data?.message || error.message}`
            );
        }
        throw error;
    }
}

/**
 * Retrieves paginated chat history for a specific session
 * @param sessionId Unique identifier for the chat session
 * @returns Promise resolving to list of chat messages
 */
export async function getChatHistory(
    sessionId: string
): Promise<ApiResponse<Message[]>> {
    try {
        // Input validation
        if (!sessionId) {
            throw new Error('Session ID is required');
        }

        // Create API client
        const apiClient = createApiClient();

        // Retrieve chat history with pagination
        const response = await apiClient.get<ApiResponse<Message[]>>(
            `${API_ENDPOINTS.QUERIES.HISTORY}/${sessionId}`,
            {
                params: {
                    limit: 50,
                    order: 'desc'
                },
                headers: {
                    'X-Session-ID': sessionId
                }
            }
        );

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(
                `Failed to retrieve chat history: ${
                    error.response?.data?.message || error.message
                }`
            );
        }
        throw error;
    }
}