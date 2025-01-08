import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react';
import { performance } from 'jest-performance';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';

import ChatPage from '../../../../src/pages/client/Chat';
import { lightTheme } from '../../../../src/config/theme';
import { VALIDATION_CONSTANTS } from '../../../../src/config/constants';
import { WebSocketStatus } from '../../../../src/types/chat';
import { createTestStore } from '../../../utils/testUtils';

// Mock WebSocket hook
jest.mock('../../../../src/hooks/useWebSocket', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    isConnected: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    reconnect: jest.fn(),
    messageQueue: [],
    connectionState: 'disconnected',
    sendMessage: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn()
  }))
}));

// Test constants
const TEST_TIMEOUT = 30000;
const PERFORMANCE_THRESHOLDS = {
  message_render: 100, // ms
  message_list_scroll: 16, // ms (60fps)
  markdown_render: 50 // ms
};

// Helper function to render component with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    initialState = {},
    store = createTestStore(initialState),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <ThemeProvider theme={lightTheme}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  };
};

describe('ChatPage', () => {
  let mockStore: any;

  beforeEach(() => {
    mockStore = createTestStore({
      chat: {
        currentSession: {
          id: 'test-session',
          messages: [],
          status: 'active'
        },
        wsStatus: WebSocketStatus.DISCONNECTED
      }
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('UI Rendering', () => {
    it('should render chat interface with all required components', () => {
      const { container } = renderWithProviders(<ChatPage />, { store: mockStore });
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
      expect(container.querySelector('.MuiCircularProgress-root')).toBeInTheDocument();
    });

    it('should show loading state when connecting', () => {
      renderWithProviders(<ChatPage />, { store: mockStore });
      
      const loadingIndicator = screen.getByRole('status');
      expect(loadingIndicator).toBeInTheDocument();
      expect(loadingIndicator).toHaveAttribute('aria-label', expect.stringContaining('connecting'));
    });

    it('should handle error states gracefully', async () => {
      const { store } = renderWithProviders(<ChatPage />, { store: mockStore });
      
      // Simulate WebSocket error
      store.dispatch({
        type: 'chat/setError',
        payload: { message: 'Connection failed' }
      });

      const errorAlert = await screen.findByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveTextContent('Connection failed');
    });
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection on mount', async () => {
      const { store } = renderWithProviders(<ChatPage />, { store: mockStore });
      
      await waitFor(() => {
        expect(store.getState().chat.wsStatus).toBe(WebSocketStatus.CONNECTING);
      });
    });

    it('should handle reconnection attempts', async () => {
      const { store } = renderWithProviders(<ChatPage />, { store: mockStore });
      
      // Simulate connection loss
      store.dispatch({
        type: 'chat/updateWebSocketStatus',
        payload: WebSocketStatus.DISCONNECTED
      });

      await waitFor(() => {
        expect(store.getState().chat.wsStatus).toBe(WebSocketStatus.CONNECTING);
      });
    });

    it('should cleanup WebSocket connection on unmount', () => {
      const { unmount } = renderWithProviders(<ChatPage />, { store: mockStore });
      
      unmount();
      expect(useWebSocket().disconnect).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should handle message submission', async () => {
      const { store } = renderWithProviders(<ChatPage />, { store: mockStore });
      
      const input = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      expect(useWebSocket().sendMessage).toHaveBeenCalledWith(
        'chat.message',
        expect.objectContaining({
          content: 'Test message',
          sessionId: expect.any(String)
        })
      );
    });

    it('should enforce message length limits', async () => {
      renderWithProviders(<ChatPage />, { store: mockStore });
      
      const input = screen.getByRole('textbox');
      const longMessage = 'a'.repeat(VALIDATION_CONSTANTS.MAX_CHAT_MESSAGE_LENGTH + 1);

      await userEvent.type(input, longMessage);
      
      expect(screen.getByText(/exceeds maximum length/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    });

    it('should handle markdown rendering', async () => {
      const { store } = renderWithProviders(<ChatPage />, { store: mockStore });
      
      // Add message with markdown
      store.dispatch({
        type: 'chat/addMessage',
        payload: {
          id: 'test',
          content: '**Bold text**',
          role: 'assistant',
          metadata: { hasMarkdown: true }
        }
      });

      const message = await screen.findByText('Bold text');
      expect(message.tagName).toBe('STRONG');
    });
  });

  describe('Accessibility', () => {
    it('should pass accessibility audit', async () => {
      const { container } = renderWithProviders(<ChatPage />, { store: mockStore });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(<ChatPage />, { store: mockStore });
      
      const input = screen.getByRole('textbox');
      await userEvent.tab();
      expect(input).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('button', { name: /send/i })).toHaveFocus();
    });

    it('should announce message status changes', async () => {
      renderWithProviders(<ChatPage />, { store: mockStore });
      
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Performance', () => {
    it('should render messages within performance budget', async () => {
      const { store } = renderWithProviders(<ChatPage />, { store: mockStore });
      
      const renderTime = await performance(async () => {
        // Add 50 messages
        for (let i = 0; i < 50; i++) {
          store.dispatch({
            type: 'chat/addMessage',
            payload: {
              id: `test-${i}`,
              content: `Message ${i}`,
              role: 'user'
            }
          });
        }
      });

      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.message_render);
    });

    it('should handle scroll performance efficiently', async () => {
      const { container } = renderWithProviders(<ChatPage />, { store: mockStore });
      
      const scrollTime = await performance(async () => {
        const messageList = container.querySelector('[role="log"]');
        if (messageList) {
          fireEvent.scroll(messageList, { target: { scrollTop: 1000 } });
        }
      });

      expect(scrollTime).toBeLessThan(PERFORMANCE_THRESHOLDS.message_list_scroll);
    });
  });
});