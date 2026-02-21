import apiClient from './apiClient';

const uiAPI = {
  // Get app settings
  getAppSettings: async () => {
    try {
      const response = await apiClient.get('/ui/settings');
      return response.data;
    } catch (error) {
      // Only return mock data in development
      if (process.env.NODE_ENV === 'development' && (error.code === 'ERR_NETWORK' || error.response?.status >= 500)) {
        console.warn('Using mock data for getAppSettings:', error.message);
        return {
          theme: 'light',
          language: 'en',
          notifications: {
            email: true,
            push: true,
            sms: false
          },
          privacy: {
            profileVisibility: 'public',
            showLocation: true,
            showOnlineStatus: true
          }
        };
      }
      throw error;
    }
  },

  // Update app settings
  updateAppSettings: async (settings) => {
    try {
      const response = await apiClient.put('/ui/settings', settings);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get notifications
  getNotifications: async () => {
    try {
      const response = await apiClient.get('/ui/notifications');
      return response.data;
    } catch (error) {
      // Only return mock data in development
      if (process.env.NODE_ENV === 'development' && (error.code === 'ERR_NETWORK' || error.response?.status >= 500)) {
        console.warn('Using mock data for getNotifications:', error.message);
        return {
          notifications: [
            {
              id: 1,
              type: 'info',
              title: 'Welcome to Zerohook!',
              message: 'Your account has been successfully created.',
              read: false,
              date: new Date().toISOString()
            },
            {
              id: 2,
              type: 'success',
              title: 'Profile Verified',
              message: 'Your profile has been verified successfully.',
              read: true,
              date: new Date(Date.now() - 86400000).toISOString()
            }
          ]
        };
      }
      throw error;
    }
  },

  // Mark notification as read
  markNotificationRead: async (notificationId) => {
    try {
      const response = await apiClient.patch(`/ui/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default uiAPI;
