import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5
import { 
  ChatState, 
  WebSocketStatus, 
  Message, 
  ChatSession,
  MessageRole,
  UUID
} from '../../types/chat';

// Enhanced error interface for detailed error tracking
interface ChatError {
  message: string | null;
  code: string | null;
  details: Record<string, unknown> | null;
}

// Enhanced loading state interface for granular loading tracking
interface LoadingState {
  sendMessage: boolean;
  loadHistory: boolean;
}

// Enhanced initial state with detailed error and loading tracking
const initialState: ChatState & { 
  loading: LoadingState; 
  error: ChatError;
  wsStatus: WebSocketStatus;
} = {
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

// Async thunk for sending messages with enhanced error handling
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ 
    content, 
    sessionId, 
    metadata 
  }: { 
    content: string; 
    sessionId: UUID; 
    metadata?: Record<string, unknown>; 
  }, { rejectWithValue }) => {
    try {
      // Validate inputs
      if (!content.trim()) {
        throw new Error('Message content cannot be empty');
      }

      // Create message object
      const message: Partial<Message> = {
        content,
        role: MessageRole.USER,
        sessionId,
        metadata,
        timestamp: new Date()
      };

      // API call would go here
      // For now, return the message as is
      return message as Message;
    } catch (error) {
      return rejectWithValue({
        message: error instanceof Error ? error.message : 'Failed to send message',
        code: 'SEND_MESSAGE_ERROR',
        details: { sessionId, timestamp: new Date() }
      });
    }
  }
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Update WebSocket connection status
    updateWebSocketStatus(state, action: PayloadAction<WebSocketStatus>) {
      state.wsStatus = action.payload;
    },

    // Set current chat session
    setCurrentSession(state, action: PayloadAction<ChatSession | null>) {
      state.currentSession = action.payload;
    },

    // Add new chat session
    addSession(state, action: PayloadAction<ChatSession>) {
      state.sessions.push(action.payload);
    },

    // Update existing chat session
    updateSession(state, action: PayloadAction<ChatSession>) {
      const index = state.sessions.findIndex(s => s.id === action.payload.id);
      if (index !== -1) {
        state.sessions[index] = action.payload;
      }
    },

    // Clear error state
    clearError(state) {
      state.error = {
        message: null,
        code: null,
        details: null
      };
    },

    // Add message to current session
    addMessage(state, action: PayloadAction<Message>) {
      if (state.currentSession) {
        state.currentSession.messages.push(action.payload);
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle sendMessage async thunk states
      .addCase(sendMessage.pending, (state) => {
        state.loading.sendMessage = true;
        state.error = {
          message: null,
          code: null,
          details: null
        };
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.loading.sendMessage = false;
        if (state.currentSession) {
          state.currentSession.messages.push(action.payload);
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.loading.sendMessage = false;
        state.error = {
          message: action.payload as string ?? 'Failed to send message',
          code: 'SEND_MESSAGE_ERROR',
          details: action.error as Record<string, unknown>
        };
      });
  }
});

// Export actions
export const { 
  updateWebSocketStatus, 
  setCurrentSession, 
  addSession, 
  updateSession, 
  clearError,
  addMessage 
} = chatSlice.actions;

// Selectors
export const selectCurrentSession = (state: { chat: ChatState }) => 
  state.chat.currentSession;

export const selectWebSocketStatus = (state: { chat: ChatState }) => 
  state.chat.wsStatus;

export const selectMessageError = (state: { chat: ChatState }) => 
  state.chat.error;

export const selectMessageLoadingState = (state: { chat: ChatState }) => 
  state.chat.loading;

export const selectSessions = (state: { chat: ChatState }) => 
  state.chat.sessions;

// Export reducer
export default chatSlice.reducer;