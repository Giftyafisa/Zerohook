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

const userAPI = {
  // Get user profile
  getProfile: async () => {
    try {
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error) {
      // Fallback to mock data if backend is not available
      if (error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
        return {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          verificationTier: 'Basic',
          reputationScore: 100,
          trustScore: 85,
          location: 'Lagos, Nigeria',
          bio: 'This is a test user profile',
          createdAt: new Date().toISOString()
        };
      }
      throw error;
    }
  },

  // Update user profile
  updateProfile: async (profileData) => {
    try {
      const response = await api.put('/users/profile', profileData);
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
      
      const response = await api.post('/uploads/profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user verification status
  getVerificationStatus: async () => {
    try {
      const response = await api.get('/users/verification-status');
      return response.data;
    } catch (error) {
      // Fallback to mock data if backend is not available
      if (error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
        return {
          tier: 'Basic',
          documents: [],
          status: 'pending',
          nextTier: 'Premium'
        };
      }
      throw error;
    }
  }
};

export default userAPI;
