const express = require('express');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const NotificationService = require('../services/NotificationService');

/**
 * @route   POST /api/payments/create-payment-intent
 * @desc    Create a payment intent with country-specific payment methods
 * @access  Private
 */
router.post('/create-payment-intent', authMiddleware, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency').isIn(['usd', 'ngn', 'eur', 'gbp', 'btc', 'eth', 'usdt', 'usdc', 'ghs', 'kes', 'zar', 'ugx', 'tzs', 'rwf', 'bwp', 'zmw', 'mwk']).withMessage('Invalid currency'),
  body('paymentMethod').isIn(['stripe', 'paystack', 'crypto']).withMessage('Invalid payment method'),
  body('serviceId').optional().isUUID().withMessage('Invalid service ID'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { amount, currency, paymentMethod, serviceId, description } = req.body;
    const userId = req.user.userId;

    // Get user's country preference
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    
    // Validate currency against user's country
    const country = req.countryManager.getCountryByCode(countryCode);
    if (country && currency.toLowerCase() !== country.currency.toLowerCase()) {
      return res.status(400).json({
        error: 'Currency mismatch',
        message: `Please use ${country.currency} for ${country.name}`,
        suggestedCurrency: country.currency
      });
    }

    let paymentIntent;
    let paymentData;

    switch (paymentMethod) {
      case 'stripe':
        paymentData = await createStripePayment(amount, currency, description, req);
        break;
      case 'paystack':
        paymentData = await createPaystackPayment(amount, currency, description, countryCode, req);
        break;
      case 'crypto':
        paymentData = await createCryptoPayment(amount, currency, description, countryCode, req);
        break;
      default:
        return res.status(400).json({ error: 'Invalid payment method' });
    }

    if (!paymentData.success) {
      return res.status(400).json({ error: paymentData.error });
    }

    // Create transaction record using MongoDB
    const { Transaction } = require('../config/database');
    const mongoose = require('mongoose');

    console.log(`💳 Creating MongoDB transaction record for user ${userId}, amount: ${amount} ${currency}, method: ${paymentMethod}`);

    const transaction = await Transaction.create({
      user_id: mongoose.Types.ObjectId.createFromHexString(userId),
      service_id: serviceId || null,
      amount: amount,
      currency: currency.toUpperCase(),
      payment_method: paymentMethod,
      payment_intent_id: paymentData.paymentIntentId || null,
      reference: paymentData.reference || null,
      status: 'pending',
      country_code: countryCode,
      type: 'payment',
      metadata: {
        country: countryCode,
        paymentMethod,
        ...paymentData.metadata
      }
    });

    console.log(`✅ MongoDB transaction created with ID: ${transaction._id.toString()}`);

    res.json({
      success: true,
      transactionId: transaction._id.toString(),
      paymentIntent: paymentData,
      country: country,
      message: `Payment intent created for ${country ? country.name : 'your country'}`
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

/**
 * @route   POST /api/payments/confirm
 * @desc    Confirm a payment (supports multiple payment methods)
 * @access  Private
 */
router.post('/confirm', authMiddleware, [
  body('paymentIntentId').optional().isString().withMessage('Payment intent ID must be a string'),
  body('reference').optional().isString().withMessage('Reference must be a string'),
  body('paymentMethod').isIn(['stripe', 'paystack', 'crypto']).withMessage('Invalid payment method')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { paymentIntentId, reference, paymentMethod } = req.body;
    const userId = req.user.userId;

    if (!paymentIntentId && !reference) {
      return res.status(400).json({ error: 'Payment intent ID or reference is required' });
    }

    let paymentResult;

    switch (paymentMethod) {
      case 'stripe':
        paymentResult = await confirmStripePayment(paymentIntentId, req);
        break;
      case 'paystack':
        paymentResult = await confirmPaystackPayment(reference, req);
        break;
      case 'crypto':
        paymentResult = await confirmCryptoPayment(reference, req);
        break;
      default:
        return res.status(400).json({ error: 'Invalid payment method' });
    }

    if (!paymentResult.success) {
      return res.status(400).json({ error: paymentResult.error });
    }

    // Update transaction status using MongoDB
    const { Transaction } = require('../config/database');
    const mongoose = require('mongoose');
    
    const searchQuery = {};
    if (paymentIntentId) searchQuery.payment_intent_id = paymentIntentId;
    if (reference) searchQuery.reference = reference;
    searchQuery.user_id = mongoose.Types.ObjectId.createFromHexString(userId);
    
    const transaction = await Transaction.findOneAndUpdate(
      searchQuery,
      { 
        $set: { 
          status: 'confirmed', 
          confirmed_at: new Date(),
          'metadata.confirmation': paymentResult 
        } 
      },
      { new: true }
    );

    // Emit real-time payment confirmation to user
    if (req.io && transaction) {
      req.io.to(`user_${userId}`).emit('payment_confirmed', {
        transactionId: transaction._id.toString(),
        amount: transaction.amount,
        currency: transaction.currency,
        status: 'confirmed',
        timestamp: new Date().toISOString()
      });
      console.log(`📡 Payment confirmation notification sent to user: ${userId}`);
    }

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      payment: paymentResult
    });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

/**
 * @route   GET /api/payments/transactions
 * @desc    Get user's transaction history with country-specific filtering
 * @access  Private
 */
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status, type } = req.query;
    const { Transaction } = require('../config/database');
    const mongoose = require('mongoose');
    
    const userObjectId = mongoose.Types.ObjectId.createFromHexString(userId);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query - get transactions where user is involved (as user, client, or provider)
    const matchQuery = {
      $or: [
        { user_id: userObjectId },
        { client_id: userObjectId },
        { provider_id: userObjectId }
      ]
    };
    
    // Add status filter if provided
    if (status) {
      matchQuery.status = status;
    }
    
    // Add type filter if provided
    if (type) {
      matchQuery.type = type;
    }
    
    // Get total count
    const total = await Transaction.countDocuments(matchQuery);
    
    // Get transactions with pagination
    const transactions = await Transaction.find(matchQuery)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Format transactions for frontend
    const formattedTransactions = transactions.map(tx => {
      // Determine if income or expense for this user
      const isIncome = tx.provider_id?.toString() === userId || 
                       (tx.type === 'deposit' && tx.user_id?.toString() === userId);
      
      return {
        id: tx._id.toString(),
        type: isIncome ? 'income' : 'expense',
        title: tx.metadata?.description || tx.type || 'Transaction',
        amount: Math.abs(tx.amount),
        currency: tx.currency,
        status: tx.status,
        date: formatRelativeTime(tx.created_at),
        rawDate: tx.created_at,
        reference: tx.reference,
        paymentMethod: tx.payment_method
      };
    });
    
    res.json({
      success: true,
      transactions: formattedTransactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transactions',
      transactions: [],
      pagination: { page: 1, limit: 10, total: 0, pages: 0 }
    });
  }
});

// Helper function for relative time
function formatRelativeTime(date) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return past.toLocaleDateString();
}

/**
 * @route   GET /api/payments/methods
 * @desc    Get available payment methods based on user's country
 * @access  Private
 */
router.get('/methods', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user's country preference
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    
    // Get country-specific payment methods
    const paymentMethods = req.countryManager.getCountryPaymentMethods(countryCode);
    
    res.json({
      success: true,
      userCountry: userCountry.country,
      paymentMethods: paymentMethods,
      message: `Payment methods for ${userCountry.country ? userCountry.country.name : 'your country'}`
    });

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * @route   GET /api/payments/currencies
 * @desc    Get supported currencies and exchange rates for user's country
 * @access  Private
 */
router.get('/currencies', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's country preference
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    
    // Get country-specific currencies
    const country = req.countryManager.getCountryByCode(countryCode);
    
    // Get crypto exchange rates
    const cryptoRates = await req.cryptoPaymentManager.getExchangeRates(country.currency);
    
    res.json({
      success: true,
      userCountry: country,
      supportedCurrencies: req.countryManager.getAllCountries().map(c => ({
        code: c.code,
        name: c.name,
        currency: c.currency,
        currencySymbol: c.currencySymbol,
        flag: c.flag
      })),
      exchangeRates: cryptoRates.success ? cryptoRates : null
    });

  } catch (error) {
    console.error('Get currencies error:', error);
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
});

// Helper functions for different payment methods
async function createStripePayment(amount, currency, description, req) {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      description: description || 'Service payment',
      metadata: {
        userId: req.user.userId
      }
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      metadata: {
        stripePaymentIntentId: paymentIntent.id
      }
    };
  } catch (error) {
    console.error('Stripe payment creation failed:', error);
    return { success: false, error: error.message };
  }
}

async function createPaystackPayment(amount, currency, description, countryCode, req) {
  try {
    const paymentData = {
      amount: Math.round(amount * 100),
      currency: currency.toUpperCase(),
      description: description || 'Service payment',
      email: req.user.email,
      metadata: {
        userId: req.user.userId,
        countryCode: countryCode
      }
    };

    const result = await req.paystackManager.initializeTransaction(paymentData);
    
    if (result.success) {
      return {
        success: true,
        reference: result.reference,
        authorizationUrl: result.authorizationUrl,
        metadata: {
          paystackReference: result.reference,
          countryCode: countryCode
        }
      };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Paystack payment creation failed:', error);
    return { success: false, error: error.message };
  }
}

async function createCryptoPayment(amount, currency, description, countryCode, req) {
  try {
    // Check if user is in Ghana and use Bitnob
    if (countryCode === 'GH') {
      const bitnobResult = await req.bitnobManager.createPaymentRequest({
        amount: amount,
        currency: currency.toUpperCase(),
        description: description || 'Service payment',
        customerEmail: req.user.email,
        metadata: {
          userId: req.user.userId,
          countryCode: countryCode
        }
      });

      if (bitnobResult.success) {
        return {
          success: true,
          reference: bitnobResult.reference,
          paymentUrl: bitnobResult.paymentUrl,
          metadata: {
            bitnobPaymentId: bitnobResult.paymentId,
            countryCode: countryCode,
            platform: 'bitnob'
          }
        };
      }
    }

    // Fallback to Coinbase Commerce
    const coinbaseResult = await req.cryptoPaymentManager.createCoinbaseCharge({
      amount: amount,
      currency: currency.toUpperCase(),
      description: description || 'Service payment',
      metadata: {
        userId: req.user.userId,
        countryCode: countryCode
      }
    });

    if (coinbaseResult.success) {
      return {
        success: true,
        reference: coinbaseResult.chargeId,
        paymentUrl: coinbaseResult.hostedUrl,
        metadata: {
          coinbaseChargeId: coinbaseResult.chargeId,
          countryCode: countryCode,
          platform: 'coinbase'
        }
      };
    }

    return { success: false, error: 'Failed to create crypto payment' };
  } catch (error) {
    console.error('Crypto payment creation failed:', error);
    return { success: false, error: error.message };
  }
}

async function confirmStripePayment(paymentIntentId, req) {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      return {
        success: true,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status
      };
    } else {
      return { success: false, error: `Payment not completed. Status: ${paymentIntent.status}` };
    }
  } catch (error) {
    console.error('Stripe payment confirmation failed:', error);
    return { success: false, error: error.message };
  }
}

async function confirmPaystackPayment(reference, req) {
  try {
    const result = await req.paystackManager.verifyTransaction(reference);
    
    if (result.success && result.status === 'success') {
      return {
        success: true,
        amount: result.amount,
        currency: result.currency,
        status: result.status,
        reference: reference
      };
    } else {
      return { success: false, error: 'Payment verification failed' };
    }
  } catch (error) {
    console.error('Paystack payment confirmation failed:', error);
    return { success: false, error: error.message };
  }
}

async function confirmCryptoPayment(reference, req) {
  try {
    // Try Bitnob first (for Ghanaian users)
    try {
      const bitnobResult = await req.bitnobManager.verifyPayment(reference);
      if (bitnobResult.success && bitnobResult.status === 'paid') {
        return {
          success: true,
          amount: bitnobResult.amount,
          currency: bitnobResult.currency,
          status: 'confirmed',
          reference: reference,
          platform: 'bitnob'
        };
      }
    } catch (bitnobError) {
      // Continue to Coinbase if Bitnob fails
    }

    // Try Coinbase Commerce
    const coinbaseResult = await req.cryptoPaymentManager.verifyCoinbaseCharge(reference);
    
    if (coinbaseResult.success && coinbaseResult.status === 'confirmed') {
      return {
        success: true,
        amount: coinbaseResult.amount,
        currency: coinbaseResult.currency,
        status: 'confirmed',
        reference: reference,
        platform: 'coinbase'
      };
    }

    return { success: false, error: 'Payment verification failed' };
  } catch (error) {
    console.error('Crypto payment confirmation failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * @route   POST /api/payments/paystack/initialize
 * @desc    Initialize Paystack payment for wallet top-up or service payment
 * @access  Private
 */
router.post('/paystack/initialize', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, type, serviceId, description, channels } = req.body;

    // Get user's country for currency detection
    const userCountry = await req.countryManager.getUserCountry(userId);
    
    // Debug logging for country detection
    console.log(`🌍 getUserCountry result:`, JSON.stringify(userCountry, null, 2));
    
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    const country = req.countryManager.getCountryByCode(countryCode);
    const currency = country ? country.currency : 'NGN';
    const currencySymbol = country ? country.currencySymbol : '₦';

    // Country-specific payment channels for Paystack
    const PAYMENT_CHANNELS_BY_COUNTRY = {
      NG: ['card', 'bank', 'ussd', 'bank_transfer'],
      GH: ['card', 'mobile_money'],
      KE: ['card', 'mobile_money'],
      ZA: ['card', 'eft', 'qr'],
    };
    const countryChannels = channels || PAYMENT_CHANNELS_BY_COUNTRY[countryCode] || ['card'];

    console.log(`💳 Payment init: Country=${countryCode} (${country?.name}), Currency=${currency}, Channels=${countryChannels.join(',')}${userCountry.source ? `, Source=${userCountry.source}` : ''}`);

    // Validate amount (minimum varies by currency)
    const minAmounts = { NGN: 100, GHS: 1, KES: 50, ZAR: 10 };
    const minAmount = minAmounts[currency] || 100;
    if (!amount || amount < minAmount) {
      return res.status(400).json({ error: `Minimum amount is ${currencySymbol}${minAmount}` });
    }

    // Get user details using MongoDB
    const { User, Transaction } = require('../config/database');
    const mongoose = require('mongoose');
    
    const user = await User.findById(userId).select('email username');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reference
    const reference = `PS_${Date.now()}_${userId.substring(0, 8)}`;

    // Generate callback URL for redirect flow
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const callbackUrl = `${clientUrl}/wallet?payment_status=success&reference=${reference}`;

    // Initialize payment with PaystackManager
    const paystackResult = await req.paystackManager.initializeTransaction({
      email: user.email,
      amount: amount, // PaystackManager handles conversion to smallest unit
      currency: currency,
      reference,
      callback_url: callbackUrl,
      channels: countryChannels,
      metadata: {
        userId,
        username: user.username,
        type: type || 'wallet_topup',
        serviceId: serviceId || null,
        countryCode: countryCode,
        description: description || `Wallet top-up - ${currencySymbol}${amount.toLocaleString()}`
      }
    });

    if (!paystackResult.success) {
      return res.status(400).json({ 
        error: 'Failed to initialize payment',
        message: paystackResult.error 
      });
    }

    // Create transaction record with detected currency using MongoDB
    await Transaction.create({
      user_id: mongoose.Types.ObjectId.createFromHexString(userId),
      service_id: serviceId || null,
      amount: amount,
      currency: currency,
      payment_method: 'paystack',
      reference: reference,
      status: 'pending',
      country_code: countryCode,
      type: type || 'wallet_topup',
      metadata: {
        type: type || 'wallet_topup',
        description: description || `Wallet top-up - ${currencySymbol}${amount.toLocaleString()}`
      }
    });

    res.json({
      success: true,
      authorizationUrl: paystackResult.authorizationUrl,
      authorization_url: paystackResult.authorizationUrl,
      reference,
      accessCode: paystackResult.accessCode,
      access_code: paystackResult.accessCode,
      currency: currency,
      currencySymbol: currencySymbol,
      country: countryCode
    });

  } catch (error) {
    console.error('Paystack initialize error:', error);
    res.status(500).json({ 
      error: 'Failed to initialize payment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/payments/paystack/inline-initialize
 * @desc    Initialize Paystack payment for inline popup (returns access_code)
 * @access  Private
 * 
 * This endpoint is specifically designed for Paystack's Inline JS popup integration.
 * It returns an access_code that the frontend uses to resume the transaction
 * in a popup overlay instead of redirecting to Paystack's hosted page.
 */
router.post('/paystack/inline-initialize', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, type, serviceId, description, channels, metadata = {} } = req.body;

    // Get user's country for currency detection
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    const country = req.countryManager.getCountryByCode(countryCode);
    const currency = country ? country.currency : 'NGN';
    const currencySymbol = country ? country.currencySymbol : '₦';

    // Payment channels available by country
    const COUNTRY_CHANNELS = {
      NG: ['card', 'bank', 'ussd', 'bank_transfer'],
      GH: ['card', 'mobile_money'],
      KE: ['card', 'mobile_money'],
      ZA: ['card', 'eft', 'qr'],
    };
    const availableChannels = channels || COUNTRY_CHANNELS[countryCode] || ['card'];

    // Validate amount (minimum varies by currency)
    const minAmounts = { NGN: 100, GHS: 1, KES: 50, ZAR: 10, UGX: 500, TZS: 500, RWF: 100, BWP: 5, ZMW: 10, MWK: 500 };
    const minAmount = minAmounts[currency] || 100;
    if (!amount || amount < minAmount) {
      return res.status(400).json({ 
        error: `Minimum amount is ${currencySymbol}${minAmount}`,
        minAmount,
        currency,
        currencySymbol
      });
    }

    // Get user details using MongoDB
    const { User, Transaction } = require('../config/database');
    const mongoose = require('mongoose');
    
    const user = await User.findById(userId).select('email username');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reference
    const reference = `PSI_${Date.now()}_${userId.substring(0, 8)}`;

    // Initialize payment with PaystackManager
    const paystackResult = await req.paystackManager.initializeTransaction({
      email: user.email,
      amount: amount,
      currency: currency,
      reference,
      channels: availableChannels,
      metadata: {
        userId,
        username: user.username,
        type: type || 'wallet_topup',
        serviceId: serviceId || null,
        countryCode: countryCode,
        description: description || `Payment - ${currencySymbol}${amount.toLocaleString()}`,
        inlinePayment: true,
        ...metadata
      }
    });

    if (!paystackResult.success) {
      return res.status(400).json({ 
        error: 'Failed to initialize payment',
        message: paystackResult.error 
      });
    }

    // Create transaction record with detected currency using MongoDB
    await Transaction.create({
      user_id: mongoose.Types.ObjectId.createFromHexString(userId),
      service_id: serviceId || null,
      amount: amount,
      currency: currency,
      payment_method: 'paystack_inline',
      reference: reference,
      status: 'pending',
      country_code: countryCode,
      type: type || 'wallet_topup',
      metadata: {
        type: type || 'wallet_topup',
        description: description || `Payment - ${currencySymbol}${amount.toLocaleString()}`,
        inlinePayment: true,
        channels: availableChannels
      }
    });

    console.log(`💳 Paystack inline payment initialized: ${reference} for user ${userId} (${currency} ${amount})`);

    res.json({
      success: true,
      accessCode: paystackResult.accessCode,
      access_code: paystackResult.accessCode,
      reference,
      currency: currency,
      currencySymbol: currencySymbol,
      country: countryCode,
      countryName: country?.name || 'Nigeria',
      availableChannels: availableChannels,
      amount: amount,
      email: user.email
    });

  } catch (error) {
    console.error('Paystack inline initialize error:', error);
    res.status(500).json({ 
      error: 'Failed to initialize inline payment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/payments/verify-inline
 * @desc    Verify an inline payment after completion
 * @access  Private
 */
router.post('/verify-inline', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.body;
    const userId = req.user.userId;

    if (!reference) {
      return res.status(400).json({ error: 'Payment reference is required' });
    }

    console.log(`🔍 Verifying payment: ${reference} for user: ${userId}`);

    // First check if transaction already exists and is completed
    const { Transaction, User } = require('../config/database');
    const mongoose = require('mongoose');

    const existingTransaction = await Transaction.findOne({ 
      reference: reference, 
      user_id: mongoose.Types.ObjectId.createFromHexString(userId) 
    });

    if (existingTransaction && existingTransaction.status === 'completed') {
      console.log(`ℹ️ Transaction already verified: ${reference}`);
      return res.json({
        success: true,
        status: 'already_verified',
        message: 'Payment already verified and credited',
        transaction: {
          id: existingTransaction._id.toString(),
          amount: existingTransaction.amount,
          currency: existingTransaction.currency,
          type: existingTransaction.type,
          reference: existingTransaction.reference
        },
        amount: existingTransaction.amount,
        currency: existingTransaction.currency
      });
    }

    // Verify with Paystack
    const verifyResult = await req.paystackManager.verifyTransaction(reference);
    console.log(`📊 Paystack verification result:`, JSON.stringify(verifyResult, null, 2));

    if (!verifyResult.success) {
      return res.status(400).json({ 
        error: 'Payment verification failed',
        message: verifyResult.error 
      });
    }

    // Update transaction status in database
    const transaction = await Transaction.findOneAndUpdate(
      { reference: reference, user_id: mongoose.Types.ObjectId.createFromHexString(userId) },
      { 
        $set: { 
          status: verifyResult.status === 'success' ? 'completed' : verifyResult.status,
          confirmed_at: new Date(),
          'metadata.paystack_response': verifyResult
        } 
      },
      { new: true }
    );

    if (!transaction) {
      console.error(`❌ Transaction not found for reference: ${reference}`);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    console.log(`✅ Transaction updated: ${transaction._id}, status: ${transaction.status}`);

    // If it's a deposit or wallet_topup, log balance update
    if ((transaction.type === 'deposit' || transaction.type === 'wallet_topup') && verifyResult.status === 'success') {
      console.log(`✅ Wallet credit verified and completed: ${reference} - ${transaction.currency} ${transaction.amount} (type: ${transaction.type})`);
    }

    // Emit real-time notification
    if (req.io) {
      req.io.to(`user_${userId}`).emit('payment_verified', {
        reference,
        status: verifyResult.status,
        amount: transaction.amount,
        currency: transaction.currency,
        type: transaction.type,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      status: verifyResult.status,
      transaction: {
        id: transaction._id.toString(),
        amount: transaction.amount,
        currency: transaction.currency,
        type: transaction.type,
        reference: transaction.reference
      },
      amount: transaction.amount,
      currency: transaction.currency
    });

  } catch (error) {
    console.error('Verify inline payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Webhook handlers
router.post('/paystack-webhook', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (event === 'charge.success') {
      const { User, Transaction, Subscription } = require('../config/database');

      console.log(`🔄 Processing Paystack webhook for: ${data.reference}`);
      console.log(`📊 Webhook data: amount=${data.amount}, currency=${data.currency}, status=${data.status}`);

      // Update transaction status using MongoDB - use 'completed' for successful payments
      console.log(`🔍 Looking for MongoDB transaction with reference: ${data.reference}`);
      const transaction = await Transaction.findOneAndUpdate(
        { reference: data.reference },
        { $set: { status: 'completed', confirmed_at: new Date() } },
        { new: true }
      );

      if (transaction) {
        console.log(`✅ Updated MongoDB transaction: ${transaction._id.toString()}, user: ${transaction.user_id}, status: completed`);
      } else {
        console.log(`❌ No MongoDB transaction found for reference: ${data.reference}`);
      }
      
      // Update subscription status using MongoDB
      console.log(`🔍 Looking for MongoDB subscription with reference: ${data.reference}`);
      const subscription = await Subscription.findOneAndUpdate(
        { paystack_reference: data.reference },
        { $set: { status: 'active', activated_at: new Date() } },
        { new: true }
      );

      if (subscription) {
        console.log(`✅ Updated MongoDB subscription: ${subscription._id.toString()}, user: ${subscription.user_id}`);
        const userId = subscription.user_id.toString();

        // Update user subscription status with tier and expiration using MongoDB
        try {
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);

          console.log(`🔄 Updating user subscription status for user: ${userId}`);
          await User.findByIdAndUpdate(subscription.user_id, {
            $set: {
              is_subscribed: true,
              subscription_tier: 'premium',
              subscription_expires_at: expiresAt,
              updated_at: new Date()
            }
          });

          console.log(`✅ User subscription status updated for user: ${userId} (is_subscribed: true, subscription_tier: premium, expires: 1 year)`);
        } catch (userUpdateError) {
          console.log(`⚠️  User update failed: ${userUpdateError.message}`);
          console.log(`   Subscription activated but user status not updated`);
        }
        
        // Emit real-time payment notification from webhook
        if (req.io) {
          req.io.to(`user_${userId}`).emit('payment_confirmed', {
            reference: data.reference,
            status: 'confirmed',
            subscriptionActivated: true,
            timestamp: new Date().toISOString()
          });
          console.log(`📡 Webhook payment notification sent to user: ${userId}`);
          
          // Save notification to database
          try {
            await NotificationService.createAndEmit(req.io, {
              userId,
              type: 'payment',
              title: 'Subscription Activated',
              message: 'Your subscription has been successfully activated!',
              data: { reference: data.reference, subscriptionActivated: true }
            });
          } catch (notifErr) {
            console.error('Failed to save payment notification:', notifErr);
          }
        }
        
        console.log(`✅ Subscription activated for user: ${userId}`);
      } else if (transaction) {
        // Notify user of transaction confirmation even if no subscription
        const userId = transaction.user_id.toString();
        if (req.io) {
          req.io.to(`user_${userId}`).emit('payment_confirmed', {
            reference: data.reference,
            amount: transaction.amount,
            currency: transaction.currency,
            status: 'confirmed',
            timestamp: new Date().toISOString()
          });
          console.log(`📡 Transaction payment notification sent to user: ${userId}`);
        }
      }
      
      console.log(`✅ Paystack payment confirmed: ${data.reference}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

router.post('/coinbase-webhook', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (event.type === 'charge:confirmed') {
      const { Transaction } = require('../config/database');
      
      // Update transaction status using MongoDB
      const transaction = await Transaction.findOneAndUpdate(
        { reference: data.id },
        { $set: { status: 'confirmed', confirmed_at: new Date() } },
        { new: true }
      );
      
      // Emit real-time notification for crypto payment
      if (req.io && transaction) {
        const userId = transaction.user_id.toString();
        req.io.to(`user_${userId}`).emit('payment_confirmed', {
          reference: data.id,
          amount: transaction.amount,
          currency: transaction.currency,
          paymentMethod: 'crypto',
          status: 'confirmed',
          timestamp: new Date().toISOString()
        });
        console.log(`📡 Crypto payment notification sent to user: ${userId}`);
        
        // Save notification to database
        try {
          await NotificationService.createAndEmit(req.io, {
            userId,
            type: 'payment',
            title: 'Crypto Payment Confirmed',
            message: `Your crypto payment of ${transaction.amount} ${transaction.currency} has been confirmed!`,
            data: { reference: data.id, amount: transaction.amount, currency: transaction.currency }
          });
        } catch (notifErr) {
          console.error('Failed to save crypto payment notification:', notifErr);
        }
      }
      
      console.log(`✅ Coinbase payment confirmed: ${data.id}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Coinbase webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * @route   GET /api/payments/balance
 * @desc    Get user's wallet balance (mobile app compatibility)
 * @access  Private
 */
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { Transaction } = require('../config/database');
    const mongoose = require('mongoose');
    
    // Default response for mock user or when tables don't exist
    let earnings = 0;
    let pendingEarnings = 0;
    let totalSpent = 0;
    let completedTransactions = 0;
    let pendingTransactions = 0;
    let currency = 'NGN';
    
    const userObjectId = mongoose.Types.ObjectId.createFromHexString(userId);
    
    // Try to get transaction summary using MongoDB
    try {
      const spentResult = await Transaction.aggregate([
        { $match: { client_id: userObjectId } },
        {
          $group: {
            _id: null,
            total_spent: { $sum: { $cond: [{ $in: ['$status', ['confirmed', 'completed']] }, '$amount', 0] } },
            completed_count: { $sum: { $cond: [{ $in: ['$status', ['confirmed', 'completed']] }, 1, 0] } },
            pending_count: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }
          }
        }
      ]);
      
      if (spentResult[0]) {
        totalSpent = spentResult[0].total_spent || 0;
        completedTransactions = spentResult[0].completed_count || 0;
        pendingTransactions = spentResult[0].pending_count || 0;
      }
    } catch (dbError) {
      console.log('Transactions query failed, using defaults:', dbError.message);
    }
    
    // Try to get earnings as a provider (provider_id = user receiving money) using MongoDB
    try {
      const earningsResult = await Transaction.aggregate([
        { $match: { provider_id: userObjectId } },
        {
          $group: {
            _id: null,
            earnings: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] } },
            pending_earnings: { $sum: { $cond: [{ $in: ['$status', ['pending', 'held']] }, '$amount', 0] } }
          }
        }
      ]);
      
      if (earningsResult[0]) {
        earnings = earningsResult[0].earnings || 0;
        pendingEarnings = earningsResult[0].pending_earnings || 0;
      }
    } catch (dbError) {
      console.log('Escrow query failed, using defaults:', dbError.message);
    }
    
    // Get user's country for currency
    try {
      const userCountry = await req.countryManager?.getUserCountry(userId);
      if (userCountry?.success && userCountry?.country?.currency) {
        currency = userCountry.country.currency;
      }
    } catch (e) {
      // Use default currency
    }
    
    res.json({
      success: true,
      balance: {
        available: earnings,
        pending: pendingEarnings,
        total: earnings + pendingEarnings,
        currency: currency
      },
      stats: {
        totalSpent: totalSpent,
        completedTransactions: completedTransactions,
        pendingTransactions: pendingTransactions
      }
    });
    
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

/**
 * @route   GET /api/payments/wallet
 * @desc    Alias for /balance - Get wallet info (mobile app compatibility)
 * @access  Private
 */
router.get('/wallet', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { User, Transaction } = require('../config/database');
    
    let balance = 0;
    let escrowHeld = 0;
    let pendingWithdrawal = 0;
    let totalEarnings = 0;
    let currency = 'NGN';
    let currencySymbol = '₦';
    
    // Get user's country for currency
    try {
      const userCountry = await req.countryManager?.getUserCountry(userId);
      if (userCountry?.success && userCountry?.country) {
        currency = userCountry.country.currency || 'NGN';
        currencySymbol = userCountry.country.currencySymbol || '₦';
      }
    } catch (e) {
      // Use default currency
    }
    
    // Try to get balance from transactions using MongoDB
    try {
      // Get completed earnings (for providers)
      const earningsResult = await Transaction.aggregate([
        { $match: { provider_id: require('mongoose').Types.ObjectId.createFromHexString(userId), status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      // Get total earnings (including released)
      const totalEarningsResult = await Transaction.aggregate([
        { $match: { provider_id: require('mongoose').Types.ObjectId.createFromHexString(userId), status: { $in: ['completed', 'released'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      // Get escrow held (as client - money waiting to be released)
      const escrowResult = await Transaction.aggregate([
        { $match: { client_id: require('mongoose').Types.ObjectId.createFromHexString(userId), status: { $in: ['pending', 'held', 'escrow_held', 'in_progress'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      // Get pending withdrawals
      const withdrawalResult = await Transaction.aggregate([
        { $match: { user_id: require('mongoose').Types.ObjectId.createFromHexString(userId), type: 'withdrawal', status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      // Get successful deposits (add to balance) - include both 'completed' and 'confirmed' statuses
      // Also include 'wallet_topup' type which is used by some deposit flows
      const depositResult = await Transaction.aggregate([
        { 
          $match: { 
            user_id: require('mongoose').Types.ObjectId.createFromHexString(userId), 
            type: { $in: ['deposit', 'wallet_topup'] }, 
            status: { $in: ['completed', 'confirmed'] } 
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      // Get completed withdrawals (subtract from balance)
      const withdrawnResult = await Transaction.aggregate([
        { 
          $match: { 
            user_id: require('mongoose').Types.ObjectId.createFromHexString(userId), 
            type: 'withdrawal', 
            status: { $in: ['completed', 'confirmed'] } 
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      // Get escrow held by user as CLIENT (money they're holding for services)
      const escrowAsClientResult = await Transaction.aggregate([
        { 
          $match: { 
            client_id: require('mongoose').Types.ObjectId.createFromHexString(userId), 
            type: 'escrow_hold',
            status: { $in: ['pending', 'held', 'escrow_held', 'in_progress', 'pin_entered'] } 
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      // Get escrow released TO user as PROVIDER (money they've earned from released escrows)
      const escrowReleasedResult = await Transaction.aggregate([
        { 
          $match: { 
            user_id: require('mongoose').Types.ObjectId.createFromHexString(userId), 
            type: 'escrow_release',
            status: { $in: ['completed', 'confirmed'] } 
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      const deposits = depositResult[0]?.total || 0;
      const withdrawn = withdrawnResult[0]?.total || 0;
      const escrowHeldAsClient = escrowAsClientResult[0]?.total || 0;
      const escrowReleased = escrowReleasedResult[0]?.total || 0;
      
      // Available balance = deposits + escrow releases - withdrawals - held escrows
      balance = deposits + escrowReleased - withdrawn - escrowHeldAsClient;
      totalEarnings = (totalEarningsResult[0]?.total || 0) + escrowReleased;
      escrowHeld = escrowHeldAsClient;
      pendingWithdrawal = withdrawalResult[0]?.total || 0;
      
    } catch (dbError) {
      console.log('Wallet query failed, using defaults:', dbError.message);
    }
    
    res.json({
      success: true,
      wallet: {
        balance: balance,
        escrowHeld: escrowHeld,
        pendingWithdrawal: pendingWithdrawal,
        totalEarnings: totalEarnings,
        currency: currency,
        currencySymbol: currencySymbol
      },
      // Also provide flat structure for compatibility
      balance: balance,
      escrowHeld: escrowHeld,
      pendingWithdrawal: pendingWithdrawal,
      totalEarnings: totalEarnings,
      currency: currency,
      currencySymbol: currencySymbol
    });
    
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: 'Failed to get wallet info' });
  }
});

/**
 * @route   POST /api/payments/deposit
 * @desc    Initialize wallet deposit via Paystack (country-aware)
 * @access  Private
 */
router.post('/deposit', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, channels } = req.body;
    const { User, Transaction } = require('../config/database');
    const mongoose = require('mongoose');

    // Get user's country for currency detection (now detects from phone)
    const userCountry = await req.countryManager.getUserCountry(userId);
    
    // Debug logging
    console.log(`🌍 Deposit - getUserCountry result:`, JSON.stringify(userCountry, null, 2));
    
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    const country = req.countryManager.getCountryByCode(countryCode);
    const currency = country ? country.currency : 'NGN';
    const currencySymbol = country ? country.currencySymbol : '₦';

    // Payment channels available by country
    const COUNTRY_CHANNELS = {
      NG: ['card', 'bank', 'ussd', 'bank_transfer'],
      GH: ['card', 'mobile_money'],
      KE: ['card', 'mobile_money'],
      ZA: ['card', 'eft', 'qr'],
    };
    const availableChannels = channels || COUNTRY_CHANNELS[countryCode] || ['card'];

    console.log(`💳 Deposit: Country=${countryCode} (${country?.name}), Currency=${currency}, Amount=${amount}, Channels=${availableChannels.join(',')}${userCountry.source ? `, Source=${userCountry.source}` : ''}`);

    // Validate amount based on currency
    const minAmounts = { NGN: 100, GHS: 1, KES: 50, ZAR: 10, UGX: 500, TZS: 500, RWF: 100, BWP: 5, ZMW: 10, MWK: 500 };
    const minAmount = minAmounts[currency] || 100;
    
    if (!amount || amount < minAmount) {
      return res.status(400).json({ 
        error: `Minimum deposit is ${currencySymbol}${minAmount}`,
        minAmount: minAmount,
        currency: currency,
        currencySymbol: currencySymbol
      });
    }

    // Get user email using MongoDB
    const user = await User.findById(userId).select('email username');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate reference
    const reference = `DEP_${Date.now()}_${userId.substring(0, 8)}`;

    // Generate callback URL for redirect flow
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const callbackUrl = `${clientUrl}/wallet?payment_status=success&reference=${reference}`;

    // Initialize Paystack payment with country-specific channels
    const paystackResult = await req.paystackManager.initializeTransaction({
      email: user.email,
      amount: amount,
      currency: currency,
      reference,
      callback_url: callbackUrl,
      channels: availableChannels,
      metadata: {
        userId,
        username: user.username,
        type: 'deposit',
        countryCode: countryCode,
        channels: availableChannels
      }
    });

    if (!paystackResult.success) {
      return res.status(400).json({ 
        error: 'Failed to initialize deposit',
        message: paystackResult.error 
      });
    }

    // Create transaction record using MongoDB
    await Transaction.create({
      user_id: mongoose.Types.ObjectId.createFromHexString(userId),
      amount: amount,
      currency: currency,
      payment_method: 'paystack',
      reference: reference,
      status: 'pending',
      country_code: countryCode,
      type: 'deposit',
      metadata: { 
        type: 'deposit', 
        description: `Wallet deposit - ${currencySymbol}${amount.toLocaleString()}`,
        channels: availableChannels
      }
    });

    res.json({
      success: true,
      // For redirect flow (legacy)
      authorizationUrl: paystackResult.authorizationUrl,
      authorization_url: paystackResult.authorizationUrl,
      // For inline popup flow (new)
      accessCode: paystackResult.accessCode,
      access_code: paystackResult.accessCode,
      reference,
      amount: amount,
      currency: currency,
      currencySymbol: currencySymbol,
      country: countryCode,
      countryName: country?.name || 'Nigeria',
      availableChannels: availableChannels,
      email: user.email
    });

  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Failed to process deposit' });
  }
});

/**
 * @route   POST /api/payments/withdraw
 * @desc    Request withdrawal to bank account (country-aware)
 * @access  Private
 */
router.post('/withdraw', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, bankCode, accountNumber, accountName } = req.body;
    const { User, Transaction } = require('../config/database');
    const mongoose = require('mongoose');

    // Get user's country for currency detection
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    const country = req.countryManager.getCountryByCode(countryCode);
    const currency = country ? country.currency : 'NGN';
    const currencySymbol = country ? country.currencySymbol : '₦';

    // Validate required fields
    if (!amount || !bankCode || !accountNumber) {
      return res.status(400).json({ error: 'Amount, bank code, and account number are required' });
    }

    // Minimum withdrawal amounts by currency
    const minAmounts = { NGN: 1000, GHS: 10, KES: 100, ZAR: 50, UGX: 5000, TZS: 5000, RWF: 1000, BWP: 20, ZMW: 50, MWK: 5000 };
    const minAmount = minAmounts[currency] || 1000;
    
    if (amount < minAmount) {
      return res.status(400).json({ 
        error: `Minimum withdrawal is ${currencySymbol}${minAmount}`,
        minAmount: minAmount,
        currency: currency
      });
    }

    // Check available balance using MongoDB
    const userObjectId = mongoose.Types.ObjectId.createFromHexString(userId);
    
    const earningsResult = await Transaction.aggregate([
      { $match: { provider_id: userObjectId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const depositResult = await Transaction.aggregate([
      { $match: { user_id: userObjectId, type: 'deposit', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const withdrawnResult = await Transaction.aggregate([
      { $match: { user_id: userObjectId, type: 'withdrawal', status: { $in: ['completed', 'pending'] } } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);
    
    const availableBalance = (earningsResult[0]?.total || 0) + (depositResult[0]?.total || 0) - (withdrawnResult[0]?.total || 0);
    
    if (amount > availableBalance) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available: ${currencySymbol}${availableBalance.toLocaleString()}`,
        availableBalance: availableBalance,
        requestedAmount: amount
      });
    }

    // Get user info using MongoDB
    const user = await User.findById(userId).select('email username');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create transfer recipient with Paystack
    const recipientResult = await req.paystackManager.createTransferRecipient({
      name: accountName || user.username,
      accountNumber: accountNumber,
      bankCode: bankCode,
      currency: currency
    });

    if (!recipientResult.success) {
      return res.status(400).json({ 
        error: 'Failed to verify bank account',
        message: recipientResult.error 
      });
    }

    const reference = `WD_${Date.now()}_${userId.substring(0, 8)}`;

    // Initiate transfer
    const transferResult = await req.paystackManager.initiateTransfer({
      amount: amount,
      recipientCode: recipientResult.recipient_code,
      reason: `Withdrawal - ${user.username}`,
      reference: reference
    });

    if (!transferResult.success) {
      return res.status(400).json({ 
        error: 'Failed to initiate withdrawal',
        message: transferResult.error 
      });
    }

    // Create withdrawal transaction record using MongoDB
    await Transaction.create({
      user_id: userObjectId,
      amount: -amount, // Negative for withdrawal
      currency: currency,
      payment_method: 'paystack_transfer',
      reference: reference,
      status: 'pending',
      country_code: countryCode,
      type: 'withdrawal',
      metadata: { 
        type: 'withdrawal', 
        bankCode: bankCode,
        accountNumber: accountNumber,
        accountName: accountName,
        recipientCode: recipientResult.recipient_code,
        transferCode: transferResult.transfer_code
      }
    });

    res.json({
      success: true,
      message: `Withdrawal of ${currencySymbol}${amount.toLocaleString()} initiated`,
      reference: reference,
      transferCode: transferResult.transfer_code,
      status: 'pending',
      currency: currency,
      currencySymbol: currencySymbol
    });

  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

/**
 * @route   GET /api/payments/banks
 * @desc    Get list of banks for user's country
 * @access  Private
 */
router.get('/banks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's country
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code.toLowerCase() : 'ng';

    // Get bank list from Paystack
    const banksResult = await req.paystackManager.getBankList(countryCode);

    if (!banksResult.success) {
      return res.status(400).json({ 
        error: 'Failed to fetch banks',
        message: banksResult.error 
      });
    }

    res.json({
      success: true,
      banks: banksResult.banks,
      country: countryCode.toUpperCase(),
      total: banksResult.banks.length
    });

  } catch (error) {
    console.error('Get banks error:', error);
    res.status(500).json({ error: 'Failed to fetch banks' });
  }
});

/**
 * @route   POST /api/payments/verify-account
 * @desc    Verify bank account number
 * @access  Private
 */
router.post('/verify-account', authMiddleware, async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body;

    if (!accountNumber || !bankCode) {
      return res.status(400).json({ error: 'Account number and bank code are required' });
    }

    // Verify account with Paystack
    const verifyResult = await req.paystackManager.verifyBankAccount(accountNumber, bankCode);

    if (!verifyResult.success) {
      return res.status(400).json({ 
        error: 'Could not verify account',
        message: verifyResult.error 
      });
    }

    res.json({
      success: true,
      accountName: verifyResult.account_name,
      accountNumber: verifyResult.account_number,
      bankId: verifyResult.bank_id
    });

  } catch (error) {
    console.error('Verify account error:', error);
    res.status(500).json({ error: 'Failed to verify account' });
  }
});

module.exports = router;
