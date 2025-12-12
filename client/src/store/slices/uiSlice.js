import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sidebarOpen: false,
  theme: 'light',
  notifications: [],
  loading: false,
  // Global unread counts for badges
  unreadNotifications: 0,
  unreadMessages: 0,
  // Notification list from server
  notificationsList: []
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    addNotification: (state, action) => {
      state.notifications.push(action.payload);
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    // Unread notification count actions
    setUnreadNotifications: (state, action) => {
      state.unreadNotifications = action.payload;
    },
    incrementUnreadNotifications: (state) => {
      state.unreadNotifications += 1;
    },
    decrementUnreadNotifications: (state) => {
      state.unreadNotifications = Math.max(0, state.unreadNotifications - 1);
    },
    clearUnreadNotifications: (state) => {
      state.unreadNotifications = 0;
    },
    // Unread message count actions
    setUnreadMessages: (state, action) => {
      state.unreadMessages = action.payload;
    },
    incrementUnreadMessages: (state) => {
      state.unreadMessages += 1;
    },
    decrementUnreadMessages: (state, action) => {
      // Can decrement by a specific amount (e.g., when marking conversation as read)
      const decrementBy = action.payload || 1;
      state.unreadMessages = Math.max(0, state.unreadMessages - decrementBy);
    },
    clearUnreadMessages: (state) => {
      state.unreadMessages = 0;
    },
    // Server notifications list
    setNotificationsList: (state, action) => {
      state.notificationsList = action.payload;
    },
    addToNotificationsList: (state, action) => {
      state.notificationsList.unshift(action.payload);
    },
    markNotificationRead: (state, action) => {
      const notification = state.notificationsList.find(n => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    removeFromNotificationsList: (state, action) => {
      state.notificationsList = state.notificationsList.filter(n => n.id !== action.payload);
    }
  }
});

export const { 
  toggleSidebar, 
  setSidebarOpen, 
  setTheme, 
  addNotification, 
  removeNotification, 
  setLoading,
  setUnreadNotifications,
  incrementUnreadNotifications,
  decrementUnreadNotifications,
  clearUnreadNotifications,
  setUnreadMessages,
  incrementUnreadMessages,
  decrementUnreadMessages,
  clearUnreadMessages,
  setNotificationsList,
  addToNotificationsList,
  markNotificationRead,
  removeFromNotificationsList
} = uiSlice.actions;

export const selectSidebarOpen = (state) => state.ui.sidebarOpen;
export const selectTheme = (state) => state.ui.theme;
export const selectNotifications = (state) => state.ui.notifications;
export const selectUILoading = (state) => state.ui.loading;
export const selectUnreadNotifications = (state) => state.ui.unreadNotifications;
export const selectUnreadMessages = (state) => state.ui.unreadMessages;
export const selectNotificationsList = (state) => state.ui.notificationsList;

export default uiSlice.reducer;
