import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';

import ChatInterface from '../../../src/components/client/Chat/ChatInterface';
import ChatBubble from '../../../src/components/client/Chat/ChatBubble';
import MessageList from '../../../src/components/client/Chat/MessageList';
import { Message, MessageRole } from '../../../src/types/chat';
import chatReducer, { addMessage } from '../../../src/redux/slices/chatSlice';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock WebSocket
class MockWebSocket {
  private listeners: Record<string, Function[]> = {};
  public readyState: number = WebSocket.CONNECTING;

  constructor(url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.emit('open');
    }, 100);
  }

  send(data: string) {
    // Simulate message echo for testing
    setTimeout(() => {
      this.emit('message', { data });
    }, 50);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
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

  private emit(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

// Mock store setup helper
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      chat: chatReducer
    },
    preloadedState: initialState
  });
};

// Enhanced render helper with store and utilities
const renderWithRedux = (
  component: React.ReactElement,
  { initialState = {}, store = createTestStore(initialState) } = {}
) => {
  const user = userEvent.setup();
  return {
    user,
    store,
    ...render(
      <Provider store={store}>
        {component}
      </Provider>
    )
  };
};

// Mock messages for testing
const mockMessages: Message[] = [
  {
    id: '1' as UUID,
    content: 'Hello, how can I help you?',
    role: MessageRole.ASSISTANT,
    timestamp: new Date(),
    sessionId: '123' as UUID,
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
    id: '2' as UUID,
    content: 'I need information about product A123',
    role: MessageRole.USER,
    timestamp: new Date(),
    sessionId: '123' as UUID,
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

describe('ChatInterface Component', () => {
  beforeAll(() => {
    global.WebSocket = MockWebSocket as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders chat interface with proper ARIA roles and labels', async () => {
    const { container } = renderWithRedux(
      <ChatInterface sessionId="123" aria-label="Product chat" />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Product chat');
    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('handles WebSocket connection states correctly', async () => {
    const { store } = renderWithRedux(
      <ChatInterface sessionId="123" />
    );

    await waitFor(() => {
      expect(store.getState().chat.wsStatus).toBe('connected');
    });

    // Simulate disconnection
    global.WebSocket.prototype.close();

    await waitFor(() => {
      expect(store.getState().chat.wsStatus).toBe('disconnected');
    });
  });

  it('sends and receives messages correctly', async () => {
    const { user, store } = renderWithRedux(
      <ChatInterface sessionId="123" />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'Test message');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      const messages = store.getState().chat.currentSession?.messages || [];
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Test message');
    });
  });

  it('handles error states gracefully', async () => {
    const onError = vi.fn();
    renderWithRedux(
      <ChatInterface 
        sessionId="123" 
        onError={onError}
      />
    );

    // Simulate WebSocket error
    const ws = new MockWebSocket('');
    ws.emit('error', new Error('Connection failed'));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        type: 'connection',
        message: 'Connection lost. Retrying...'
      }));
    });
  });
});

describe('MessageList Component', () => {
  it('implements virtualization for large message lists', async () => {
    const manyMessages = Array.from({ length: 100 }, (_, i) => ({
      ...mockMessages[0],
      id: `msg${i}` as UUID,
      content: `Message ${i}`
    }));

    const { container } = renderWithRedux(
      <MessageList 
        isLoading={false}
        onScrollTop={() => {}}
        hasMoreMessages={false}
      />,
      {
        initialState: {
          chat: {
            currentSession: {
              messages: manyMessages
            }
          }
        }
      }
    );

    const virtualItems = container.querySelectorAll('[data-testid^="chat-bubble"]');
    expect(virtualItems.length).toBeLessThan(manyMessages.length);
  });

  it('maintains scroll position during updates', async () => {
    const { store } = renderWithRedux(
      <MessageList 
        isLoading={false}
        onScrollTop={() => {}}
        hasMoreMessages={false}
      />
    );

    const messageList = screen.getByRole('log');
    const initialScrollTop = messageList.scrollTop;

    store.dispatch(addMessage(mockMessages[0]));

    await waitFor(() => {
      expect(messageList.scrollTop).not.toBe(initialScrollTop);
    });
  });
});

describe('ChatBubble Component', () => {
  it('renders messages with proper styling and animations', () => {
    const { container } = render(
      <ChatBubble message={mockMessages[0]} />
    );

    expect(container.firstChild).toHaveStyle({
      opacity: 1,
      transform: 'none'
    });
  });

  it('processes markdown with syntax highlighting', async () => {
    const messageWithCode = {
      ...mockMessages[0],
      content: '```javascript\nconst x = 42;\n```',
      metadata: {
        ...mockMessages[0].metadata,
        hasCodeBlock: true
      }
    };

    render(<ChatBubble message={messageWithCode} />);

    await waitFor(() => {
      expect(screen.getByRole('code')).toBeInTheDocument();
    });
  });

  it('maintains accessibility in all states', async () => {
    const { container } = render(
      <ChatBubble message={mockMessages[0]} isLoading={true} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
    expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
  });
});