/**
 * API service module for handling natural language queries and chat interactions
 * with the AI-powered catalog search system.
 * @version 1.0.0
 */

import axios from 'axios'; // v1.5.0
import { ApiResponse } from './types';
import { Message, ChatSession } from '../types/chat';
import { API_ENDPOINTS, createApiClient } from '../config/api';
import { UUID } from '../types/common';

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
    id: UUID;
    title: string;
    relevance: number;
    excerpt: string;
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
    sessionId: UUID;
    context?: Message[];
}

/**
 * Cache configuration for search results
 */
const CACHE_CONFIG = {
    TTL: 3600000, // 1 hour
    MAX_SIZE: 1000
} as const;

/**
 * Local cache for search results
 */
const searchCache = new Map<string, { result: SearchResult; timestamp: number }>();

/**
 * Submits a natural language query to search through product catalogs
 * @param query - Search query parameters
 * @returns Promise resolving to search results with relevant documents
 */
export async function submitQuery(
    query: SearchQuery
): Promise<ApiResponse<SearchResult>> {
    // Input validation
    if (!query.query.trim()) {
        throw new Error('Search query cannot be empty');
    }

    // Check cache for existing results
    const cacheKey = JSON.stringify(query);
    const cachedResult = searchCache.get(cacheKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_CONFIG.TTL) {
        return {
            data: cachedResult.result,
            success: true
        };
    }

    try {
        const apiClient = createApiClient();
        const response = await apiClient.post<ApiResponse<SearchResult>>(
            API_ENDPOINTS.QUERIES.SEARCH,
            query,
            {
                headers: {
                    'X-Search-Context': 'product-catalog'
                }
            }
        );

        // Cache successful results
        if (response.data.success) {
            searchCache.set(cacheKey, {
                result: response.data.data,
                timestamp: Date.now()
            });

            // Cleanup old cache entries
            if (searchCache.size > CACHE_CONFIG.MAX_SIZE) {
                const oldestKey = Array.from(searchCache.entries())
                    .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
                searchCache.delete(oldestKey);
            }
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
 * @param query - Chat query parameters
 * @returns Promise resolving to AI assistant's response message
 */
export async function sendChatMessage(
    query: ChatQuery
): Promise<ApiResponse<Message>> {
    // Input validation
    if (!query.message.trim()) {
        throw new Error('Chat message cannot be empty');
    }

    if (!query.sessionId) {
        throw new Error('Session ID is required');
    }

    try {
        const apiClient = createApiClient();
        const response = await apiClient.post<ApiResponse<Message>>(
            API_ENDPOINTS.QUERIES.CHAT,
            query,
            {
                headers: {
                    'X-Chat-Session': query.sessionId
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
 * @param sessionId - Unique identifier for the chat session
 * @returns Promise resolving to list of chat messages
 */
export async function getChatHistory(
    sessionId: UUID
): Promise<ApiResponse<Message[]>> {
    if (!sessionId) {
        throw new Error('Session ID is required');
    }

    try {
        const apiClient = createApiClient();
        const response = await apiClient.get<ApiResponse<Message[]>>(
            `${API_ENDPOINTS.QUERIES.HISTORY}/${sessionId}`
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