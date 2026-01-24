const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('./auth');
const { Subscription, SubscriptionPlan, User } = require('../config/database');
const mongoose = require('mongoose');
const router = express.Router();

// Helper function to get country-specific currency
async function getCountryCurrency(countryCode) {
  try {
    const countryResult = await query(`
      SELECT currency FROM countries WHERE code = $1
    `, [countryCode.toUpperCase()]);
    
    if (countryResult.rows.length > 0) {
      return countryResult.rows[0].currency;
    }
    
    // Default to NGN (Nigerian Naira) for African countries
    return 'NGN';
  } catch (error) {
    console.error('Error getting country currency:', error);
    return 'NGN'; // Default fallback
  }
}

// Check subscription status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Check subscription with expiration validation
    const subscriptionResult = await query(`
      SELECT s.*, u.subscription_tier, u.subscription_expires_at 
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = $1 AND s.status = 'active'
      AND (u.subscription_expires_at IS NULL OR u.subscription_expires_at > CURRENT_TIMESTAMP)
      ORDER BY s.created_at DESC LIMIT 1
    `, [userId]);

    const isSubscribed = subscriptionResult.rows.length > 0;
    const subscription = isSubscribed ? subscriptionResult.rows[0] : null;
    
    // If subscription expired, update user status
    if (!isSubscribed) {
      await query(`
        UPDATE users 
        SET is_subscribed = false, subscription_tier = 'free', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_subscribed = true AND subscription_expires_at < CURRENT_TIMESTAMP
      `, [userId]);
    }
    
    res.json({
      success: true,
      isSubscribed,
      subscription_tier: subscription?.subscription_tier || 'free',
      subscription_expires_at: subscription?.subscription_expires_at || null,
      subscription: subscription
    });
  } catch (error) {
    console.error('Check subscription status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check subscription status'
    });
  }
});

// Create subscription
router.post('/create', authMiddleware, [
  body('planId').isString().notEmpty(),
  body('amount').isNumeric(),
  body('currency').isString().isLength({ min: 3, max: 3 }),
  body('countryCode').isString().isLength({ min: 2, max: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { planId, amount, currency, countryCode } = req.body;
    const userId = req.user.userId;

    // Get the actual plan ID from the database if planId is a string identifier
    let actualPlanId = planId;
    if (typeof planId === 'string' && !planId.includes('-')) {
      // If planId is not a UUID, look it up by name
      const planResult = await query(`
        SELECT id FROM subscription_plans WHERE plan_name = $1 AND is_active = true
      `, [planId]);
      
      if (planResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subscription plan'
        });
      }
      actualPlanId = planResult.rows[0].id;
    }

    // Try Paystack first, fallback to simulation if it fails
    let paystackResponse = null;
    let paymentMethod = 'paystack';
    
    try {
      // Use the currency sent from the frontend (local currency)
      // Paystack supports: NGN, GHS, ZAR, KES
      const supportedCurrencies = ['NGN', 'GHS', 'ZAR', 'KES'];
      const paystackCurrency = supportedCurrencies.includes(currency) ? currency : 'USD';
      
      // Create Paystack transaction with the local currency amount
      const paystackData = {
        amount: amount, // Local currency amount from frontend
        email: req.user.email || 'user@example.com',
        currency: paystackCurrency,
        reference: `SUB_${Date.now()}_${userId}`,
        callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/subscriptions/paystack-callback`,
        metadata: { 
          userId, 
          planId: actualPlanId, 
          countryCode, 
          originalAmount: amount,
          originalCurrency: currency 
        }
      };

      console.log('🔄 Attempting Paystack transaction with:', paystackData);
      paystackResponse = await req.paystackManager.initializeTransaction(paystackData);
      console.log('✅ Paystack transaction successful:', paystackResponse);
    } catch (paystackError) {
      console.log('⚠️ Paystack failed, using fallback payment method:', paystackError.message);
      console.log('📋 Paystack error details:', paystackError.response?.data || 'No response data');
      paymentMethod = 'fallback';
    }

    if (paystackResponse && paystackResponse.success) {
      console.log('📋 Paystack response structure:', JSON.stringify(paystackResponse, null, 2));

      // Paystack succeeded - create subscription record using MongoDB
      console.log(`📝 Creating MongoDB subscription record for user ${userId}, amount: ${amount} ${currency}, reference: ${paystackResponse.reference}`);

      const subscription = await Subscription.create({
        user_id: mongoose.Types.ObjectId.createFromHexString(userId),
        plan_id: actualPlanId ? mongoose.Types.ObjectId.createFromHexString(actualPlanId) : null,
        amount: amount,
        currency: currency,
        country_code: countryCode,
        paystack_reference: paystackResponse.reference,
        status: 'pending'
      });

      console.log(`✅ MongoDB subscription created with ID: ${subscription._id.toString()}`);

      res.json({
        success: true,
        message: 'Subscription created successfully via Paystack',
        subscriptionId: subscription._id.toString(),
        paymentData: {
          reference: paystackResponse.reference,
          authorizationUrl: paystackResponse.authorizationUrl,
          // Include accessCode for inline popup payment
          accessCode: paystackResponse.accessCode,
          access_code: paystackResponse.accessCode
        }
      });
    } else {
      // Use fallback payment method (simulation for testing)
      const fallbackReference = `FALLBACK_${Date.now()}_${userId}`;

      // Create subscription record with fallback status using MongoDB
      console.log(`📝 Creating MongoDB fallback subscription record for user ${userId}, amount: ${amount} ${currency}, reference: ${fallbackReference}`);

      const fallbackSubscription = await Subscription.create({
        user_id: mongoose.Types.ObjectId.createFromHexString(userId),
        plan_id: actualPlanId ? mongoose.Types.ObjectId.createFromHexString(actualPlanId) : null,
        amount: amount,
        currency: currency,
        country_code: countryCode,
        paystack_reference: fallbackReference,
        status: 'pending'
      });

      console.log(`✅ MongoDB fallback subscription created with ID: ${fallbackSubscription._id.toString()}`);

      res.json({
        success: true,
        message: 'Subscription created successfully (Test Mode)',
        subscriptionId: fallbackSubscription._id.toString(),
        paymentData: {
          reference: fallbackReference,
          authorizationUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/subscription/test-payment`,
          isTestMode: true
        }
      });
    }
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription'
    });
  }
});

// Verify payment
router.post('/verify-payment', authMiddleware, [
  body('paymentReference').isString().notEmpty()
], async (req, res) => {
  try {
    const { paymentReference } = req.body;
    const userId = req.user.userId;

    console.log(`🔄 Verifying payment: ${paymentReference} for user: ${userId}`);

    // Verify Paystack payment
    const verificationResult = await req.paystackManager.verifyTransaction(paymentReference);
    
    console.log('📋 Verification result:', JSON.stringify(verificationResult, null, 2));
    
    if (!verificationResult.success || verificationResult.data.status !== 'success') {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
    }

    // Update subscription status
    const subscriptionUpdate = await query(`
      UPDATE subscriptions 
      SET status = 'active', activated_at = CURRENT_TIMESTAMP
      WHERE paystack_reference = $1 AND user_id = $2
      RETURNING id
    `, [paymentReference, userId]);

    if (subscriptionUpdate.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Update user subscription status with tier and expiration (6-month subscription)
    try {
      await query(`
        UPDATE users 
        SET is_subscribed = true, 
            subscription_tier = 'premium',
            subscription_expires_at = CURRENT_TIMESTAMP + INTERVAL '6 months',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId]);
      console.log(`✅ User subscription status updated for: ${userId} (tier: premium, expires: 6 months)`);
    } catch (userUpdateError) {
      console.log(`⚠️  User update failed: ${userUpdateError.message}`);
      console.log(`   Subscription activated but user status not updated`);
    }
    
    console.log(`✅ Payment verified and subscription activated for user: ${userId}`);

    // Emit real-time subscription update to user
    if (req.io) {
      req.io.to(`user_${userId}`).emit('subscription_updated', {
        isSubscribed: true,
        status: 'active',
        timestamp: new Date().toISOString()
      });
      console.log(`📡 Real-time subscription update sent to user: ${userId}`);
    }

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      isSubscribed: true
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

// Manual payment verification (for development/testing)
router.post('/verify-payment-manual', async (req, res) => {
  try {
    const { paymentReference, userId } = req.body;
    
    if (!paymentReference || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Payment reference and user ID are required'
      });
    }

    console.log(`🔄 Manual payment verification: ${paymentReference} for user: ${userId}`);

    // Update subscription status directly
    const subscriptionUpdate = await query(`
      UPDATE subscriptions 
      SET status = 'active', activated_at = CURRENT_TIMESTAMP
      WHERE paystack_reference = $1 AND user_id = $2
      RETURNING id
    `, [paymentReference, userId]);

    if (subscriptionUpdate.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Update user subscription status with tier and expiration (6-month subscription)
    try {
      await query(`
        UPDATE users 
        SET is_subscribed = true, 
            subscription_tier = 'premium',
            subscription_expires_at = CURRENT_TIMESTAMP + INTERVAL '6 months',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId]);
      console.log(`✅ User subscription status updated for: ${userId} (tier: premium, expires: 6 months)`);
    } catch (userUpdateError) {
      console.log(`⚠️  User update failed: ${userUpdateError.message}`);
      console.log(`   Subscription activated but user status not updated`);
    }
    
    console.log(`✅ Manual verification: Subscription activated for user: ${userId}`);

    // Emit real-time subscription update to user
    if (req.io) {
      req.io.to(`user_${userId}`).emit('subscription_updated', {
        isSubscribed: true,
        status: 'active',
        timestamp: new Date().toISOString()
      });
      console.log(`📡 Real-time subscription update sent to user: ${userId}`);
    }

    res.json({
      success: true,
      message: 'Subscription activated successfully via manual verification',
      isSubscribed: true
    });
  } catch (error) {
    console.error('Manual payment verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment manually'
    });
  }
});

// Activate all pending subscriptions for a user (for fixing existing issues)
router.post('/activate-all-pending', authMiddleware, async (req, res) => {
  try {
    const { query } = require('../config/database');
    const userId = req.user.id;
    
    console.log(`🔄 Activating all pending subscriptions for user: ${userId}`);

    // Get all pending subscriptions for the user
    const pendingSubs = await query(`
      SELECT id, paystack_reference, amount, currency FROM subscriptions 
      WHERE user_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
    `, [userId]);

    if (pendingSubs.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No pending subscriptions found',
        activatedCount: 0
      });
    }

    console.log(`📋 Found ${pendingSubs.rows.length} pending subscriptions`);

    // Activate all pending subscriptions
    for (const sub of pendingSubs.rows) {
      await query(`
        UPDATE subscriptions 
        SET status = 'active', activated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [sub.id]);
      console.log(`✅ Activated subscription ${sub.id} (${sub.paystack_reference})`);
    }

    // Update user subscription status with tier and expiration (6-month subscription)
    try {
      await query(`
        UPDATE users 
        SET is_subscribed = true, 
            subscription_tier = 'premium',
            subscription_expires_at = CURRENT_TIMESTAMP + INTERVAL '6 months',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId]);
      console.log(`✅ User subscription status updated for: ${userId} (tier: premium, expires: 6 months)`);
    } catch (userUpdateError) {
      console.log(`⚠️  User update failed: ${userUpdateError.message}`);
    }

    console.log(`✅ Successfully activated ${pendingSubs.rows.length} subscriptions for user: ${userId}`);

    res.json({
      success: true,
      message: `Successfully activated ${pendingSubs.rows.length} pending subscriptions`,
      activatedCount: pendingSubs.rows.length,
      isSubscribed: true
    });
  } catch (error) {
    console.error('Activate all pending error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate pending subscriptions'
    });
  }
});

// Verify payment by reference (for frontend polling)
router.post('/verify-payment-by-reference', async (req, res) => {
  try {
    const { paymentReference } = req.body;
    
    if (!paymentReference) {
      return res.status(400).json({
        success: false,
        error: 'Payment reference is required'
      });
    }

    console.log(`🔄 Verifying payment by reference: ${paymentReference}`);

    // Check if payment exists and is active
    const paymentResult = await query(`
      SELECT s.id, s.status, s.user_id, u.is_subscribed
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE s.paystack_reference = $1
    `, [paymentReference]);

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    const payment = paymentResult.rows[0];
    
    if (payment.status === 'active' && payment.is_subscribed) {
      res.json({
        success: true,
        message: 'Payment already verified and active',
        isSubscribed: true
      });
    } else if (payment.status === 'pending') {
      // Try to verify with Paystack
      try {
        const verificationResult = await req.paystackManager.verifyTransaction(paymentReference);
        
        if (verificationResult.success && verificationResult.data?.status === 'success') {
          // Update subscription status
          await query(`
            UPDATE subscriptions 
            SET status = 'active', activated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [payment.id]);

          // Update user subscription status with tier and expiration (6-month subscription)
          await query(`
            UPDATE users 
            SET is_subscribed = true, 
                subscription_tier = 'premium',
                subscription_expires_at = CURRENT_TIMESTAMP + INTERVAL '6 months',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [payment.user_id]);

          console.log(`✅ Payment verified and activated for user: ${payment.user_id} (tier: premium, expires: 6 months)`);
          
          res.json({
            success: true,
            message: 'Payment verified successfully',
            isSubscribed: true
          });
        } else {
          res.json({
            success: false,
            error: 'Payment not yet completed on Paystack',
            isSubscribed: false
          });
        }
      } catch (verifyError) {
        console.error('Paystack verification error:', verifyError.message);
        res.json({
          success: false,
          error: 'Payment verification failed',
          isSubscribed: false
        });
      }
    } else {
      res.json({
        success: false,
        error: 'Payment status is not pending',
        isSubscribed: payment.is_subscribed
      });
    }
    
  } catch (error) {
    console.error('Verify payment by reference error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

// Get subscription plans
router.get('/plans', async (req, res) => {
  try {
    const { query } = require('../config/database');
    
    const plansResult = await query(`
      SELECT id, plan_name, description, price, currency, features, is_active
      FROM subscription_plans
      WHERE is_active = true
      ORDER BY price ASC
    `);

    res.json({
      success: true,
      plans: plansResult.rows
    });
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription plans'
    });
  }
});

// Handle Paystack callback
router.get('/paystack-callback', async (req, res) => {
  try {
    const { query } = require('../config/database');
    const { reference, trxref } = req.query;
    const paymentReference = reference || trxref;
    
    if (!paymentReference) {
      console.log('❌ No payment reference provided in callback');
      return res.status(400).json({
        success: false,
        error: 'Payment reference not provided'
      });
    }

    console.log(`🔄 Processing Paystack callback for: ${paymentReference}`);

    // Verify the payment with Paystack
    let verificationResult;
    try {
      console.log(`🔍 Attempting Paystack verification for: ${paymentReference}`);
      verificationResult = await req.paystackManager.verifyTransaction(paymentReference);
      console.log('📋 Verification result:', JSON.stringify(verificationResult, null, 2));
      
      // Validate verification result structure
      if (!verificationResult || typeof verificationResult !== 'object') {
        throw new Error('Invalid verification result structure');
      }
      
      if (!verificationResult.success) {
        throw new Error(`Verification failed: ${verificationResult.error || 'Unknown error'}`);
      }
      
      if (!verificationResult.data || verificationResult.data.status !== 'success') {
        throw new Error(`Payment not successful: ${verificationResult.data?.status || 'Unknown status'}`);
      }
      
      console.log('✅ Paystack verification successful');
      
    } catch (verifyError) {
      console.error('❌ Paystack verification failed:', verifyError.message);
      console.log('🔄 Falling back to database verification...');
      
      // Try to get the payment data from the database instead
      const dbPayment = await query(`
        SELECT * FROM subscriptions 
        WHERE paystack_reference = $1
      `, [paymentReference]);
      
      if (dbPayment.rows.length > 0) {
        console.log('✅ Found payment in database, proceeding with activation');
        verificationResult = { success: true, data: { status: 'success' } };
      } else {
        console.log('❌ Payment not found in database either');
        throw new Error('Payment not found in database');
      }
    }
    
    if (verificationResult.success && verificationResult.data?.status === 'success') {
      // Find the subscription for this payment
      console.log(`🔍 Searching for subscription with reference: "${paymentReference}"`);
      const subscriptionResult = await query(`
        SELECT user_id, id, status FROM subscriptions 
        WHERE paystack_reference = $1
      `, [paymentReference]);
      
      console.log(`📋 Query result: ${subscriptionResult.rows.length} rows found`);
      if (subscriptionResult.rows.length > 0) {
        console.log(`📋 Found subscription:`, subscriptionResult.rows[0]);
      }

      if (subscriptionResult.rows.length > 0) {
        const { user_id, id } = subscriptionResult.rows[0];
        
        console.log(`✅ Found subscription for user: ${user_id}`);
        
        // Update subscription status
        await query(`
          UPDATE subscriptions 
          SET status = 'active', activated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [id]);
        console.log(`✅ Subscription ${id} activated`);

        // Update user subscription status
        try {
          await query(`
            UPDATE users 
            SET is_subscribed = true, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [user_id]);
          console.log(`✅ User subscription status updated for: ${user_id}`);
        } catch (userUpdateError) {
          console.log(`⚠️  User update failed: ${userUpdateError.message}`);
          console.log(`   Subscription activated but user status not updated`);
        }

        console.log(`✅ Payment verified via callback for user: ${user_id}`);
        
        // Check if this is a webhook call or user redirect
        const userAgent = req.headers['user-agent'] || '';
        const isWebhook = userAgent.includes('Paystack') || req.headers['x-paystack-signature'];
        
        if (isWebhook) {
          // This is a webhook call, return JSON
          res.json({
            success: true,
            message: 'Payment verified successfully',
            redirectUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/subscription/success?verified=true`
          });
        } else {
          // This is a user redirect, redirect to frontend
          res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/subscription/success?verified=true`);
        }
        return;
      } else {
        console.log(`❌ No subscription found for payment reference: ${paymentReference}`);
        
        // Try a case-insensitive search as fallback
        console.log(`🔄 Trying case-insensitive search...`);
        const fallbackResult = await query(`
          SELECT user_id, id, status, paystack_reference FROM subscriptions 
          WHERE LOWER(paystack_reference) = LOWER($1)
        `, [paymentReference]);
        
        if (fallbackResult.rows.length > 0) {
          console.log(`✅ Found subscription with case-insensitive search:`, fallbackResult.rows[0]);
          console.log(`⚠️  Original reference: "${paymentReference}"`);
          console.log(`⚠️  Stored reference: "${fallbackResult.rows[0].paystack_reference}"`);
          
          // Use the found subscription
          const { user_id, id } = fallbackResult.rows[0];
          
          // Update subscription status
          await query(`
            UPDATE subscriptions 
            SET status = 'active', activated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [id]);
          console.log(`✅ Subscription ${id} activated via fallback`);

          // Update user subscription status
          try {
            await query(`
              UPDATE users 
              SET is_subscribed = true, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [user_id]);
            console.log(`✅ User subscription status updated for: ${user_id}`);
          } catch (userUpdateError) {
            console.log(`⚠️  User update failed: ${userUpdateError.message}`);
          }

          console.log(`✅ Payment verified via fallback for user: ${user_id}`);
          
          // Check if this is a webhook call or user redirect
          const userAgent = req.headers['user-agent'] || '';
          const isWebhook = userAgent.includes('Paystack') || req.headers['x-paystack-signature'];
          
          if (isWebhook) {
            res.json({
              success: true,
              message: 'Payment verified successfully via fallback',
              redirectUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/subscription/success?verified=true`
            });
          } else {
            res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/subscription/success?verified=true`);
          }
          return;
        }
        
        res.status(404).json({
          success: false,
          error: 'Subscription not found'
        });
        return;
      }
    } else {
      console.log(`❌ Payment verification failed for: ${paymentReference}`);
      res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
      return;
    }
    
  } catch (error) {
    console.error('❌ Paystack callback error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during payment verification',
      details: error.message
    });
  }
});

module.exports = router;
