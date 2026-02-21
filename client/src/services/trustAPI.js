import apiClient from './apiClient';

const trustAPI = {
  // Get user trust score
  getTrustScore: async () => {
    try {
      const response = await apiClient.get('/trust/score');
      return response.data;
    } catch (error) {
      // Only return mock data in development
      if (process.env.NODE_ENV === 'development' && (error.code === 'ERR_NETWORK' || error.response?.status >= 500)) {
        console.warn('Using mock data for getTrustScore:', error.message);
        return {
          score: 85,
          tier: 'High',
          factors: [
            { name: 'Verification', score: 90, weight: 0.3 },
            { name: 'Reputation', score: 85, weight: 0.25 },
            { name: 'Activity', score: 80, weight: 0.2 },
            { name: 'Community', score: 75, weight: 0.15 },
            { name: 'Security', score: 95, weight: 0.1 }
          ],
          nextTier: 'Elite',
          nextTierThreshold: 90
        };
      }
      throw error;
    }
  },

  // Get user reputation
  getReputation: async () => {
    try {
      const response = await apiClient.get('/trust/reputation');
      return response.data;
    } catch (error) {
      // Only return mock data in development
      if (process.env.NODE_ENV === 'development' && (error.code === 'ERR_NETWORK' || error.response?.status >= 500)) {
        console.warn('Using mock data for getReputation:', error.message);
        return {
          score: 100,
          reviews: 25,
          rating: 4.8,
          badges: ['Verified', 'Trusted', 'Active'],
          history: [
            { date: new Date().toISOString(), action: 'Service completed', points: 5 },
            { date: new Date(Date.now() - 86400000).toISOString(), action: 'Profile verified', points: 10 }
          ]
        };
      }
      throw error;
    }
  },

  // Submit review
  submitReview: async (reviewData) => {
    try {
      const response = await apiClient.post('/trust/reviews', reviewData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Report user
  reportUser: async (reportData) => {
    try {
      const response = await apiClient.post('/trust/reports', reportData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default trustAPI;
