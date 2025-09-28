const express = require('express');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

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
    await query(`
      UPDATE transactions 
      SET status = $1, confirmed_at = CURRENT_TIMESTAMP, metadata = jsonb_set(metadata, '{confirmation}', $2)
      WHERE (payment_intent_id = $3 OR reference = $4) AND user_id = $5
    `, [
      'confirmed',
      JSON.stringify(paymentResult),
      paymentIntentId || null,
      reference || null,
      userId
    ]);

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

    let whereClause = 'WHERE user_id = $1';
    let params = [userId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (country) {
      whereClause += ` AND country_code = $${paramIndex}`;
      params.push(country.toUpperCase());
      paramIndex++;
    }

    const { query } = require('../config/database');
    const result = await query(`
      SELECT 
        t.*,
        s.title as service_title,
        c.name as country_name,
        c.currency_symbol
      FROM transactions t
      LEFT JOIN services s ON t.service_id = s.id
      LEFT JOIN countries c ON t.country_code = c.code
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

// Webhook handlers
router.post('/paystack-webhook', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (event === 'charge.success') {
      const { query } = require('../config/database');

      console.log(`🔄 Processing Paystack webhook for: ${data.reference}`);

      // Update transaction status
      await query(`
        UPDATE transactions 
        SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
        WHERE reference = $1
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
        
        console.log(`✅ Subscription activated for user: ${userId}`);
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
      await query(`
        UPDATE transactions 
        SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
        WHERE reference = $1
      `, [data.id]);
      
      console.log(`✅ Coinbase payment confirmed: ${data.id}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Coinbase webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
