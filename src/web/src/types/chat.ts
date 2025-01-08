// @ts-check
/**
 * Chat type definitions for AI-powered Product Catalog Search System
 * Version: 1.0.0
 */

// External imports
import { UUID } from 'crypto'; // v20.11.1+

/**
 * Enum representing different roles in a chat conversation
 */
export enum MessageRole {
    USER = 'user',
    ASSISTANT = 'assistant',
    SYSTEM = 'system'
}

/**
 * Interface for message rendering configuration options
 */
export interface MessageRenderOptions {
    enableLatex: boolean;
    enableDiagrams: boolean;
    syntaxHighlighting: boolean;
}

/**
 * Interface for message metadata including rendering capabilities
 */
export interface MessageMetadata {
    hasMarkdown: boolean;
    hasCodeBlock: boolean;
    codeLanguage: string | null;
    renderOptions: MessageRenderOptions;
}

/**
 * Interface representing a chat message with complete type safety
 */
export interface Message {
    id: UUID;
    content: string;
    role: MessageRole;
    timestamp: Date;
    sessionId: UUID;
    metadata: MessageMetadata;
}

/**
 * Enum representing possible chat session statuses
 */
export enum ChatSessionStatus {
    ACTIVE = 'active',
    ARCHIVED = 'archived',
    DELETED = 'deleted'
}

/**
 * Interface representing a chat session with message history
 */
export interface ChatSession {
    id: UUID;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messages: Message[];
    status: ChatSessionStatus;
}

/**
 * Enum representing WebSocket connection states
 */
export enum WebSocketStatus {
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting'
}

/**
 * Interface representing the global chat state for Redux
 */
export interface ChatState {
    currentSession: ChatSession | null;
    sessions: ChatSession[];
    loading: boolean;
    error: string | null;
    connectionStatus: WebSocketStatus;
}

/**
 * Interface for creating new messages with optional metadata
 */
export interface NewMessage {
    content: string;
    sessionId: UUID;
    metadata?: Partial<MessageMetadata>;
}

/**
 * Interface for creating new chat sessions
 */
export interface NewChatSession {
    title: string;
    initialMessage: NewMessage | null;
}