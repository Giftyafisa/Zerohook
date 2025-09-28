const { query } = require('../config/database');
const axios = require('axios');

class BitnobManager {
  constructor() {
    this.apiKey = process.env.BITNOB_API_KEY;
    this.secretKey = process.env.BITNOB_SECRET_KEY;
    this.baseURL = 'https://api.bitnob.co';
    this.initialized = false;
  }

  async initialize() {
    try {
      if (!this.apiKey || !this.secretKey) {
        console.log('⚠️  Bitnob keys not configured, Bitnob features disabled');
        return false;
      }

      // Test connection
      const response = await axios.get(`${this.baseURL}/v1/account`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        console.log('✅ Bitnob initialized successfully');
        this.initialized = true;
        return true;
      }
    } catch (error) {
      console.error('❌ Bitnob initialization failed:', error.message);
      return false;
    }
  }

  isHealthy() {
    return this.initialized;
  }

  /**
   * Create a new payment request
   */
  async createPaymentRequest(paymentData) {
    try {
      const { 
        amount, 
        currency = 'GHS', 
        description,
        customerEmail,
        customerPhone,
        metadata = {}
      } = paymentData;

      const response = await axios.post(`${this.baseURL}/v1/payment-requests`, {
        amount: Math.round(amount * 100), // Convert to pesewas
        currency: currency,
        description: description,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        metadata: metadata
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        return {
          success: true,
          paymentId: response.data.data.id,
          paymentUrl: response.data.data.payment_url,
          reference: response.data.data.reference,
          amount: response.data.data.amount / 100,
          currency: response.data.data.currency,
          status: response.data.data.status
        };
      } else {
        throw new Error('Failed to create Bitnob payment request');
      }
    } catch (error) {
      console.error('Bitnob payment request creation failed:', error);
      throw error;
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(paymentId) {
    try {
      const response = await axios.get(`${this.baseURL}/v1/payment-requests/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        const payment = response.data.data;
        return {
          success: true,
          paymentId: payment.id,
          reference: payment.reference,
          amount: payment.amount / 100,
          currency: payment.currency,
          status: payment.status,
          paidAt: payment.paid_at,
          metadata: payment.metadata
        };
      } else {
        throw new Error('Failed to verify Bitnob payment');
      }
    } catch (error) {
      console.error('Bitnob payment verification failed:', error);
      throw error;
    }
  }

  /**
   * Create Bitcoin payment address
   */
  async createBitcoinAddress(addressData) {
    try {
      const { 
        amount, 
        description,
        customerEmail,
        metadata = {}
      } = addressData;

      const response = await axios.post(`${this.baseURL}/v1/addresses`, {
        currency: 'BTC',
        amount: amount,
        description: description,
        customer_email: customerEmail,
        metadata: metadata
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        return {
          success: true,
          addressId: response.data.data.id,
          address: response.data.data.address,
          amount: response.data.data.amount,
          currency: response.data.data.currency,
          status: response.data.data.status,
          expiresAt: response.data.data.expires_at
        };
      } else {
        throw new Error('Failed to create Bitcoin address');
      }
    } catch (error) {
      console.error('Bitnob Bitcoin address creation failed:', error);
      throw error;
    }
  }

  /**
   * Get supported cryptocurrencies
   */
  async getSupportedCryptocurrencies() {
    try {
      const response = await axios.get(`${this.baseURL}/v1/currencies`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        return response.data.data.map(currency => ({
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
          network: currency.network,
          minAmount: currency.min_amount,
          maxAmount: currency.max_amount
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to get Bitnob supported cryptocurrencies:', error);
      return [];
    }
  }

  /**
   * Get exchange rates
   */
  async getExchangeRates(baseCurrency = 'GHS') {
    try {
      const response = await axios.get(`${this.baseURL}/v1/rates`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        return {
          success: true,
          base: baseCurrency,
          rates: response.data.data,
          timestamp: new Date().toISOString()
        };
      }
      return { success: false };
    } catch (error) {
      console.error('Failed to get Bitnob exchange rates:', error);
      return { success: false };
    }
  }

  /**
   * Create local bank transfer
   */
  async createLocalTransfer(transferData) {
    try {
      const { 
        amount, 
        bankCode,
        accountNumber,
        accountName,
        narration,
        metadata = {}
      } = transferData;

      const response = await axios.post(`${this.baseURL}/v1/transfers`, {
        amount: Math.round(amount * 100), // Convert to pesewas
        bank_code: bankCode,
        account_number: accountNumber,
        account_name: accountName,
        narration: narration,
        metadata: metadata
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        return {
          success: true,
          transferId: response.data.data.id,
          reference: response.data.data.reference,
          amount: response.data.data.amount / 100,
          status: response.data.data.status,
          bankCode: response.data.data.bank_code,
          accountNumber: response.data.data.account_number,
          accountName: response.data.data.account_name
        };
      } else {
        throw new Error('Failed to create local transfer');
      }
    } catch (error) {
      console.error('Bitnob local transfer creation failed:', error);
      throw error;
    }
  }

  /**
   * Get Ghanaian banks list
   */
  async getGhanaianBanks() {
    try {
      const response = await axios.get(`${this.baseURL}/v1/banks`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        return response.data.data.map(bank => ({
          code: bank.code,
          name: bank.name,
          country: bank.country,
          currency: bank.currency,
          type: bank.type
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to get Ghanaian banks:', error);
      return [];
    }
  }

  /**
   * Get user's Bitnob wallet balance
   */
  async getWalletBalance() {
    try {
      const response = await axios.get(`${this.baseURL}/v1/wallets`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        return response.data.data.map(wallet => ({
          currency: wallet.currency,
          balance: wallet.balance,
          availableBalance: wallet.available_balance,
          lockedBalance: wallet.locked_balance
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to get Bitnob wallet balance:', error);
      return [];
    }
  }

  /**
   * Create mobile money payment
   */
  async createMobileMoneyPayment(mobileData) {
    try {
      const { 
        amount, 
        phoneNumber,
        provider, // MTN, Vodafone, AirtelTigo
        description,
        metadata = {}
      } = mobileData;

      const response = await axios.post(`${this.baseURL}/v1/mobile-money`, {
        amount: Math.round(amount * 100), // Convert to pesewas
        phone_number: phoneNumber,
        provider: provider,
        description: description,
        metadata: metadata
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        return {
          success: true,
          paymentId: response.data.data.id,
          reference: response.data.data.reference,
          amount: response.data.data.amount / 100,
          phoneNumber: response.data.data.phone_number,
          provider: response.data.data.provider,
          status: response.data.data.status
        };
      } else {
        throw new Error('Failed to create mobile money payment');
      }
    } catch (error) {
      console.error('Bitnob mobile money payment creation failed:', error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(limit = 50, offset = 0) {
    try {
      const response = await axios.get(`${this.baseURL}/v1/transactions?limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        return response.data.data.map(transaction => ({
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount / 100,
          currency: transaction.currency,
          status: transaction.status,
          reference: transaction.reference,
          createdAt: transaction.created_at,
          metadata: transaction.metadata
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to get Bitnob transaction history:', error);
      return [];
    }
  }

  /**
   * Get Ghanaian-specific features
   */
  getGhanaianFeatures() {
    return {
      localBanks: true,
      mobileMoney: true,
      cryptoPayments: true,
      localCurrency: 'GHS',
      phoneCode: '+233',
      timezone: 'Africa/Accra',
      features: [
        'Local Bank Transfers',
        'Mobile Money (MTN, Vodafone, AirtelTigo)',
        'Bitcoin & Crypto Payments',
        'Local Currency Support',
        'Ghanaian Bank Integration',
        '24/7 Local Support'
      ]
    };
  }
}

module.exports = BitnobManager;
