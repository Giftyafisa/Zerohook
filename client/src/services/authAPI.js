import apiClient, { API_BASE_URL } from './apiClient';

/**
 * Auth API service — uses the shared apiClient for consistent token refresh
 * and 401 handling via the centralized mutex-based queue.
 */

const authAPI = {
  // Register new user
  register: async (userData) => {
    try {
      const response = await apiClient.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      console.error('Registration API error:', error);
      throw error;
    }
  },

  // Login user
  login: async (credentials) => {
    try {
      const response = await apiClient.post('/auth/login', credentials);
      return response.data;
    } catch (error) {
      console.error('Login API error:', error);
      throw error;
    }
  },

  // Refresh token (with rotation - pass refresh token)
  refresh: async (refreshToken) => {
    try {
      const response = await apiClient.post('/auth/refresh', {
        refreshToken: refreshToken || undefined
      });
      return response.data;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  },

  // Validate stored token (public endpoint)
  validateStoredToken: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      
      if (!response.ok) {
        throw new Error(`Token validation request failed: ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('Token validation error:', error);
      throw error;
    }
  },

  // Verify identity tier
  verifyTier: async (verificationData) => {
    try {
      const response = await apiClient.post('/auth/verify-tier', verificationData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Logout (client-side only for now)
  logout: async () => {
    try {
      const response = await apiClient.post('/auth/logout');
      return response.data;
    } catch (error) {
      // Logout should always succeed even if API fails
      return { message: 'Logged out successfully' };
    }
  },

  // Get user profile
  getProfile: async () => {
    try {
      const response = await apiClient.get('/users/profile');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update user profile
  updateProfile: async (profileData) => {
    try {
      const response = await apiClient.put('/users/profile', { profile_data: profileData });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get dashboard stats
  getDashboardStats: async () => {
    try {
      const response = await apiClient.get('/dashboard/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user transactions
  getTransactions: async () => {
    try {
      const response = await apiClient.get('/transactions');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new service
  createService: async (serviceData) => {
    try {
      const response = await apiClient.post('/services', serviceData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Upload profile picture
  uploadProfilePicture: async (file) => {
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      const response = await apiClient.post('/uploads/profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default authAPI;
