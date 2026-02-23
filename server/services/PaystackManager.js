const axios = require('axios');
const crypto = require('crypto');

class PaystackManager {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseURL = 'https://api.paystack.co';
    this.initialized = false;
    this.MIN_AMOUNT = 1; // minimum 1 in base currency
    this.MAX_AMOUNT = 10000000; // max 10M in base currency
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
        currency = 'NGN', 
        reference,
        callback_url,
        channels,
        metadata = {}
      } = transactionData;

      // Validate amount
      if (!amount || typeof amount !== 'number' || amount < this.MIN_AMOUNT || amount > this.MAX_AMOUNT || !isFinite(amount)) {
        throw new Error(`Invalid amount. Must be between ${this.MIN_AMOUNT} and ${this.MAX_AMOUNT}`);
      }

      // Paystack supported currencies - check your dashboard for enabled currencies
      const SUPPORTED_CURRENCIES = ['NGN', 'GHS', 'ZAR', 'USD', 'KES'];
      
      // Use NGN as fallback if currency not in supported list
      let finalCurrency = SUPPORTED_CURRENCIES.includes(currency) ? currency : 'NGN';
      
      // Convert amount to smallest currency unit (kobo, pesewas, cents)
      // All amounts from frontend are in the main currency unit (e.g., Naira, not kobo)
      const convertedAmount = Math.round(amount * 100);

      console.log(`💳 Paystack: Initializing ${finalCurrency} ${amount} (${convertedAmount} smallest unit)`);

      const requestData = {
        amount: convertedAmount,
        email,
        currency: finalCurrency,
        reference,
        callback_url,
        metadata
      };

      // Add payment channels if specified (country-specific)
      // Note: Some channels only work with certain currencies
      if (channels && Array.isArray(channels) && channels.length > 0) {
        // Filter channels based on currency
        const currencyChannelMap = {
          NGN: ['card', 'bank', 'ussd', 'bank_transfer', 'qr', 'mobile_money'],
          GHS: ['card', 'mobile_money'],
          KES: ['card', 'mobile_money'],
          ZAR: ['card', 'eft'],
          USD: ['card']
        };
        const allowedChannels = currencyChannelMap[finalCurrency] || ['card'];
        const filteredChannels = channels.filter(ch => allowedChannels.includes(ch));
        
        if (filteredChannels.length > 0) {
          requestData.channels = filteredChannels;
          console.log(`💳 Paystack: Using channels: ${filteredChannels.join(', ')}`);
        }
      }

      // First attempt with requested currency
      try {
        const response = await axios.post(`${this.baseURL}/transaction/initialize`, requestData, {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.data.status) {
          console.log(`✅ Paystack: Transaction initialized - ${response.data.data.reference}`);
          return {
            success: true,
            authorizationUrl: response.data.data.authorization_url,
            reference: response.data.data.reference,
            accessCode: response.data.data.access_code,
            currency: finalCurrency
          };
        }
      } catch (firstError) {
        // If currency not supported, try without channels (simplest request)
        if (firstError.response?.data?.code === 'unsupported_currency') {
          console.log(`⚠️  Currency ${finalCurrency} not enabled, trying without channels...`);
          
          // Try again without channels (minimal request)
          const minimalRequest = {
            amount: convertedAmount,
            email,
            currency: finalCurrency,
            reference,
            metadata
          };

          const retryResponse = await axios.post(`${this.baseURL}/transaction/initialize`, minimalRequest, {
            headers: {
              'Authorization': `Bearer ${this.secretKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (retryResponse.data.status) {
            console.log(`✅ Paystack: Transaction initialized (retry) - ${retryResponse.data.data.reference}`);
            return {
              success: true,
              authorizationUrl: retryResponse.data.data.authorization_url,
              reference: retryResponse.data.data.reference,
              accessCode: retryResponse.data.data.access_code,
              currency: finalCurrency
            };
          }
        }
        throw firstError;
      }

      throw new Error('Paystack initialization failed');
    } catch (error) {
      console.error('Paystack transaction initialization failed:', error);
      if (error.response) {
        console.error('Paystack response data:', error.response.data);
        console.error('Paystack response status:', error.response.status);
        
        // Provide helpful error messages
        if (error.response.data?.code === 'unsupported_currency') {
          console.error('⚠️  SOLUTION: Enable the currency in your Paystack Dashboard → Settings → Preferences');
          console.error('⚠️  For test mode, ensure the currency is enabled for test transactions');
        }
      }
      throw error;
    }
  }

  /**
   * Verify Paystack transaction
   */
  async verifyTransaction(reference) {
    try {
      // Sanitize reference to prevent path traversal
      const sanitizedRef = String(reference).replace(/[^a-zA-Z0-9_\-]/g, '');
      if (!sanitizedRef || sanitizedRef.length > 200) {
        throw new Error('Invalid transaction reference');
      }

      const response = await axios.get(`${this.baseURL}/transaction/verify/${encodeURIComponent(sanitizedRef)}`, {
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
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Get bank list for a specific country
   * @param {string} country - Country code (ng, gh, ke, za)
   */
  async getBankList(country = 'ng') {
    try {
      const response = await axios.get(`${this.baseURL}/bank?country=${country}`, {
        headers: {
          'Authorization': `Bearer ${this.secretKey}`
        }
      });

      if (response.data.status) {
        return {
          success: true,
          banks: response.data.data.map(bank => ({
            name: bank.name,
            code: bank.code,
            active: bank.active,
            country: bank.country,
            currency: bank.currency,
            type: bank.type
          }))
        };
      }
      return { success: false, banks: [], error: 'Failed to fetch banks' };
    } catch (error) {
      console.error('Failed to get bank list:', error);
      return { success: false, banks: [], error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Verify bank account number
   * @param {string} accountNumber - Bank account number
   * @param {string} bankCode - Bank code
   */
  async verifyBankAccount(accountNumber, bankCode) {
    try {
      const response = await axios.get(
        `${this.baseURL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`
          }
        }
      );

      if (response.data.status) {
        return {
          success: true,
          account_name: response.data.data.account_name,
          account_number: response.data.data.account_number,
          bank_id: response.data.data.bank_id
        };
      }
      return { success: false, error: 'Could not resolve account' };
    } catch (error) {
      console.error('Failed to verify bank account:', error);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Verify Paystack webhook signature
   * @param {string} signature - x-paystack-signature header value
   * @param {string|Buffer} body - Raw request body
   * @returns {boolean} - Whether signature is valid
   */
  verifyWebhookSignature(signature, body) {
    if (!signature || !body) return false;
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(typeof body === 'string' ? body : JSON.stringify(body))
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(signature, 'hex')
    );
  }
}

module.exports = PaystackManager;
