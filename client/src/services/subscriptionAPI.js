import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const subscriptionAPI = {
  /**
   * Check user's subscription status
   */
  async checkStatus() {
    try {
      const response = await api.get('/subscriptions/status');
      return response.data;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      throw error;
    }
  },

  /**
   * Create a new subscription
   */
  async createSubscription(subscriptionData) {
    try {
      const response = await api.post('/subscriptions/create', subscriptionData);
      return response.data;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  },

  /**
   * Verify payment and activate subscription
   */
  async verifyPayment(paymentReference) {
    try {
      const response = await api.post('/subscriptions/verify-payment', {
        paymentReference
      });
      return response.data;
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  },

  /**
   * Verify payment by reference (for polling)
   */
  async verifyPaymentByReference(paymentReference) {
    try {
      const response = await api.post('/subscriptions/verify-payment-by-reference', {
        paymentReference
      });
      return response.data;
    } catch (error) {
      console.error('Error verifying payment by reference:', error);
      throw error;
    }
  },

  /**
   * Get subscription history
   */
  async getHistory() {
    try {
      const response = await api.get('/subscriptions/history');
      return response.data;
    } catch (error) {
      console.error('Error getting subscription history:', error);
      throw error;
    }
  },

  /**
   * Cancel subscription
   */
  async cancelSubscription() {
    try {
      const response = await api.post('/subscriptions/cancel');
      return response.data;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  },

  /**
   * Get subscription plans
   */
  async getPlans() {
    try {
      const response = await api.get('/subscriptions/plans');
      return response.data;
    } catch (error) {
      console.error('Error getting subscription plans:', error);
      throw error;
    }
  },

  /**
   * Get user's current plan details
   */
  async getCurrentPlan() {
    try {
      const response = await api.get('/subscriptions/current-plan');
      return response.data;
    } catch (error) {
      console.error('Error getting current plan:', error);
      throw error;
    }
  },

  /**
   * Upgrade subscription plan
   */
  async upgradePlan(newPlanId) {
    try {
      const response = await api.post('/subscriptions/upgrade', {
        newPlanId
      });
      return response.data;
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      throw error;
    }
  },

  /**
   * Get payment methods
   */
  async getPaymentMethods() {
    try {
      const response = await api.get('/subscriptions/payment-methods');
      return response.data;
    } catch (error) {
      console.error('Error getting payment methods:', error);
      throw error;
    }
  },

  /**
   * Add payment method
   */
  async addPaymentMethod(paymentMethodData) {
    try {
      const response = await api.post('/subscriptions/payment-methods', paymentMethodData);
      return response.data;
    } catch (error) {
      console.error('Error adding payment method:', error);
      throw error;
    }
  },

  /**
   * Remove payment method
   */
  async removePaymentMethod(paymentMethodId) {
    try {
      const response = await api.delete(`/subscriptions/payment-methods/${paymentMethodId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing payment method:', error);
      throw error;
    }
  },

  /**
   * Get billing information
   */
  async getBillingInfo() {
    try {
      const response = await api.get('/subscriptions/billing');
      return response.data;
    } catch (error) {
      console.error('Error getting billing info:', error);
      throw error;
    }
  },

  /**
   * Update billing information
   */
  async updateBillingInfo(billingData) {
    try {
      const response = await api.put('/subscriptions/billing', billingData);
      return response.data;
    } catch (error) {
      console.error('Error updating billing info:', error);
      throw error;
    }
  },

  /**
   * Get invoices
   */
  async getInvoices() {
    try {
      const response = await api.get('/subscriptions/invoices');
      return response.data;
    } catch (error) {
      console.error('Error getting invoices:', error);
      throw error;
    }
  },

  /**
   * Download invoice
   */
  async downloadInvoice(invoiceId) {
    try {
      const response = await api.get(`/subscriptions/invoices/${invoiceId}/download`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error('Error downloading invoice:', error);
      throw error;
    }
  },

  /**
   * Get subscription analytics
   */
  async getAnalytics() {
    try {
      const response = await api.get('/subscriptions/analytics');
      return response.data;
    } catch (error) {
      console.error('Error getting subscription analytics:', error);
      throw error;
    }
  },

  /**
   * Send support request
   */
  async sendSupportRequest(supportData) {
    try {
      const response = await api.post('/subscriptions/support', supportData);
      return response.data;
    } catch (error) {
      console.error('Error sending support request:', error);
      throw error;
    }
  }
};

export default subscriptionAPI;
