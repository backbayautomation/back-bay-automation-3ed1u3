import { configureStore } from '@reduxjs/toolkit'; // v1.9.5
import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // v29.7.0
import {
  reducer,
  actions,
  sendMessage,
  loadChatHistory,
  selectCurrentSession,
  selectSessions,
} from '../../src/redux/slices/chatSlice';
import { ChatState, WebSocketStatus, MessageRole } from '../../src/types/chat';
import type { MockStore } from '@reduxjs/toolkit/dist/query/react'; // v1.9.5

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
const createMockMessage = (data: Partial<Message> = {}) => ({
  id: crypto.randomUUID(),
  content: 'Test message',
  role: MessageRole.USER,
  timestamp: new Date(),
  sessionId: crypto.randomUUID(),
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
const createMockSession = (data: Partial<ChatSession> = {}) => ({
  id: crypto.randomUUID(),
  title: 'Test Session',
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [],
  status: ChatSessionStatus.ACTIVE,
  ...data
});

describe('chatSlice reducer', () => {
  let store: MockStore;

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
  });

  it('should handle adding new session with connection tracking', () => {
    const mockSession = createMockSession();
    store.dispatch(actions.addSession(mockSession));
    const state = store.getState().chat;
    expect(state.sessions).toContainEqual(mockSession);
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

  it('should handle setting error state with details', () => {
    const mockError = {
      message: 'Test error',
      code: 'TEST_ERROR',
      details: { test: true }
    };
    store.dispatch(actions.setError(mockError));
    expect(store.getState().chat.error).toEqual(mockError);
  });
});

describe('chatSlice async thunks', () => {
  let store: MockStore;

  beforeEach(() => {
    store = setupStore();
  });

  it('sendMessage should handle successful message send with processing status', async () => {
    const mockSession = createMockSession();
    const mockMessage = {
      content: 'Test message',
      sessionId: mockSession.id
    };

    store.dispatch(actions.setCurrentSession(mockSession));
    await store.dispatch(sendMessage(mockMessage));

    const state = store.getState().chat;
    expect(state.loading.sendMessage).toBe(false);
    expect(state.currentSession?.messages.length).toBe(1);
    expect(state.error.message).toBeNull();
  });

  it('sendMessage should handle API error with detailed error state', async () => {
    const mockError = new Error('API Error');
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(mockError);

    const mockSession = createMockSession();
    const mockMessage = {
      content: 'Test message',
      sessionId: mockSession.id
    };

    store.dispatch(actions.setCurrentSession(mockSession));
    await store.dispatch(sendMessage(mockMessage));

    const state = store.getState().chat;
    expect(state.loading.sendMessage).toBe(false);
    expect(state.error.message).toBe('API Error');
    expect(state.error.code).toBe('SEND_MESSAGE_ERROR');
  });

  it('loadChatHistory should load messages with pagination', async () => {
    const mockSession = createMockSession();
    const mockMessages = [
      createMockMessage({ sessionId: mockSession.id }),
      createMockMessage({ sessionId: mockSession.id })
    ];

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: () => Promise.resolve({ messages: mockMessages }),
      ok: true
    } as Response);

    await store.dispatch(loadChatHistory({ sessionId: mockSession.id, page: 1 }));

    const state = store.getState().chat;
    expect(state.loading.loadHistory).toBe(false);
    expect(state.currentSession?.messages).toEqual(mockMessages);
  });
});

describe('chatSlice selectors', () => {
  let store: MockStore;

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
      createMockSession({ createdAt: new Date('2024-01-01') }),
      createMockSession({ createdAt: new Date('2024-01-02') })
    ];

    mockSessions.forEach(session => store.dispatch(actions.addSession(session)));
    const sessions = selectSessions(store.getState());
    expect(sessions).toHaveLength(2);
    expect(sessions[0].createdAt > sessions[1].createdAt).toBe(true);
  });

  it('selectWebSocketStatus should return current connection state', () => {
    store.dispatch(actions.updateWebSocketStatus(WebSocketStatus.CONNECTED));
    const wsStatus = selectWebSocketStatus(store.getState());
    expect(wsStatus).toBe(WebSocketStatus.CONNECTED);
  });
});