import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';
import { measurePerformance } from 'jest-performance';

import ChatPage from '../../../../src/pages/client/Chat';
import chatReducer from '../../../../src/redux/slices/chatSlice';
import { WebSocketStatus, MessageRole } from '../../../../src/types/chat';

// Mock dependencies
jest.mock('../../../../src/hooks/useWebSocket', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    isConnected: false,
    connectionState: 'disconnected',
    connect: jest.fn(),
    disconnect: jest.fn(),
    reconnect: jest.fn(),
    messageQueue: []
  }))
}));

// Test constants
const TEST_TIMEOUT = 30000;
const PERFORMANCE_THRESHOLDS = {
  messageRender: 100, // ms
  messageListScroll: 16, // ms (60fps)
  markdownRender: 50 // ms
};

// Test utilities
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      chat: chatReducer
    },
    preloadedState: {
      chat: {
        currentSession: {
          id: 'test-session',
          messages: [],
          status: 'active'
        },
        wsStatus: WebSocketStatus.DISCONNECTED,
        ...initialState
      }
    }
  });
};

const renderWithProviders = (
  ui: React.ReactElement,
  {
    store = createMockStore(),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock messages for testing
const mockMessages = [
  {
    id: '1',
    content: 'Test message 1',
    role: MessageRole.USER,
    timestamp: new Date(),
    sessionId: 'test-session'
  },
  {
    id: '2',
    content: 'Test response 1',
    role: MessageRole.ASSISTANT,
    timestamp: new Date(),
    sessionId: 'test-session'
  }
];

describe('ChatPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Layout', () => {
    it('renders chat interface with loading state when disconnected', () => {
      renderWithProviders(<ChatPage />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByLabelText(/chat message container/i)).toBeInTheDocument();
    });

    it('displays connection status indicator', async () => {
      const { rerender } = renderWithProviders(<ChatPage />);
      
      expect(screen.getByRole('status')).toHaveTextContent(/connecting/i);
      
      rerender(<ChatPage />);
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });
  });

  describe('WebSocket Connection', () => {
    it('establishes WebSocket connection on mount', async () => {
      const mockConnect = jest.fn();
      jest.spyOn(require('../../../../src/hooks/useWebSocket'), 'default')
        .mockImplementation(() => ({
          isConnected: false,
          connect: mockConnect,
          disconnect: jest.fn()
        }));

      renderWithProviders(<ChatPage />);
      
      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalled();
      });
    });

    it('handles connection errors gracefully', async () => {
      const mockConnect = jest.fn().mockRejectedValue(new Error('Connection failed'));
      jest.spyOn(require('../../../../src/hooks/useWebSocket'), 'default')
        .mockImplementation(() => ({
          isConnected: false,
          connect: mockConnect,
          disconnect: jest.fn()
        }));

      renderWithProviders(<ChatPage />);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('Message Handling', () => {
    it('displays messages in chronological order', async () => {
      const store = createMockStore({
        currentSession: {
          id: 'test-session',
          messages: mockMessages
        }
      });

      renderWithProviders(<ChatPage />, { store });
      
      const messages = screen.getAllByRole('article');
      expect(messages).toHaveLength(mockMessages.length);
      expect(messages[0]).toHaveTextContent(mockMessages[0].content);
    });

    it('handles markdown rendering correctly', async () => {
      const markdownMessage = {
        id: '3',
        content: '**Bold** and *italic* text',
        role: MessageRole.ASSISTANT,
        timestamp: new Date(),
        sessionId: 'test-session'
      };

      const store = createMockStore({
        currentSession: {
          id: 'test-session',
          messages: [markdownMessage]
        }
      });

      renderWithProviders(<ChatPage />, { store });
      
      const message = screen.getByRole('article');
      expect(message).toContainHTML('<strong>Bold</strong>');
      expect(message).toContainHTML('<em>italic</em>');
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 accessibility guidelines', async () => {
      const { container } = renderWithProviders(<ChatPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<ChatPage />);
      
      const chatInput = screen.getByRole('textbox');
      fireEvent.keyDown(chatInput, { key: 'Tab' });
      expect(document.activeElement).toBe(chatInput);
    });
  });

  describe('Performance', () => {
    it('renders messages within performance budget', async () => {
      const { rerender } = renderWithProviders(<ChatPage />);
      
      const renderTime = await measurePerformance(
        () => {
          rerender(<ChatPage />);
        },
        { timeout: 1000 }
      );

      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.messageRender);
    });

    it('handles message list scrolling efficiently', async () => {
      const store = createMockStore({
        currentSession: {
          id: 'test-session',
          messages: Array(100).fill(mockMessages[0])
        }
      });

      renderWithProviders(<ChatPage />, { store });
      
      const scrollTime = await measurePerformance(
        () => {
          const messageList = screen.getByRole('log');
          fireEvent.scroll(messageList, { target: { scrollTop: 1000 } });
        },
        { timeout: 1000 }
      );

      expect(scrollTime).toBeLessThan(PERFORMANCE_THRESHOLDS.messageListScroll);
    });
  });

  describe('Error Handling', () => {
    it('recovers from WebSocket disconnection', async () => {
      const mockReconnect = jest.fn();
      jest.spyOn(require('../../../../src/hooks/useWebSocket'), 'default')
        .mockImplementation(() => ({
          isConnected: false,
          connectionState: WebSocketStatus.DISCONNECTED,
          connect: jest.fn(),
          reconnect: mockReconnect
        }));

      renderWithProviders(<ChatPage />);
      
      await waitFor(() => {
        expect(mockReconnect).toHaveBeenCalled();
      });
    });

    it('displays error boundary fallback on component error', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const store = createMockStore({
        currentSession: null // This should trigger an error
      });

      renderWithProviders(<ChatPage />, { store });
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      errorSpy.mockRestore();
    });
  });
});