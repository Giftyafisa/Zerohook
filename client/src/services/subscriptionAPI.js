import apiClient from './apiClient';

const subscriptionAPI = {
  /**
   * Check user's subscription status
   */
  async checkStatus() {
    try {
      const response = await apiClient.get('/subscriptions/status');
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
      const response = await apiClient.post('/subscriptions/create', subscriptionData);
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
      const response = await apiClient.post('/subscriptions/verify-payment', {
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
      const response = await apiClient.post('/subscriptions/verify-payment-by-reference', {
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
   * @deprecated Backend route not yet implemented - will return 404
   */
  async getHistory() {
    console.warn('subscriptionAPI.getHistory() - Backend route /subscriptions/history not implemented');
    return { success: false, error: 'Not implemented', data: [] };
  },

  /**
   * Cancel subscription
   * @deprecated Backend route not yet implemented - will return 404
   */
  async cancelSubscription() {
    console.warn('subscriptionAPI.cancelSubscription() - Backend route /subscriptions/cancel not implemented');
    return { success: false, error: 'Not implemented' };
  },

  /**
   * Get subscription plans
   */
  async getPlans() {
    try {
      const response = await apiClient.get('/subscriptions/plans');
      return response.data;
    } catch (error) {
      console.error('Error getting subscription plans:', error);
      throw error;
    }
  },

  /**
   * Get user's current plan details
   * @deprecated Backend route not yet implemented
   */
  async getCurrentPlan() {
    console.warn('subscriptionAPI.getCurrentPlan() - Backend route not implemented');
    return { success: false, error: 'Not implemented', data: null };
  },

  /**
   * Upgrade subscription plan
   * @deprecated Backend route not yet implemented
   */
  async upgradePlan(newPlanId) {
    console.warn('subscriptionAPI.upgradePlan() - Backend route not implemented');
    return { success: false, error: 'Not implemented' };
  },

  /**
   * Get payment methods
   * @deprecated Crypto-only system - no stored payment methods
   */
  async getPaymentMethods() {
    return { success: true, data: [], message: 'Crypto-only system - no stored payment methods' };
  },

  /**
   * Add payment method
   * @deprecated Crypto-only system
   */
  async addPaymentMethod(paymentMethodData) {
    return { success: false, error: 'Crypto-only system - payment methods not applicable' };
  },

  /**
   * Remove payment method
   * @deprecated Crypto-only system
   */
  async removePaymentMethod(paymentMethodId) {
    return { success: false, error: 'Crypto-only system - payment methods not applicable' };
  },

  /**
   * Get billing information
   * @deprecated Backend route not yet implemented
   */
  async getBillingInfo() {
    console.warn('subscriptionAPI.getBillingInfo() - Backend route not implemented');
    return { success: false, error: 'Not implemented', data: null };
  },

  /**
   * Update billing information
   * @deprecated Backend route not yet implemented
   */
  async updateBillingInfo(billingData) {
    console.warn('subscriptionAPI.updateBillingInfo() - Backend route not implemented');
    return { success: false, error: 'Not implemented' };
  },

  /**
   * Get invoices
   * @deprecated Backend route not yet implemented
   */
  async getInvoices() {
    console.warn('subscriptionAPI.getInvoices() - Backend route not implemented');
    return { success: false, error: 'Not implemented', data: [] };
  },

  /**
   * Download invoice
   * @deprecated Backend route not yet implemented
   */
  async downloadInvoice(invoiceId) {
    console.warn('subscriptionAPI.downloadInvoice() - Backend route not implemented');
    return null;
  },

  /**
   * Get subscription analytics
   * @deprecated Backend route not yet implemented
   */
  async getAnalytics() {
    console.warn('subscriptionAPI.getAnalytics() - Backend route not implemented');
    return { success: false, error: 'Not implemented', data: null };
  },

  /**
   * Send support request
   * @deprecated Backend route not yet implemented
   */
  async sendSupportRequest(supportData) {
    console.warn('subscriptionAPI.sendSupportRequest() - Backend route not implemented');
    return { success: false, error: 'Not implemented' };
  }
};

export default subscriptionAPI;
