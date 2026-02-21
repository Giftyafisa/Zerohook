import apiClient from './apiClient';

const userAPI = {
  // Get user profile
  getProfile: async () => {
    try {
      const response = await apiClient.get('/users/profile');
      return response.data;
    } catch (error) {
      // Only return mock data in development
      if (process.env.NODE_ENV === 'development' && (error.code === 'ERR_NETWORK' || error.response?.status >= 500)) {
        console.warn('Using mock data for getProfile:', error.message);
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
      const response = await apiClient.put('/users/profile', profileData);
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
      const response = await apiClient.get('/users/verification-status');
      return response.data;
    } catch (error) {
      // Only return mock data in development
      if (process.env.NODE_ENV === 'development' && (error.code === 'ERR_NETWORK' || error.response?.status >= 500)) {
        console.warn('Using mock data for getVerificationStatus:', error.message);
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
