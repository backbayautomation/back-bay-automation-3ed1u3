/**
 * @fileoverview Redux slice for managing chat state with real-time functionality
 * @version 1.0.0
 */

// External imports - @reduxjs/toolkit v1.9.5
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Internal imports
import { 
    ChatState, 
    WebSocketStatus, 
    Message, 
    ChatSession,
    MessageRole,
    NewMessage
} from '../../types/chat';

/**
 * Interface for detailed error tracking
 */
interface ChatError {
    message: string | null;
    code: string | null;
    details: Record<string, unknown> | null;
}

/**
 * Interface for granular loading states
 */
interface LoadingState {
    sendMessage: boolean;
    loadHistory: boolean;
}

/**
 * Initial state for chat slice
 */
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

/**
 * Async thunk for sending chat messages
 */
export const sendMessage = createAsyncThunk(
    'chat/sendMessage',
    async (message: NewMessage, { rejectWithValue }) => {
        try {
            // Validate inputs
            if (!message.content.trim() || !message.sessionId) {
                throw new Error('Invalid message parameters');
            }

            // API call would go here
            const response = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message)
            });

            if (!response.ok) {
                throw new Error('Message send failed');
            }

            return await response.json();
        } catch (error) {
            return rejectWithValue({
                message: error instanceof Error ? error.message : 'Unknown error',
                code: 'SEND_MESSAGE_ERROR',
                details: { error }
            });
        }
    }
);

/**
 * Chat slice definition with enhanced error handling and WebSocket support
 */
const chatSlice = createSlice({
    name: 'chat',
    initialState,
    reducers: {
        setCurrentSession(state, action: PayloadAction<ChatSession | null>) {
            state.currentSession = action.payload;
        },
        updateWebSocketStatus(state, action: PayloadAction<WebSocketStatus>) {
            state.wsStatus = action.payload;
            // Reset error state on successful connection
            if (action.payload === WebSocketStatus.CONNECTED) {
                state.error = initialState.error;
            }
        },
        addMessage(state, action: PayloadAction<Message>) {
            if (state.currentSession) {
                state.currentSession.messages.push(action.payload);
            }
        },
        updateMessageStatus(state, action: PayloadAction<{ 
            sessionId: string; 
            messageId: string; 
            status: string; 
        }>) {
            const session = state.sessions.find(s => s.id === action.payload.sessionId);
            if (session) {
                const message = session.messages.find(m => m.id === action.payload.messageId);
                if (message) {
                    message.metadata = {
                        ...message.metadata,
                        processingStatus: action.payload.status
                    };
                }
            }
        },
        clearError(state) {
            state.error = initialState.error;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(sendMessage.pending, (state) => {
                state.loading.sendMessage = true;
                state.error = initialState.error;
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
                    message: action.payload as string ?? 'Message send failed',
                    code: 'SEND_MESSAGE_ERROR',
                    details: action.error
                };
            });
    }
});

// Export actions
export const { 
    setCurrentSession, 
    updateWebSocketStatus, 
    addMessage, 
    updateMessageStatus,
    clearError 
} = chatSlice.actions;

// Export selectors
export const selectCurrentSession = (state: { chat: ChatState }) => 
    state.chat.currentSession;

export const selectWebSocketStatus = (state: { chat: ChatState }) => 
    state.chat.wsStatus;

export const selectMessageError = (state: { chat: ChatState }) => 
    state.chat.error;

export const selectMessageLoadingState = (state: { chat: ChatState }) => 
    state.chat.loading;

// Export reducer
export default chatSlice.reducer;