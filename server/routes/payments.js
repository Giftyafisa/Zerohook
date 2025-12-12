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

    // Create transaction record
    const { query } = require('../config/database');
    const result = await query(`
      INSERT INTO transactions (
        user_id, service_id, amount, currency, payment_method, 
        payment_intent_id, reference, status, country_code, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      userId, 
      serviceId || null,
      amount, 
      currency.toUpperCase(),
      paymentMethod,
      paymentData.paymentIntentId || null,
      paymentData.reference || null,
      'pending',
      countryCode,
      JSON.stringify({
        country: countryCode,
        paymentMethod,
        ...paymentData.metadata
      })
    ]);

    res.json({
      success: true,
      transactionId: result.rows[0].id,
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

    // Update transaction status
    const { query } = require('../config/database');
    const transactionUpdate = await query(`
      UPDATE transactions 
      SET status = $1, confirmed_at = CURRENT_TIMESTAMP, metadata = jsonb_set(metadata, '{confirmation}', $2)
      WHERE (payment_intent_id = $3 OR reference = $4) AND user_id = $5
      RETURNING id, amount, currency
    `, [
      'confirmed',
      JSON.stringify(paymentResult),
      paymentIntentId || null,
      reference || null,
      userId
    ]);

    // Emit real-time payment confirmation to user
    if (req.io && transactionUpdate.rows.length > 0) {
      const transaction = transactionUpdate.rows[0];
      req.io.to(`user_${userId}`).emit('payment_confirmed', {
        transactionId: transaction.id,
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
    const { page = 1, limit = 10, status, country } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE (t.client_id = $1 OR t.provider_id = $1)';
    let params = [userId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (country) {
      whereClause += ` AND t.country_code = $${paramIndex}`;
      params.push(country.toUpperCase());
      paramIndex++;
    }

    const { query } = require('../config/database');
    const result = await query(`
      SELECT 
        t.*,
        s.title as service_title,
        CASE 
          WHEN t.client_id = $1 THEN 'expense'
          WHEN t.provider_id = $1 THEN 'income'
        END as type,
        CASE 
          WHEN t.client_id = $1 THEN provider.username
          WHEN t.provider_id = $1 THEN client.username
        END as other_party
      FROM transactions t
      LEFT JOIN adult_services s ON t.service_id = s.id
      LEFT JOIN users client ON t.client_id = client.id
      LEFT JOIN users provider ON t.provider_id = provider.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM transactions t
      ${whereClause}
    `, params);

    res.json({
      success: true,
      transactions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

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
    const { amount, type, serviceId, description } = req.body;

    // Get user's country for currency detection
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    const country = req.countryManager.getCountryByCode(countryCode);
    const currency = country ? country.currency : 'NGN';
    const currencySymbol = country ? country.currencySymbol : '₦';

    // Validate amount (minimum varies by currency)
    const minAmounts = { NGN: 100, GHS: 1, KES: 50, ZAR: 10 };
    const minAmount = minAmounts[currency] || 100;
    if (!amount || amount < minAmount) {
      return res.status(400).json({ error: `Minimum amount is ${currencySymbol}${minAmount}` });
    }

    // Get user details
    const { query } = require('../config/database');
    const userResult = await query(`
      SELECT email, username FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Generate reference
    const reference = `PS_${Date.now()}_${userId.substring(0, 8)}`;

    // Initialize payment with PaystackManager - FIXED: Use correct method name
    const paystackResult = await req.paystackManager.initializeTransaction({
      email: user.email,
      amount: amount, // PaystackManager handles conversion to smallest unit
      currency: currency,
      reference,
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

    // Create transaction record with detected currency
    await query(`
      INSERT INTO transactions (
        user_id, service_id, amount, currency, payment_method, 
        reference, status, country_code, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    `, [
      userId,
      serviceId || null,
      amount,
      currency,
      'paystack',
      reference,
      'pending',
      countryCode,
      JSON.stringify({
        type: type || 'wallet_topup',
        description: description || `Wallet top-up - ${currencySymbol}${amount.toLocaleString()}`
      })
    ]);

    res.json({
      success: true,
      authorizationUrl: paystackResult.authorization_url,
      authorization_url: paystackResult.authorization_url,
      reference,
      accessCode: paystackResult.access_code,
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

// Webhook handlers
router.post('/paystack-webhook', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (event === 'charge.success') {
      const { query } = require('../config/database');

      console.log(`🔄 Processing Paystack webhook for: ${data.reference}`);

      // Update transaction status
      const transactionUpdate = await query(`
        UPDATE transactions 
        SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
        WHERE reference = $1
        RETURNING user_id, amount, currency
      `, [data.reference]);
      
      // Update subscription status
      const subscriptionResult = await query(`
        UPDATE subscriptions 
        SET status = 'active', activated_at = CURRENT_TIMESTAMP
        WHERE paystack_reference = $1
        RETURNING user_id
      `, [data.reference]);
      
      if (subscriptionResult.rows.length > 0) {
        const userId = subscriptionResult.rows[0].user_id;
        
        // Update user subscription status
        try {
          await query(`
            UPDATE users 
            SET is_subscribed = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [userId]);
          console.log(`✅ User subscription status updated for user: ${userId}`);
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
      } else if (transactionUpdate.rows.length > 0) {
        // Notify user of transaction confirmation even if no subscription
        const userId = transactionUpdate.rows[0].user_id;
        if (req.io) {
          req.io.to(`user_${userId}`).emit('payment_confirmed', {
            reference: data.reference,
            amount: transactionUpdate.rows[0].amount,
            currency: transactionUpdate.rows[0].currency,
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
      const { query } = require('../config/database');
      
      // Update transaction status
      const transactionUpdate = await query(`
        UPDATE transactions 
        SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
        WHERE reference = $1
        RETURNING user_id, amount, currency
      `, [data.id]);
      
      // Emit real-time notification for crypto payment
      if (req.io && transactionUpdate.rows.length > 0) {
        const userId = transactionUpdate.rows[0].user_id;
        req.io.to(`user_${userId}`).emit('payment_confirmed', {
          reference: data.id,
          amount: transactionUpdate.rows[0].amount,
          currency: transactionUpdate.rows[0].currency,
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
            message: `Your crypto payment of ${transactionUpdate.rows[0].amount} ${transactionUpdate.rows[0].currency} has been confirmed!`,
            data: { reference: data.id, amount: transactionUpdate.rows[0].amount, currency: transactionUpdate.rows[0].currency }
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
    const { query } = require('../config/database');
    
    // Default response for mock user or when tables don't exist
    let earnings = 0;
    let pendingEarnings = 0;
    let totalSpent = 0;
    let completedTransactions = 0;
    let pendingTransactions = 0;
    let currency = 'NGN';
    
    // Try to get transaction summary - transactions table uses client_id/provider_id not user_id
    try {
      const transactionResult = await query(`
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'confirmed' OR status = 'completed' THEN amount ELSE 0 END), 0) as total_spent,
          COUNT(CASE WHEN status = 'confirmed' OR status = 'completed' THEN 1 END) as completed_transactions,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions
        FROM transactions 
        WHERE client_id = $1
      `, [userId]);
      
      if (transactionResult.rows[0]) {
        totalSpent = parseFloat(transactionResult.rows[0].total_spent) || 0;
        completedTransactions = parseInt(transactionResult.rows[0].completed_transactions) || 0;
        pendingTransactions = parseInt(transactionResult.rows[0].pending_transactions) || 0;
      }
    } catch (dbError) {
      console.log('Transactions query failed, using defaults:', dbError.message);
    }
    
    // Try to get earnings as a provider (provider_id = user receiving money)
    try {
      const escrowResult = await query(`
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as earnings,
          COALESCE(SUM(CASE WHEN status = 'pending' OR status = 'held' THEN amount ELSE 0 END), 0) as pending_earnings
        FROM transactions
        WHERE provider_id = $1
      `, [userId]);
      
      if (escrowResult.rows[0]) {
        earnings = parseFloat(escrowResult.rows[0].earnings) || 0;
        pendingEarnings = parseFloat(escrowResult.rows[0].pending_earnings) || 0;
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
    const { query } = require('../config/database');
    
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
    
    // Try to get balance from transactions
    try {
      // Get completed earnings (for providers)
      const earningsResult = await query(`
        SELECT COALESCE(SUM(amount), 0) as balance
        FROM transactions 
        WHERE provider_id = $1 AND status = 'completed'
      `, [userId]);
      
      // Get total earnings (including released)
      const totalEarningsResult = await query(`
        SELECT COALESCE(SUM(amount), 0) as total_earnings
        FROM transactions 
        WHERE provider_id = $1 AND status IN ('completed', 'released')
      `, [userId]);
      
      // Get escrow held (as client - money waiting to be released)
      const escrowResult = await query(`
        SELECT COALESCE(SUM(amount), 0) as escrow_held
        FROM transactions 
        WHERE client_id = $1 AND status IN ('pending', 'held', 'escrow_held', 'in_progress')
      `, [userId]);
      
      // Get pending withdrawals
      const withdrawalResult = await query(`
        SELECT COALESCE(SUM(amount), 0) as pending_withdrawal
        FROM transactions 
        WHERE user_id = $1 AND metadata->>'type' = 'withdrawal' AND status = 'pending'
      `, [userId]);
      
      if (earningsResult.rows[0]) {
        balance = parseFloat(earningsResult.rows[0].balance) || 0;
      }
      if (totalEarningsResult.rows[0]) {
        totalEarnings = parseFloat(totalEarningsResult.rows[0].total_earnings) || 0;
      }
      if (escrowResult.rows[0]) {
        escrowHeld = parseFloat(escrowResult.rows[0].escrow_held) || 0;
      }
      if (withdrawalResult.rows[0]) {
        pendingWithdrawal = parseFloat(withdrawalResult.rows[0].pending_withdrawal) || 0;
      }
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
    const { amount } = req.body;
    const { query } = require('../config/database');

    // Get user's country for currency detection
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    const country = req.countryManager.getCountryByCode(countryCode);
    const currency = country ? country.currency : 'NGN';
    const currencySymbol = country ? country.currencySymbol : '₦';

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

    // Get user email
    const userResult = await query('SELECT email, username FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Generate reference
    const reference = `DEP_${Date.now()}_${userId.substring(0, 8)}`;

    // Initialize Paystack payment
    const paystackResult = await req.paystackManager.initializeTransaction({
      email: user.email,
      amount: amount,
      currency: currency,
      reference,
      metadata: {
        userId,
        username: user.username,
        type: 'deposit',
        countryCode: countryCode
      }
    });

    if (!paystackResult.success) {
      return res.status(400).json({ 
        error: 'Failed to initialize deposit',
        message: paystackResult.error 
      });
    }

    // Create transaction record
    await query(`
      INSERT INTO transactions (
        user_id, amount, currency, payment_method, reference, status, country_code, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    `, [
      userId, amount, currency, 'paystack', reference, 'pending', countryCode,
      JSON.stringify({ type: 'deposit', description: `Wallet deposit - ${currencySymbol}${amount.toLocaleString()}` })
    ]);

    res.json({
      success: true,
      authorizationUrl: paystackResult.authorization_url,
      reference,
      accessCode: paystackResult.access_code,
      amount: amount,
      currency: currency,
      currencySymbol: currencySymbol,
      country: countryCode
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
    const { query } = require('../config/database');

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

    // Check available balance
    const balanceResult = await query(`
      SELECT COALESCE(SUM(amount), 0) as balance
      FROM transactions 
      WHERE provider_id = $1 AND status = 'completed'
    `, [userId]);
    
    const availableBalance = parseFloat(balanceResult.rows[0]?.balance) || 0;
    
    if (amount > availableBalance) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available: ${currencySymbol}${availableBalance.toLocaleString()}`,
        availableBalance: availableBalance,
        requestedAmount: amount
      });
    }

    // Get user info
    const userResult = await query('SELECT email, username FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

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

    // Create withdrawal transaction record
    await query(`
      INSERT INTO transactions (
        user_id, amount, currency, payment_method, reference, status, country_code, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    `, [
      userId, -amount, currency, 'paystack_transfer', reference, 'pending', countryCode,
      JSON.stringify({ 
        type: 'withdrawal', 
        bankCode: bankCode,
        accountNumber: accountNumber,
        accountName: accountName,
        recipientCode: recipientResult.recipient_code,
        transferCode: transferResult.transfer_code
      })
    ]);

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
