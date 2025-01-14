import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';

import ChatInterface from '../../../src/components/client/Chat/ChatInterface';
import ChatBubble from '../../../src/components/client/Chat/ChatBubble';
import MessageList from '../../../src/components/client/Chat/MessageList';
import { Message, MessageRole, WebSocketStatus } from '../../../src/types/chat';
import chatReducer, { addMessage } from '../../../src/redux/slices/chatSlice';

// Mock WebSocket
class MockWebSocket {
  private listeners: Record<string, Function[]> = {};
  public readyState: number = WebSocket.OPEN;

  constructor(url: string) {}

  send(data: string) {
    // Simulate message sending
    setTimeout(() => {
      this.triggerEvent('message', { data });
    }, 100);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.triggerEvent('close', {});
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

  triggerEvent(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

// Mock store setup
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      chat: chatReducer
    },
    preloadedState: initialState
  });
};

// Enhanced render utility with store and WebSocket mocking
const renderWithRedux = (
  component: React.ReactElement,
  {
    initialState = {},
    store = createTestStore(initialState),
    wsStatus = WebSocketStatus.CONNECTED
  } = {}
) => {
  global.WebSocket = MockWebSocket as any;

  return {
    ...render(
      <Provider store={store}>
        {component}
      </Provider>
    ),
    store
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chat interface with proper ARIA roles and labels', async () => {
    const { container } = renderWithRedux(
      <ChatInterface sessionId="123" aria-label="Test chat interface" />
    );

    expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Test chat interface');
    
    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles WebSocket connection states correctly', async () => {
    const { store } = renderWithRedux(
      <ChatInterface sessionId="123" />,
      { wsStatus: WebSocketStatus.DISCONNECTED }
    );

    // Verify disconnected state UI
    expect(screen.getByText(/connection lost/i)).toBeInTheDocument();

    // Simulate reconnection
    store.dispatch({ type: 'chat/updateWebSocketStatus', payload: WebSocketStatus.CONNECTED });
    
    await waitFor(() => {
      expect(screen.queryByText(/connection lost/i)).not.toBeInTheDocument();
    });
  });

  it('processes messages with loading and error states', async () => {
    const onError = vi.fn();
    const { store } = renderWithRedux(
      <ChatInterface sessionId="123" onError={onError} />
    );

    // Send message
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Test message{enter}');

    // Verify loading state
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Simulate message response
    store.dispatch(addMessage(mockMessages[0]));

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});

describe('ChatBubble Component', () => {
  it('renders messages with proper styling and animations', () => {
    render(<ChatBubble message={mockMessages[0]} />);
    
    const bubble = screen.getByRole('article');
    expect(bubble).toHaveStyle({
      backgroundColor: expect.any(String),
      borderRadius: expect.any(String)
    });
  });

  it('processes markdown with syntax highlighting', async () => {
    const messageWithCode = {
      ...mockMessages[0],
      content: '```javascript\nconst test = "code";\n```',
      metadata: {
        ...mockMessages[0].metadata,
        hasCodeBlock: true,
        codeLanguage: 'javascript'
      }
    };

    render(<ChatBubble message={messageWithCode} />);
    
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
    const manyMessages = Array.from({ length: 100 }, (_, i) => ({
      ...mockMessages[0],
      id: `msg${i}` as UUID,
      content: `Message ${i}`
    }));

    const { container } = renderWithRedux(
      <MessageList 
        isLoading={false}
        onScrollTop={() => {}}
        hasMoreMessages={true}
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

    // Verify only a subset of messages is rendered
    const renderedMessages = container.querySelectorAll('.message-item');
    expect(renderedMessages.length).toBeLessThan(manyMessages.length);
  });

  it('handles infinite scroll with proper loading states', async () => {
    const onScrollTop = vi.fn();
    
    renderWithRedux(
      <MessageList 
        isLoading={false}
        onScrollTop={onScrollTop}
        hasMoreMessages={true}
      />
    );

    // Simulate scroll to top
    fireEvent.scroll(screen.getByRole('log'), {
      target: { scrollTop: 0 }
    });

    await waitFor(() => {
      expect(onScrollTop).toHaveBeenCalled();
    });
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
    const initialScrollTop = 100;
    
    // Set initial scroll position
    fireEvent.scroll(messageList, {
      target: { scrollTop: initialScrollTop }
    });

    // Add new message
    store.dispatch(addMessage(mockMessages[0]));

    await waitFor(() => {
      expect(messageList.scrollTop).toBe(initialScrollTop);
    });
  });
});