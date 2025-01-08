import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react';
import { measurePerformance } from 'jest-performance';
import ChatPage from '../../../../src/pages/client/Chat';
import { useWebSocket } from '../../../../src/hooks/useWebSocket';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../../../src/contexts/ThemeContext';
import { configureStore } from '@reduxjs/toolkit';
import chatReducer from '../../../../src/redux/slices/chatSlice';

// Mock WebSocket hook
jest.mock('../../../../src/hooks/useWebSocket', () => ({
  useWebSocket: jest.fn()
}));

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  renderTime: 100, // ms
  interactionTime: 50, // ms
  messageProcessingTime: 30 // ms
};

// Test utilities
const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: { chat: chatReducer },
      preloadedState
    }),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  };
};

describe('ChatPage', () => {
  // Mock setup
  const mockWebSocket = {
    isConnected: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    sendMessage: jest.fn(),
    connectionState: 'disconnected'
  };

  beforeEach(() => {
    (useWebSocket as jest.Mock).mockReturnValue(mockWebSocket);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // UI Component Tests
  describe('UI Components', () => {
    it('renders chat interface with all required elements', async () => {
      const { container } = renderWithProviders(<ChatPage />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /chat message/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
      
      // Check for loading state
      expect(screen.queryByRole('status')).toBeInTheDocument();
    });

    it('displays loading overlay while initializing', () => {
      renderWithProviders(<ChatPage />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Connecting to chat service');
    });

    it('handles error states gracefully', async () => {
      mockWebSocket.connect.mockRejectedValueOnce(new Error('Connection failed'));
      renderWithProviders(<ChatPage />);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  // WebSocket Connection Tests
  describe('WebSocket Connection', () => {
    it('establishes WebSocket connection on mount', async () => {
      renderWithProviders(<ChatPage />);
      expect(mockWebSocket.connect).toHaveBeenCalled();
    });

    it('handles reconnection attempts', async () => {
      mockWebSocket.isConnected = false;
      renderWithProviders(<ChatPage />);
      
      await waitFor(() => {
        expect(mockWebSocket.connect).toHaveBeenCalledTimes(1);
      });
    });

    it('disconnects WebSocket on unmount', () => {
      const { unmount } = renderWithProviders(<ChatPage />);
      unmount();
      expect(mockWebSocket.disconnect).toHaveBeenCalled();
    });
  });

  // Message Handling Tests
  describe('Message Handling', () => {
    it('processes incoming messages correctly', async () => {
      const { store } = renderWithProviders(<ChatPage />);
      
      const mockMessage = {
        id: '123',
        content: 'Test message',
        role: 'user',
        timestamp: new Date(),
        sessionId: '456'
      };

      // Simulate incoming message
      await store.dispatch({ 
        type: 'chat/addMessage', 
        payload: mockMessage 
      });

      expect(store.getState().chat.currentSession?.messages).toContainEqual(mockMessage);
    });

    it('handles message errors appropriately', async () => {
      mockWebSocket.sendMessage.mockRejectedValueOnce(new Error('Failed to send'));
      renderWithProviders(<ChatPage />);
      
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Test message{enter}');
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('meets WCAG 2.1 accessibility standards', async () => {
      const { container } = renderWithProviders(<ChatPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<ChatPage />);
      
      const input = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });
      
      await userEvent.tab();
      expect(input).toHaveFocus();
      
      await userEvent.tab();
      expect(sendButton).toHaveFocus();
    });
  });

  // Performance Tests
  describe('Performance', () => {
    it('renders within performance budget', async () => {
      const { rerender } = renderWithProviders(<ChatPage />);
      
      const renderMetrics = await measurePerformance(
        () => rerender(<ChatPage />),
        { timeout: PERFORMANCE_THRESHOLDS.renderTime }
      );
      
      expect(renderMetrics.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.renderTime);
    });

    it('handles message processing within performance thresholds', async () => {
      const { store } = renderWithProviders(<ChatPage />);
      
      const processingMetrics = await measurePerformance(
        async () => {
          await store.dispatch({ 
            type: 'chat/addMessage', 
            payload: {
              id: '123',
              content: 'Performance test message',
              role: 'user',
              timestamp: new Date(),
              sessionId: '456'
            }
          });
        },
        { timeout: PERFORMANCE_THRESHOLDS.messageProcessingTime }
      );
      
      expect(processingMetrics.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.messageProcessingTime);
    });
  });

  // Error Boundary Tests
  describe('Error Boundary', () => {
    it('catches and handles rendering errors', async () => {
      const ErrorComponent = () => {
        throw new Error('Test error');
      };

      const { container } = renderWithProviders(
        <ChatPage>
          <ErrorComponent />
        </ChatPage>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(container).toHaveTextContent('Chat Error');
    });
  });
});