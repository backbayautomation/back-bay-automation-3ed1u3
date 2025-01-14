/**
 * @fileoverview Redux slice for managing chat state with real-time functionality
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5
import { 
  ChatState, 
  WebSocketStatus, 
  Message, 
  MessageRole,
  ChatSession,
  NewMessage
} from '../../types/chat';
import { UUID } from 'crypto';

/**
 * Processing status for messages
 */
enum ProcessingStatus {
  IDLE = 'idle',
  SENDING = 'sending',
  DELIVERED = 'delivered',
  FAILED = 'failed'
}

/**
 * Detailed error state interface
 */
interface ChatError {
  message: string | null;
  code: string | null;
  details: Record<string, unknown> | null;
}

/**
 * Loading states interface for granular tracking
 */
interface LoadingState {
  sendMessage: boolean;
  loadHistory: boolean;
}

/**
 * Initial state with enhanced error handling and loading states
 */
const initialState: ChatState = {
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

/**
 * Async thunk for sending messages with enhanced error handling
 */
export const sendMessage = createAsyncThunk<Message, NewMessage>(
  'chat/sendMessage',
  async (message: NewMessage, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue({
          message: error.message,
          code: error.code,
          details: error.details
        });
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue({
        message: 'Failed to send message',
        code: 'NETWORK_ERROR',
        details: { error }
      });
    }
  }
);

/**
 * Chat slice with enhanced functionality
 */
const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    updateWebSocketStatus(state, action: PayloadAction<WebSocketStatus>) {
      state.wsStatus = action.payload;
    },
    
    setCurrentSession(state, action: PayloadAction<ChatSession>) {
      state.currentSession = action.payload;
    },
    
    addMessage(state, action: PayloadAction<Message>) {
      if (state.currentSession) {
        state.currentSession.messages.push(action.payload);
      }
    },
    
    updateMessageStatus(
      state, 
      action: PayloadAction<{ messageId: UUID; status: ProcessingStatus }>
    ) {
      if (state.currentSession) {
        const message = state.currentSession.messages.find(
          m => m.id === action.payload.messageId
        );
        if (message) {
          message.processingStatus = action.payload.status;
        }
      }
    },
    
    clearError(state) {
      state.error = {
        message: null,
        code: null,
        details: null
      };
    }
  },
  extraReducers: (builder) => {
    builder
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
        state.error = action.payload as ChatError;
      });
  }
});

// Selectors
export const selectCurrentSession = (state: { chat: ChatState }) => 
  state.chat.currentSession;

export const selectWebSocketStatus = (state: { chat: ChatState }) => 
  state.chat.wsStatus;

export const selectMessageError = (state: { chat: ChatState }) => 
  state.chat.error;

export const selectMessageLoadingState = (state: { chat: ChatState }) => 
  state.chat.loading;

export const selectMessages = (state: { chat: ChatState }) => 
  state.chat.currentSession?.messages ?? [];

// Export actions and reducer
export const { 
  updateWebSocketStatus, 
  setCurrentSession, 
  addMessage, 
  updateMessageStatus,
  clearError 
} = chatSlice.actions;

export default chatSlice.reducer;