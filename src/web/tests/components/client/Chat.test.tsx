import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { Provider } from 'react-redux'; // ^8.1.0
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.5
import { vi } from 'vitest'; // ^0.34.0
import { axe } from '@axe-core/react'; // ^4.7.0

import ChatInterface from '../../../src/components/client/Chat/ChatInterface';
import ChatBubble from '../../../src/components/client/Chat/ChatBubble';
import MessageList from '../../../src/components/client/Chat/MessageList';
import { Message, MessageRole, WebSocketStatus } from '../../../src/types/chat';

// Mock Redux store setup
const createTestStore = (initialState = {}) => {
    return configureStore({
        reducer: {
            chat: (state = initialState, action) => state
        }
    });
};

// Enhanced WebSocket mock
class MockWebSocket {
    private listeners: Record<string, Function[]> = {};
    public readyState: number = WebSocket.CONNECTING;

    constructor(url: string) {
        setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            this.emit('open', {});
        }, 100);
    }

    send(data: string) {
        const parsedData = JSON.parse(data);
        this.emit('message', { data: JSON.stringify(parsedData) });
    }

    addEventListener(event: string, callback: Function) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    removeEventListener(event: string, callback: Function) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    close() {
        this.readyState = WebSocket.CLOSED;
        this.emit('close', {});
    }

    private emit(event: string, data: any) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}

// Mock messages for testing
const mockMessages: Message[] = [
    {
        id: '1',
        content: 'Hello, how can I help you?',
        role: MessageRole.ASSISTANT,
        timestamp: new Date(),
        sessionId: 'test-session',
        metadata: {
            hasMarkdown: false,
            hasCodeBlock: false,
            codeLanguage: null,
            renderOptions: {
                enableLatex: false,
                enableDiagrams: false,
                syntaxHighlighting: false
            }
        }
    },
    {
        id: '2',
        content: 'I need information about product A123',
        role: MessageRole.USER,
        timestamp: new Date(),
        sessionId: 'test-session',
        metadata: {
            hasMarkdown: false,
            hasCodeBlock: false,
            codeLanguage: null,
            renderOptions: {
                enableLatex: false,
                enableDiagrams: false,
                syntaxHighlighting: false
            }
        }
    }
];

// Test utilities
const renderWithRedux = (
    component: React.ReactElement,
    { initialState = {}, store = createTestStore(initialState) } = {}
) => {
    return {
        ...render(
            <Provider store={store}>
                {component}
            </Provider>
        ),
        store
    };
};

describe('ChatInterface Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.WebSocket = MockWebSocket as any;
    });

    it('renders chat interface with proper ARIA roles and labels', async () => {
        const { container } = renderWithRedux(
            <ChatInterface 
                sessionId="test-session"
                aria-label="Test chat interface"
            />
        );

        expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Test chat interface');
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('handles WebSocket connection states correctly', async () => {
        const { store } = renderWithRedux(
            <ChatInterface sessionId="test-session" />,
            {
                initialState: {
                    chat: {
                        currentSession: null,
                        wsStatus: WebSocketStatus.CONNECTING
                    }
                }
            }
        );

        await waitFor(() => {
            expect(screen.getByText(/Connection lost/i)).toBeInTheDocument();
        });

        store.dispatch({ 
            type: 'chat/updateWebSocketStatus', 
            payload: WebSocketStatus.CONNECTED 
        });

        await waitFor(() => {
            expect(screen.queryByText(/Connection lost/i)).not.toBeInTheDocument();
        });
    });

    it('processes messages with loading and error states', async () => {
        const { store } = renderWithRedux(
            <ChatInterface sessionId="test-session" />,
            {
                initialState: {
                    chat: {
                        currentSession: { messages: mockMessages },
                        wsStatus: WebSocketStatus.CONNECTED
                    }
                }
            }
        );

        const input = screen.getByRole('textbox');
        await userEvent.type(input, 'Test message');
        await userEvent.keyboard('{Enter}');

        expect(screen.getByRole('progressbar')).toBeInTheDocument();

        // Simulate error state
        store.dispatch({
            type: 'chat/messageError',
            payload: { message: 'Failed to send message' }
        });

        await waitFor(() => {
            expect(screen.getByText(/Failed to send message/i)).toBeInTheDocument();
        });
    });
});

describe('ChatBubble Component', () => {
    it('renders messages with proper styling and animations', () => {
        const message = mockMessages[0];
        render(<ChatBubble message={message} />);

        const bubble = screen.getByRole('article');
        expect(bubble).toHaveAttribute('aria-label', `${message.role} message`);
        expect(bubble).toHaveStyle({ transition: expect.stringContaining('box-shadow') });
    });

    it('processes markdown with syntax highlighting', async () => {
        const markdownMessage: Message = {
            ...mockMessages[0],
            content: '```javascript\nconst test = "code";\n```',
            metadata: {
                ...mockMessages[0].metadata,
                hasMarkdown: true,
                hasCodeBlock: true,
                codeLanguage: 'javascript'
            }
        };

        render(<ChatBubble message={markdownMessage} />);
        await waitFor(() => {
            expect(screen.getByText('const test = "code";')).toBeInTheDocument();
            expect(screen.getByRole('article')).toContainElement(
                screen.getByRole('code')
            );
        });
    });
});

describe('MessageList Component', () => {
    it('implements virtualization for large message lists', async () => {
        const largeMessageList = Array.from({ length: 100 }, (_, i) => ({
            ...mockMessages[0],
            id: `msg-${i}`,
            content: `Message ${i}`
        }));

        renderWithRedux(
            <MessageList
                isLoading={false}
                onScrollTop={vi.fn()}
                hasMoreMessages={true}
            />,
            {
                initialState: {
                    chat: {
                        currentSession: { messages: largeMessageList }
                    }
                }
            }
        );

        const messageContainer = screen.getByRole('log');
        expect(messageContainer.children.length).toBeLessThan(largeMessageList.length);
    });

    it('maintains scroll position during updates', async () => {
        const { store } = renderWithRedux(
            <MessageList
                isLoading={false}
                onScrollTop={vi.fn()}
                hasMoreMessages={true}
            />,
            {
                initialState: {
                    chat: {
                        currentSession: { messages: mockMessages }
                    }
                }
            }
        );

        const messageContainer = screen.getByRole('log');
        messageContainer.scrollTop = 100;
        const scrollPosition = messageContainer.scrollTop;

        store.dispatch({
            type: 'chat/addMessage',
            payload: {
                ...mockMessages[0],
                id: 'new-message'
            }
        });

        await waitFor(() => {
            expect(messageContainer.scrollTop).toBe(scrollPosition);
        });
    });

    it('supports keyboard navigation', async () => {
        renderWithRedux(
            <MessageList
                isLoading={false}
                onScrollTop={vi.fn()}
                hasMoreMessages={false}
            />,
            {
                initialState: {
                    chat: {
                        currentSession: { messages: mockMessages }
                    }
                }
            }
        );

        const messageContainer = screen.getByRole('log');
        fireEvent.keyDown(messageContainer, { key: 'End' });

        await waitFor(() => {
            expect(messageContainer.scrollTop).toBe(messageContainer.scrollHeight - messageContainer.clientHeight);
        });
    });
});