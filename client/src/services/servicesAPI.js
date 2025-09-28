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

const servicesAPI = {
  // Get all services
  getServices: async (filters = {}) => {
    try {
      const response = await api.get('/services', { params: filters });
      return response.data;
    } catch (error) {
      // Fallback to mock data if backend is not available
      if (error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
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
      const response = await api.get(`/services/${id}`);
      return response.data;
    } catch (error) {
      // Fallback to mock data if backend is not available
      if (error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
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
      const response = await api.post('/services', serviceData);
      return response.data;
    } catch (error) {
      // Fallback to mock response if backend is not available
      if (error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
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
      const response = await api.put(`/services/${id}`, serviceData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete service
  deleteService: async (id) => {
    try {
      const response = await api.delete(`/services/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default servicesAPI;
