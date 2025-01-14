import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ApiResponse } from '../../types/common';

/**
 * Interface for notification state with advanced configuration
 */
export interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
  autoClose: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onClick: (() => void) | null;
  priority: number;
}

/**
 * Interface for responsive breakpoints state
 */
interface Breakpoints {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
}

/**
 * Interface for the UI slice state
 */
export interface UIState {
  theme: 'light' | 'dark';
  previousTheme: 'light' | 'dark' | null;
  sidebarOpen: boolean;
  isMobile: boolean;
  orientation: 'portrait' | 'landscape';
  breakpoints: Breakpoints;
  notifications: NotificationState[];
  notificationQueue: NotificationState[];
  modals: Record<string, boolean>;
  modalStack: string[];
  loadingStates: Record<string, boolean>;
}

/**
 * Initial state for the UI slice
 */
const initialState: UIState = {
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  previousTheme: null,
  sidebarOpen: window.innerWidth >= 1024,
  isMobile: window.innerWidth < 768,
  orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
  breakpoints: {
    isMobile: window.innerWidth < 768,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
    width: window.innerWidth
  },
  notifications: [],
  notificationQueue: [],
  modals: {},
  modalStack: [],
  loadingStates: {}
};

/**
 * Redux Toolkit slice for UI state management
 */
export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.previousTheme = state.theme;
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
      document.documentElement.classList.remove(state.previousTheme);
      document.documentElement.classList.add(action.payload);
      document.querySelector('meta[name="theme-color"]')?.setAttribute(
        'content',
        action.payload === 'dark' ? '#1a1a1a' : '#ffffff'
      );
    },

    updateBreakpoints: (state, action: PayloadAction<number>) => {
      const width = action.payload;
      state.breakpoints = {
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        width
      };
      state.isMobile = width < 768;
      state.orientation = window.innerHeight > width ? 'portrait' : 'landscape';
      
      // Auto-close sidebar on mobile
      if (state.isMobile && state.sidebarOpen) {
        state.sidebarOpen = false;
      }
    },

    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },

    showNotification: (state, action: PayloadAction<Omit<NotificationState, 'id'>>) => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const notification: NotificationState = {
        ...action.payload,
        id,
        duration: action.payload.duration || 5000,
        autoClose: action.payload.autoClose ?? true,
        position: action.payload.position || 'top-right',
        priority: action.payload.priority || 0
      };

      const MAX_VISIBLE_NOTIFICATIONS = 3;

      if (state.notifications.length >= MAX_VISIBLE_NOTIFICATIONS) {
        state.notificationQueue.push(notification);
        state.notificationQueue.sort((a, b) => b.priority - a.priority);
      } else {
        state.notifications.push(notification);
      }
    },

    dismissNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
      
      if (state.notificationQueue.length > 0) {
        const [nextNotification, ...remainingQueue] = state.notificationQueue;
        state.notifications.push(nextNotification);
        state.notificationQueue = remainingQueue;
      }
    },

    setModalState: (state, action: PayloadAction<{ modalId: string; isOpen: boolean }>) => {
      const { modalId, isOpen } = action.payload;
      state.modals[modalId] = isOpen;

      if (isOpen) {
        state.modalStack = [...state.modalStack.filter(id => id !== modalId), modalId];
      } else {
        state.modalStack = state.modalStack.filter(id => id !== modalId);
      }

      // Update document body scroll lock
      document.body.style.overflow = state.modalStack.length > 0 ? 'hidden' : 'auto';
    },

    setLoadingState: (state, action: PayloadAction<{ key: string; isLoading: boolean }>) => {
      const { key, isLoading } = action.payload;
      state.loadingStates[key] = isLoading;
    },

    showApiNotification: (state, action: PayloadAction<ApiResponse<unknown>>) => {
      const { success, message } = action.payload;
      if (message) {
        const notification: Omit<NotificationState, 'id'> = {
          type: success ? 'success' : 'error',
          message,
          duration: 5000,
          autoClose: true,
          position: 'top-right',
          onClick: null,
          priority: success ? 0 : 1
        };
        uiSlice.caseReducers.showNotification(state, { 
          type: 'ui/showNotification', 
          payload: notification 
        });
      }
    }
  }
});

// Export actions and reducer
export const {
  setTheme,
  updateBreakpoints,
  toggleSidebar,
  showNotification,
  dismissNotification,
  setModalState,
  setLoadingState,
  showApiNotification
} = uiSlice.actions;

export default uiSlice.reducer;