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

const transactionsAPI = {
  // Get user transactions
  getTransactions: async (filters = {}) => {
    try {
      const response = await api.get('/transactions', { params: filters });
      return response.data;
    } catch (error) {
      // Fallback to mock data if backend is not available
      if (error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
        return {
          transactions: [
            {
              id: 1,
              type: 'service_purchase',
              amount: 150,
              currency: 'USD',
              status: 'completed',
              description: 'Premium Dating Service',
              date: new Date().toISOString(),
              serviceId: 1
            },
            {
              id: 2,
              type: 'escrow_deposit',
              amount: 200,
              currency: 'USD',
              status: 'pending',
              description: 'Escrow deposit for service',
              date: new Date(Date.now() - 86400000).toISOString(),
              serviceId: 2
            }
          ]
        };
      }
      throw error;
    }
  },

  // Get transaction by ID
  getTransactionById: async (id) => {
    try {
      const response = await api.get(`/transactions/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new transaction
  createTransaction: async (transactionData) => {
    try {
      const response = await api.post('/transactions', transactionData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update transaction status
  updateTransactionStatus: async (id, status) => {
    try {
      const response = await api.patch(`/transactions/${id}/status`, { status });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default transactionsAPI;
