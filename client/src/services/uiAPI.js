import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const uiAPI = {
  // Get app settings
  getAppSettings: async () => {
    try {
      const response = await api.get('/ui/settings');
      return response.data;
    } catch (error) {
      // Fallback to mock data if backend is not available
      if (error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
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
      const response = await api.put('/ui/settings', settings);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get notifications
  getNotifications: async () => {
    try {
      const response = await api.get('/ui/notifications');
      return response.data;
    } catch (error) {
      // Fallback to mock data if backend is not available
      if (error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
        return {
          notifications: [
            {
              id: 1,
              type: 'info',
              title: 'Welcome to Hkup!',
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
      const response = await api.patch(`/ui/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default uiAPI;
