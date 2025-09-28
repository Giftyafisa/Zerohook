const { query } = require('../config/database');
const axios = require('axios');

class PaystackManager {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseURL = 'https://api.paystack.co';
    this.initialized = false;
  }

  async initialize() {
    try {
      if (!this.secretKey || !this.publicKey) {
        console.log('⚠️  Paystack keys not configured, Paystack features disabled');
        return false;
      }

      // Test connection
      const response = await axios.get(`${this.baseURL}/transaction/verify/test`, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`
        }
      });

      if (response.status === 200) {
        console.log('✅ Paystack initialized successfully');
        this.initialized = true;
        return true;
      }
    } catch (error) {
      console.error('❌ Paystack initialization failed:', error.message);
      return false;
    }
  }

  isHealthy() {
    return this.initialized;
  }

  /**
   * Initialize Paystack transaction
   */
  async initializeTransaction(transactionData) {
    try {
      const { 
        amount, 
        email, 
        currency = 'USD', 
        reference,
        callback_url,
        metadata = {}
      } = transactionData;

      // Convert amount to smallest currency unit based on currency
      let convertedAmount = amount;
      if (currency === 'NGN') {
        convertedAmount = Math.round(amount); // Already in kobo
      } else if (currency === 'GHS') {
        convertedAmount = Math.round(amount * 100); // Convert to pesewas
      } else if (currency === 'KES') {
        convertedAmount = Math.round(amount * 100); // Convert to cents
      } else {
        convertedAmount = Math.round(amount * 100); // Default to cents
      }

      const response = await axios.post(`${this.baseURL}/transaction/initialize`, {
        amount: convertedAmount,
        email,
        currency,
        reference,
        callback_url,
        metadata
      }, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status) {
        return {
          success: true,
          authorizationUrl: response.data.data.authorization_url,
          reference: response.data.data.reference,
          accessCode: response.data.data.access_code
        };
      } else {
        console.error('Paystack API error response:', response.data);
        throw new Error(`Paystack error: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Paystack transaction initialization failed:', error);
      if (error.response) {
        console.error('Paystack response data:', error.response.data);
        console.error('Paystack response status:', error.response.status);
      }
      throw error;
    }
  }

  /**
   * Verify Paystack transaction
   */
  async verifyTransaction(reference) {
    try {
      const response = await axios.get(`${this.baseURL}/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`
        }
      });

      if (response.data.status) {
        const transaction = response.data.data;
        return {
          success: true,
          reference: transaction.reference,
          amount: transaction.amount / 100, // Convert from kobo
          currency: transaction.currency,
          status: transaction.status,
          gateway_response: transaction.gateway_response,
          paid_at: transaction.paid_at,
          metadata: transaction.metadata
        };
      } else {
        throw new Error('Failed to verify Paystack transaction');
      }
    } catch (error) {
      console.error('Paystack transaction verification failed:', error);
      throw error;
    }
  }

  /**
   * Get supported currencies
   */
  async getSupportedCurrencies() {
    try {
      const response = await axios.get(`${this.baseURL}/country`, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`
        }
      });

      if (response.data.status) {
        return response.data.data.map(country => ({
          country: country.name,
          currency: country.currency,
          gateway: country.gateway
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to get supported currencies:', error);
      return [];
    }
  }

  /**
   * Create transfer recipient
   */
  async createTransferRecipient(recipientData) {
    try {
      const { type, name, account_number, bank_code, currency = 'NGN' } = recipientData;

      const response = await axios.post(`${this.baseURL}/transferrecipient`, {
        type,
        name,
        account_number,
        bank_code,
        currency
      }, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status) {
        return {
          success: true,
          recipient_code: response.data.data.recipient_code,
          details: response.data.data
        };
      } else {
        throw new Error('Failed to create transfer recipient');
      }
    } catch (error) {
      console.error('Failed to create transfer recipient:', error);
      throw error;
    }
  }

  /**
   * Initiate transfer to provider
   */
  async initiateTransfer(transferData) {
    try {
      const { source, recipient, amount, reason, currency = 'NGN' } = transferData;

      const response = await axios.post(`${this.baseURL}/transfer`, {
        source,
        recipient,
        amount: Math.round(amount * 100), // Convert to kobo
        reason,
        currency
      }, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status) {
        return {
          success: true,
          transfer_code: response.data.data.transfer_code,
          reference: response.data.data.reference,
          status: response.data.data.status
        };
      } else {
        throw new Error('Failed to initiate transfer');
      }
    } catch (error) {
      console.error('Failed to initiate transfer:', error);
      throw error;
    }
  }

  /**
   * Get bank list for Nigeria
   */
  async getBankList() {
    try {
      const response = await axios.get(`${this.baseURL}/bank`, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`
        }
      });

      if (response.data.status) {
        return response.data.data.map(bank => ({
          name: bank.name,
          code: bank.code,
          active: bank.active,
          country: bank.country,
          currency: bank.currency
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to get bank list:', error);
      return [];
    }
  }
}

module.exports = PaystackManager;
