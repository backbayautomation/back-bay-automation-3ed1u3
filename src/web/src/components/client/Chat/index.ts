/**
 * Barrel file for chat-related components in the client portal chat interface.
 * Centralizes exports for chat components while enabling code splitting and
 * maintainable component composition.
 * @version 1.0.0
 */

// Component exports with their respective types
export { default as ChatBubble } from './ChatBubble';
export type { ChatBubbleProps } from './ChatBubble';

export { default as ChatInput } from './ChatInput';
export type { ChatInputProps } from './ChatInput';

export { default as MessageList } from './MessageList';
export type { MessageListProps } from './MessageList';

export { default as ChatHistory } from './ChatHistory';
export type { ChatHistoryProps } from './ChatHistory';

// Main chat interface component as default export
export { default } from './ChatInterface';
export type { ChatInterfaceProps } from './ChatInterface';

// Re-export relevant types from chat types module for convenience
export type {
    Message,
    MessageRole,
    ChatSession,
    ChatSessionStatus,
    MessageMetadata,
    MessageRenderOptions,
    WebSocketStatus
} from '../../../types/chat';