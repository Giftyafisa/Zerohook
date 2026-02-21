import apiClient from './apiClient';

const servicesAPI = {
  // Get all services
  getServices: async (filters = {}) => {
    try {
      const response = await apiClient.get('/services', { params: filters });
      return response.data;
    } catch (error) {
      // Only return mock data in development
      if (process.env.NODE_ENV === 'development' && (error.code === 'ERR_NETWORK' || error.response?.status >= 500)) {
        console.warn('Using mock data for getServices:', error.message);
        return {
          services: [
            {
              id: 1,
              title: 'Premium Dating Service',
              description: 'High-quality dating service with verified profiles',
              category: 'Long Term',
              price: 150,
              location: 'Lagos, Nigeria',
              rating: 4.8,
              reviews: 127,
              verified: true
            },
            {
              id: 2,
              title: 'Casual Dating',
              description: 'Casual dating and short-term connections',
              category: 'Short Term',
              price: 100,
              location: 'Abuja, Nigeria',
              rating: 4.5,
              reviews: 89,
              verified: true
            }
          ],
          categories: ['Long Term', 'Short Term', 'BJ', 'SCV']
        };
      }
      throw error;
    }
  },

  // Get service by ID
  getServiceById: async (id) => {
    try {
      const response = await apiClient.get(`/services/${id}`);
      return response.data;
    } catch (error) {
      // Only return mock data in development
      if (process.env.NODE_ENV === 'development' && (error.code === 'ERR_NETWORK' || error.response?.status >= 500)) {
        console.warn('Using mock data for getServiceById:', error.message);
        return {
          id: id,
          title: 'Premium Dating Service',
          description: 'High-quality dating service with verified profiles',
          category: 'Long Term',
          price: 150,
          location: 'Lagos, Nigeria',
          rating: 4.8,
          reviews: 127,
          verified: true,
          photos: [
            'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400'
          ],
          provider: {
            id: 1,
            name: 'Sarah Mitchell',
            rating: 4.9,
            verified: true
          }
        };
      }
      throw error;
    }
  },

  // Create new service
  createService: async (serviceData) => {
    try {
      const response = await apiClient.post('/services', serviceData);
      return response.data;
    } catch (error) {
      // Only return mock data in development
      if (process.env.NODE_ENV === 'development' && (error.code === 'ERR_NETWORK' || error.response?.status >= 500)) {
        console.warn('Using mock data for createService:', error.message);
        return {
          message: 'Service created successfully (mock)',
          service: {
            id: Date.now(),
            ...serviceData,
            createdAt: new Date().toISOString()
          }
        };
      }
      throw error;
    }
  },

  // Update service
  updateService: async (id, serviceData) => {
    try {
      const response = await apiClient.put(`/services/${id}`, serviceData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete service
  deleteService: async (id) => {
    try {
      const response = await apiClient.delete(`/services/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default servicesAPI;
