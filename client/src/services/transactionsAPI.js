import apiClient from './apiClient';

const transactionsAPI = {
  // Get user transactions
  getTransactions: async (filters = {}) => {
    try {
      const response = await apiClient.get('/transactions', { params: filters });
      return response.data;
    } catch (error) {
      // Only return mock data in development
      if (process.env.NODE_ENV === 'development' && (error.code === 'ERR_NETWORK' || error.response?.status >= 500)) {
        console.warn('Using mock data for getTransactions:', error.message);
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
      const response = await apiClient.get(`/transactions/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new transaction
  createTransaction: async (transactionData) => {
    try {
      const response = await apiClient.post('/transactions', transactionData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update transaction status
  updateTransactionStatus: async (id, status) => {
    try {
      const response = await apiClient.patch(`/transactions/${id}/status`, { status });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default transactionsAPI;
