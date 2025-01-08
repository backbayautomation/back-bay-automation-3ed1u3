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
 * Interface for the UI slice state with responsive design support
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

const initialState: UIState = {
  theme: 'light',
  previousTheme: null,
  sidebarOpen: true,
  isMobile: false,
  orientation: 'portrait',
  breakpoints: {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
  },
  notifications: [],
  notificationQueue: [],
  modals: {},
  modalStack: [],
  loadingStates: {},
};

/**
 * Redux Toolkit slice for managing global UI state
 */
export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.previousTheme = state.theme;
      state.theme = action.payload;
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', action.payload);
        document.documentElement.classList.remove(state.previousTheme);
        document.documentElement.classList.add(action.payload);
        
        // Update meta theme-color
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
          metaThemeColor.setAttribute('content', 
            action.payload === 'dark' ? '#1a1a1a' : '#ffffff'
          );
        }
      }
    },

    updateBreakpoints: (state, action: PayloadAction<number>) => {
      const width = action.payload;
      state.breakpoints = {
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        width,
      };
      
      // Update mobile state and sidebar visibility
      state.isMobile = state.breakpoints.isMobile;
      if (state.isMobile && state.sidebarOpen) {
        state.sidebarOpen = false;
      }
      
      // Update orientation
      if (typeof window !== 'undefined') {
        state.orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
      }
    },

    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },

    showNotification: (state, action: PayloadAction<NotificationState>) => {
      const notification = {
        ...action.payload,
        id: action.payload.id || `notification-${Date.now()}-${Math.random()}`,
        duration: action.payload.duration || 5000,
        autoClose: action.payload.autoClose ?? true,
        position: action.payload.position || 'top-right',
        priority: action.payload.priority || 0,
      };

      const MAX_VISIBLE_NOTIFICATIONS = 3;

      if (state.notifications.length >= MAX_VISIBLE_NOTIFICATIONS) {
        state.notificationQueue.push(notification);
        state.notificationQueue.sort((a, b) => b.priority - a.priority);
      } else {
        state.notifications.push(notification);
      }
    },

    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
      
      if (state.notificationQueue.length > 0) {
        const nextNotification = state.notificationQueue.shift();
        if (nextNotification) {
          state.notifications.push(nextNotification);
        }
      }
    },

    setModalState: (state, action: PayloadAction<{ modalId: string; isOpen: boolean }>) => {
      const { modalId, isOpen } = action.payload;
      
      if (isOpen) {
        state.modalStack = state.modalStack.filter(id => id !== modalId);
        state.modalStack.push(modalId);
      } else {
        state.modalStack = state.modalStack.filter(id => id !== modalId);
      }
      
      state.modals = {
        ...state.modals,
        [modalId]: isOpen,
      };
    },

    setLoadingState: (state, action: PayloadAction<{ key: string; isLoading: boolean }>) => {
      const { key, isLoading } = action.payload;
      state.loadingStates[key] = isLoading;
    },

    showApiNotification: (state, action: PayloadAction<ApiResponse<any>>) => {
      const { success, message } = action.payload;
      if (message) {
        const notification: NotificationState = {
          id: `api-notification-${Date.now()}`,
          type: success ? 'success' : 'error',
          message,
          duration: 5000,
          autoClose: true,
          position: 'top-right',
          onClick: null,
          priority: success ? 0 : 1,
        };
        
        if (state.notifications.length >= 3) {
          state.notificationQueue.push(notification);
          state.notificationQueue.sort((a, b) => b.priority - a.priority);
        } else {
          state.notifications.push(notification);
        }
      }
    },

    clearAllNotifications: (state) => {
      state.notifications = [];
      state.notificationQueue = [];
    },
  },
});

// Export actions and reducer
export const {
  setTheme,
  updateBreakpoints,
  toggleSidebar,
  showNotification,
  removeNotification,
  setModalState,
  setLoadingState,
  showApiNotification,
  clearAllNotifications,
} = uiSlice.actions;

export default uiSlice.reducer;