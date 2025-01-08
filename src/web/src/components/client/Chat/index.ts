/**
 * Barrel file exporting chat-related components for the client portal chat interface.
 * Enables code splitting and lazy loading while maintaining proper component composition.
 * @version 1.0.0
 */

// Export chat interface components with their props types
export { default as ChatInterface } from './ChatInterface';
export type { ChatInterfaceProps } from './ChatInterface';

// Export chat bubble component for message display
export { default as ChatBubble } from './ChatBubble';
export type { ChatBubbleProps } from './ChatBubble';

// Export chat input component for message composition
export { default as ChatInput } from './ChatInput';
export type { ChatInputProps } from './ChatInput';

// Export message list component for virtualized message display
export { default as MessageList } from './MessageList';
export type { MessageListProps } from './MessageList';

// Export chat history component for session management
export { default as ChatHistory } from './ChatHistory';
export type { ChatHistoryProps } from './ChatHistory';

// Re-export common chat types used across components
export type {
    Message,
    MessageRole,
    MessageMetadata,
    MessageRenderOptions,
    ChatSession,
    ChatSessionStatus,
    WebSocketStatus,
    ChatState,
    NewMessage,
    NewChatSession
} from '../../../types/chat';