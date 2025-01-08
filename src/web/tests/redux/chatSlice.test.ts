/**
 * @fileoverview Test suite for chat slice Redux state management
 * @version 1.0.0
 */

// External imports - versions specified in package.json
import { configureStore } from '@reduxjs/toolkit'; // v1.9.5
import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // v29.7.0

// Internal imports
import chatReducer, {
  setCurrentSession,
  updateWebSocketStatus,
  addMessage,
  updateMessageStatus,
  clearError,
  sendMessage,
  selectCurrentSession,
  selectWebSocketStatus,
  selectMessageError,
  selectMessageLoadingState
} from '../../src/redux/slices/chatSlice';

import {
  ChatState,
  WebSocketStatus,
  MessageRole,
  ChatSessionStatus
} from '../../src/types/chat';

// Mock initial state
const mockInitialState: ChatState = {
  currentSession: null,
  sessions: [],
  loading: {
    sendMessage: false,
    loadHistory: false
  },
  wsStatus: WebSocketStatus.DISCONNECTED,
  error: {
    message: null,
    code: null,
    details: null
  }
};

// Helper function to create test store
const setupStore = (initialState = mockInitialState) => {
  return configureStore({
    reducer: {
      chat: chatReducer
    },
    preloadedState: {
      chat: initialState
    }
  });
};

// Helper function to create mock messages
const createMockMessage = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  content: 'Test message',
  role: MessageRole.USER,
  timestamp: new Date(),
  sessionId: '123e4567-e89b-12d3-a456-426614174001',
  metadata: {
    hasMarkdown: false,
    hasCodeBlock: false,
    codeLanguage: null,
    renderOptions: {
      enableLatex: false,
      enableDiagrams: false,
      syntaxHighlighting: false
    }
  },
  ...overrides
});

// Helper function to create mock sessions
const createMockSession = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174001',
  title: 'Test Session',
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [],
  status: ChatSessionStatus.ACTIVE,
  ...overrides
});

describe('chatSlice reducer', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    store = setupStore();
  });

  it('should return initial state with connection status', () => {
    const state = store.getState().chat;
    expect(state).toEqual(mockInitialState);
    expect(state.wsStatus).toBe(WebSocketStatus.DISCONNECTED);
  });

  it('should handle setting current session with WebSocket status', () => {
    const mockSession = createMockSession();
    store.dispatch(setCurrentSession(mockSession));
    
    const state = store.getState().chat;
    expect(state.currentSession).toEqual(mockSession);
    expect(state.wsStatus).toBe(WebSocketStatus.DISCONNECTED);
  });

  it('should handle updating WebSocket status', () => {
    store.dispatch(updateWebSocketStatus(WebSocketStatus.CONNECTING));
    expect(store.getState().chat.wsStatus).toBe(WebSocketStatus.CONNECTING);

    store.dispatch(updateWebSocketStatus(WebSocketStatus.CONNECTED));
    const state = store.getState().chat;
    expect(state.wsStatus).toBe(WebSocketStatus.CONNECTED);
    expect(state.error).toEqual(mockInitialState.error);
  });

  it('should handle adding new message with metadata', () => {
    const mockSession = createMockSession();
    const mockMessage = createMockMessage({ sessionId: mockSession.id });
    
    store.dispatch(setCurrentSession(mockSession));
    store.dispatch(addMessage(mockMessage));
    
    const state = store.getState().chat;
    expect(state.currentSession?.messages).toContainEqual(mockMessage);
  });

  it('should handle updating message status', () => {
    const mockSession = createMockSession();
    const mockMessage = createMockMessage({ sessionId: mockSession.id });
    mockSession.messages = [mockMessage];
    
    store.dispatch(setCurrentSession(mockSession));
    store.dispatch(updateMessageStatus({
      sessionId: mockSession.id,
      messageId: mockMessage.id,
      status: 'processed'
    }));
    
    const state = store.getState().chat;
    expect(state.currentSession?.messages[0].metadata.processingStatus).toBe('processed');
  });

  it('should handle clearing error state', () => {
    const errorState = {
      ...mockInitialState,
      error: {
        message: 'Test error',
        code: 'TEST_ERROR',
        details: { test: true }
      }
    };
    
    store = setupStore(errorState);
    store.dispatch(clearError());
    
    expect(store.getState().chat.error).toEqual(mockInitialState.error);
  });
});

describe('chatSlice async thunks', () => {
  let store: ReturnType<typeof setupStore>;
  
  beforeEach(() => {
    store = setupStore();
    global.fetch = jest.fn();
  });

  it('should handle successful message send', async () => {
    const mockResponse = createMockMessage();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const mockSession = createMockSession();
    store.dispatch(setCurrentSession(mockSession));
    
    const result = await store.dispatch(sendMessage({
      content: 'Test message',
      sessionId: mockSession.id
    }));
    
    expect(result.payload).toEqual(mockResponse);
    expect(store.getState().chat.loading.sendMessage).toBe(false);
    expect(store.getState().chat.error).toEqual(mockInitialState.error);
  });

  it('should handle message send error', async () => {
    const errorMessage = 'API Error';
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    const mockSession = createMockSession();
    store.dispatch(setCurrentSession(mockSession));
    
    await store.dispatch(sendMessage({
      content: 'Test message',
      sessionId: mockSession.id
    }));
    
    const state = store.getState().chat;
    expect(state.loading.sendMessage).toBe(false);
    expect(state.error.code).toBe('SEND_MESSAGE_ERROR');
    expect(state.error.message).toBe(errorMessage);
  });

  it('should handle invalid message parameters', async () => {
    await store.dispatch(sendMessage({
      content: '',
      sessionId: '123'
    }));
    
    const state = store.getState().chat;
    expect(state.error.code).toBe('SEND_MESSAGE_ERROR');
    expect(state.error.message).toBe('Invalid message parameters');
  });
});

describe('chatSlice selectors', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    store = setupStore();
  });

  it('should select current session', () => {
    const mockSession = createMockSession();
    store.dispatch(setCurrentSession(mockSession));
    
    const selectedSession = selectCurrentSession(store.getState());
    expect(selectedSession).toEqual(mockSession);
  });

  it('should select WebSocket status', () => {
    store.dispatch(updateWebSocketStatus(WebSocketStatus.CONNECTED));
    
    const status = selectWebSocketStatus(store.getState());
    expect(status).toBe(WebSocketStatus.CONNECTED);
  });

  it('should select message error state', () => {
    const errorState = {
      ...mockInitialState,
      error: {
        message: 'Test error',
        code: 'TEST_ERROR',
        details: null
      }
    };
    
    store = setupStore(errorState);
    const error = selectMessageError(store.getState());
    expect(error).toEqual(errorState.error);
  });

  it('should select message loading state', () => {
    const loadingState = {
      ...mockInitialState,
      loading: {
        sendMessage: true,
        loadHistory: false
      }
    };
    
    store = setupStore(loadingState);
    const loading = selectMessageLoadingState(store.getState());
    expect(loading).toEqual(loadingState.loading);
  });
});