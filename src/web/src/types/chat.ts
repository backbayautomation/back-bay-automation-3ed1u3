/**
 * @fileoverview TypeScript type definitions for chat-related functionality
 * @version 1.0.0
 */

// External imports
import { UUID } from 'crypto'; // latest

/**
 * Enum representing different types of message roles in chat
 */
export enum MessageRole {
    USER = 'user',
    ASSISTANT = 'assistant',
    SYSTEM = 'system'
}

/**
 * Interface for message rendering options including LaTeX and diagram support
 */
export interface MessageRenderOptions {
    enableLatex: boolean;
    enableDiagrams: boolean;
    syntaxHighlighting: boolean;
}

/**
 * Interface for message metadata including rendering information
 */
export interface MessageMetadata {
    hasMarkdown: boolean;
    hasCodeBlock: boolean;
    codeLanguage: string | null;
    renderOptions: MessageRenderOptions;
}

/**
 * Interface for chat message structure with enhanced metadata support
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
 * Enum representing chat session status
 */
export enum ChatSessionStatus {
    ACTIVE = 'active',
    ARCHIVED = 'archived',
    DELETED = 'deleted'
}

/**
 * Interface for chat session data with status tracking
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
 * Enum representing WebSocket connection status
 */
export enum WebSocketStatus {
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting'
}

/**
 * Interface for chat Redux state with WebSocket status
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
 * Interface for creating new chat sessions with optional initial message
 */
export interface NewChatSession {
    title: string;
    initialMessage: NewMessage | null;
}