/**
 * @fileoverview Test suite for chat slice Redux state management
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit'; // v1.9.5
import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // v29.7.0
import {
  reducer,
  actions,
  sendMessage,
  loadChatHistory,
  selectCurrentSession,
  selectSessions
} from '../../src/redux/slices/chatSlice';
import { 
  ChatState,
  WebSocketStatus,
  MessageRole,
  ChatSessionStatus,
  Message,
  ChatSession
} from '../../src/types/chat';
import { UUID } from 'crypto';

// Mock initial state for testing
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
const setupStore = (initialState: Partial<ChatState> = {}) => {
  return configureStore({
    reducer: { chat: reducer },
    preloadedState: {
      chat: { ...mockInitialState, ...initialState }
    }
  });
};

// Helper function to create mock messages
const createMockMessage = (data: Partial<Message> = {}): Message => ({
  id: crypto.randomUUID() as UUID,
  content: 'Test message',
  role: MessageRole.USER,
  timestamp: new Date(),
  sessionId: crypto.randomUUID() as UUID,
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
  ...data
});

// Helper function to create mock sessions
const createMockSession = (data: Partial<ChatSession> = {}): ChatSession => ({
  id: crypto.randomUUID() as UUID,
  title: 'Test Session',
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [],
  status: ChatSessionStatus.ACTIVE,
  ...data
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
    store.dispatch(actions.setCurrentSession(mockSession));
    
    const state = store.getState().chat;
    expect(state.currentSession).toEqual(mockSession);
    expect(state.wsStatus).toBe(WebSocketStatus.DISCONNECTED);
  });

  it('should handle adding new message with processing status', () => {
    const mockSession = createMockSession();
    const mockMessage = createMockMessage({ sessionId: mockSession.id });
    
    store.dispatch(actions.setCurrentSession(mockSession));
    store.dispatch(actions.addMessage(mockMessage));
    
    const state = store.getState().chat;
    expect(state.currentSession?.messages).toContainEqual(mockMessage);
  });

  it('should handle setting WebSocket connection states', () => {
    store.dispatch(actions.updateWebSocketStatus(WebSocketStatus.CONNECTING));
    expect(store.getState().chat.wsStatus).toBe(WebSocketStatus.CONNECTING);

    store.dispatch(actions.updateWebSocketStatus(WebSocketStatus.CONNECTED));
    expect(store.getState().chat.wsStatus).toBe(WebSocketStatus.CONNECTED);
  });

  it('should handle setting message processing states', () => {
    const mockSession = createMockSession();
    const mockMessage = createMockMessage({ sessionId: mockSession.id });
    
    store.dispatch(actions.setCurrentSession(mockSession));
    store.dispatch(actions.addMessage(mockMessage));
    store.dispatch(actions.updateMessageStatus({ 
      messageId: mockMessage.id, 
      status: 'delivered' 
    }));
    
    const state = store.getState().chat;
    const updatedMessage = state.currentSession?.messages.find(m => m.id === mockMessage.id);
    expect(updatedMessage?.processingStatus).toBe('delivered');
  });

  it('should handle setting error state with details', () => {
    const mockError = {
      message: 'Test error',
      code: 'TEST_ERROR',
      details: { foo: 'bar' }
    };
    
    store.dispatch(actions.setError(mockError));
    expect(store.getState().chat.error).toEqual(mockError);
    
    store.dispatch(actions.clearError());
    expect(store.getState().chat.error).toEqual({
      message: null,
      code: null,
      details: null
    });
  });
});

describe('chatSlice async thunks', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    store = setupStore();
    jest.clearAllMocks();
  });

  it('sendMessage should handle successful message send with processing status', async () => {
    const mockMessage = createMockMessage();
    const mockResponse = { ...mockMessage, processingStatus: 'delivered' };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    await store.dispatch(sendMessage({
      content: mockMessage.content,
      sessionId: mockMessage.sessionId
    }));

    const state = store.getState().chat;
    expect(state.loading.sendMessage).toBe(false);
    expect(state.currentSession?.messages).toContainEqual(mockResponse);
  });

  it('sendMessage should handle API error with detailed error state', async () => {
    const mockError = {
      message: 'API Error',
      code: 'API_ERROR',
      details: { status: 500 }
    };

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve(mockError)
    });

    await store.dispatch(sendMessage({
      content: 'test',
      sessionId: crypto.randomUUID() as UUID
    }));

    const state = store.getState().chat;
    expect(state.loading.sendMessage).toBe(false);
    expect(state.error).toEqual(mockError);
  });

  it('loadChatHistory should load messages with pagination', async () => {
    const mockMessages = [createMockMessage(), createMockMessage()];
    
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: mockMessages, hasMore: false })
    });

    await store.dispatch(loadChatHistory({
      sessionId: crypto.randomUUID() as UUID,
      page: 1
    }));

    const state = store.getState().chat;
    expect(state.loading.loadHistory).toBe(false);
    expect(state.currentSession?.messages).toEqual(mockMessages);
  });
});

describe('chatSlice selectors', () => {
  let store: ReturnType<typeof setupStore>;

  beforeEach(() => {
    store = setupStore();
  });

  it('selectCurrentSession should return current session with connection status', () => {
    const mockSession = createMockSession();
    store.dispatch(actions.setCurrentSession(mockSession));
    
    const currentSession = selectCurrentSession(store.getState());
    expect(currentSession).toEqual(mockSession);
  });

  it('selectSessions should return sorted sessions with metadata', () => {
    const mockSessions = [
      createMockSession({ updatedAt: new Date('2024-01-01') }),
      createMockSession({ updatedAt: new Date('2024-01-02') })
    ];
    
    store.dispatch(actions.setSessions(mockSessions));
    
    const sessions = selectSessions(store.getState());
    expect(sessions).toHaveLength(2);
    expect(sessions[0].updatedAt).toBeGreaterThan(sessions[1].updatedAt);
  });
});