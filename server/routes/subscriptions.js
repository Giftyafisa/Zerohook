const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('./auth');
const { Subscription, SubscriptionPlan, User } = require('../config/database');
const mongoose = require('mongoose');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const router = express.Router();

// Per-route rate limiter: 5 subscription creations per 15 min per IP
const subLimiter = new RateLimiterMemory({ points: 5, duration: 900 });
const subRateLimit = async (req, res, next) => {
  try { await subLimiter.consume(req.ip); next(); }
  catch { res.status(429).json({ success: false, error: 'Too many subscription requests, please try again later.' }); }
};

/**
 * Zerohook Subscriptions - Crypto Only (Fee-Free Direct Blockchain)
 * 
 * All subscription payments use cryptocurrency via CryptoPaymentManager.
 * Live rates via CurrencyManager (CoinGecko + Frankfurter).
 * No Paystack, no Stripe.
 */

const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('profile_data verification_tier is_admin');
    const isAdmin = user?.is_admin === true ||
      user?.verification_tier >= 5;

    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Admin verification failed' });
  }
};

// Check subscription status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select('is_subscribed subscription_tier subscription_expires_at');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const now = new Date();
    const isExpired = user.subscription_expires_at && user.subscription_expires_at <= now;

    if (isExpired || !user.is_subscribed) {
      if (user.is_subscribed || user.subscription_tier !== 'free') {
        user.is_subscribed = false;
        user.subscription_tier = 'free';
        await user.save();
      }

      return res.json({
        success: true,
        isSubscribed: false,
        subscription_tier: 'free',
        subscription_expires_at: null,
        subscription: null
      });
    }

    const activeSubscription = await Subscription.findOne({
      user_id: user._id,
      status: 'active'
    }).sort({ created_at: -1 }).lean();
    
    res.json({
      success: true,
      isSubscribed: true,
      subscription_tier: user.subscription_tier || 'free',
      subscription_expires_at: user.subscription_expires_at || null,
      subscription: activeSubscription || null
    });
  } catch (error) {
    console.error('Check subscription status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check subscription status'
    });
  }
});

// Create subscription (Crypto Payment)
router.post('/create', authMiddleware, subRateLimit, [
  body('planId').isString().notEmpty(),
  body('amount').isNumeric(),
  body('currency').isString().isLength({ min: 3, max: 3 }),
  body('countryCode').isString().isLength({ min: 2, max: 2 }),
  body('cryptoSymbol').optional().isIn(['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'LTC']).withMessage('Invalid crypto')
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

    const { planId, amount, currency, countryCode, cryptoSymbol = 'USDT' } = req.body;
    const userId = req.user.userId;

    // Get the actual plan ID from the database if planId is a string identifier
    let actualPlanId = planId;
    if (typeof planId === 'string' && !planId.includes('-')) {
      const plan = await SubscriptionPlan.findOne({ plan_name: planId, is_active: true }).select('_id').lean();
      if (!plan) {
        return res.status(400).json({ success: false, error: 'Invalid subscription plan' });
      }
      actualPlanId = plan._id.toString();
    }

    // Convert fiat amount to crypto using live rates
    const conversion = await req.currencyManager.fiatToCrypto(amount, currency.toUpperCase(), cryptoSymbol);

    // Create crypto payment invoice
    const invoice = await req.cryptoPaymentManager.createPaymentInvoice({
      cryptoAmount: parseFloat(conversion.cryptoAmount.toFixed(8)),
      cryptoSymbol,
      fiatAmount: amount,
      fiatCurrency: currency.toUpperCase(),
      userId,
      metadata: {
        type: 'subscription',
        planId: actualPlanId,
        countryCode
      }
    });

    // Validate ObjectId format before conversion
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID format' });
    }
    if (actualPlanId && !mongoose.Types.ObjectId.isValid(actualPlanId)) {
      return res.status(400).json({ success: false, error: 'Invalid plan ID format' });
    }

    // Create subscription record in MongoDB
    const subscription = await Subscription.create({
      user_id: mongoose.Types.ObjectId.createFromHexString(userId),
      plan_id: actualPlanId ? mongoose.Types.ObjectId.createFromHexString(actualPlanId) : null,
      amount: amount,
      currency: currency.toUpperCase(),
      country_code: countryCode,
      crypto_reference: invoice.reference, // Reusing field name for backward compat
      status: 'pending'
    });

    console.log(`🪙 Crypto subscription created: ${invoice.reference} - ${conversion.cryptoAmount} ${cryptoSymbol} (${currency} ${amount})`);

    res.json({
      success: true,
      message: 'Subscription created - pay with crypto',
      subscriptionId: subscription._id.toString(),
      paymentData: {
        reference: invoice.reference,
        address: invoice.address,
        cryptoAmount: conversion.cryptoAmount,
        cryptoSymbol,
        fiatAmount: amount,
        fiatCurrency: currency.toUpperCase(),
        network: invoice.network,
        qrData: invoice.qrData,
        expiresAt: invoice.expiresAt,
        rate: conversion.rate,
        rateSource: conversion.rateSource
      }
    });

  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription'
    });
  }
});

// Verify subscription payment (Crypto blockchain verification)
router.post('/verify-payment', authMiddleware, subRateLimit, [
  body('paymentReference').isString().notEmpty()
], async (req, res) => {
  try {
    const { paymentReference } = req.body;
    const userId = req.user.userId;

    console.log(`🔄 Verifying crypto subscription payment: ${paymentReference} for user: ${userId}`);

    // Verify on blockchain via CryptoPaymentManager
    const verificationResult = await req.cryptoPaymentManager.checkPaymentStatus(paymentReference);
    
    console.log('📋 Blockchain verification result:', JSON.stringify(verificationResult, null, 2));
    
    if (!verificationResult.success || verificationResult.status !== 'confirmed') {
      return res.json({
        success: false,
        error: verificationResult.status === 'pending_confirmation' 
          ? 'Payment detected, waiting for blockchain confirmations' 
          : 'Payment not yet detected on blockchain',
        status: verificationResult.status || 'pending'
      });
    }

    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;

    if (!userObjectId) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const subscriptionUpdate = await Subscription.findOneAndUpdate(
      { crypto_reference: paymentReference, user_id: userObjectId },
      { status: 'active', activated_at: new Date() },
      { new: true }
    );

    if (!subscriptionUpdate) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    // Update user subscription status (6-month subscription) — fail loudly if user update breaks
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    const userUpdate = await User.findByIdAndUpdate(userObjectId, {
      is_subscribed: true,
      subscription_tier: 'premium',
      subscription_expires_at: sixMonthsFromNow
    }, { new: true });

    if (!userUpdate) {
      // Rollback subscription activation since user update failed
      await Subscription.findByIdAndUpdate(subscriptionUpdate._id, { status: 'pending', activated_at: null });
      return res.status(500).json({ success: false, error: 'Failed to update user subscription status' });
    }

    console.log(`✅ User subscription updated: ${userId} (tier: premium, expires: 6 months)`);
    
    console.log(`✅ Crypto payment verified and subscription activated for user: ${userId}`);

    // Emit real-time subscription update
    if (req.io) {
      req.io.to(`user_${userId}`).emit('subscription_updated', {
        isSubscribed: true,
        status: 'active',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      isSubscribed: true
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

// Manual payment verification (for development/testing)
router.post('/verify-payment-manual', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { paymentReference, userId } = req.body;
    
    if (!paymentReference || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Payment reference and user ID are required'
      });
    }

    console.log(`🔄 Manual payment verification: ${paymentReference} for user: ${userId}`);

    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;

    if (!userObjectId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    const subscriptionUpdate = await Subscription.findOneAndUpdate(
      { crypto_reference: paymentReference, user_id: userObjectId },
      { status: 'active', activated_at: new Date() },
      { new: true }
    );

    if (!subscriptionUpdate) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Update user subscription status with tier and expiration (6-month subscription)
    try {
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

      await User.findByIdAndUpdate(userObjectId, {
        is_subscribed: true,
        subscription_tier: 'premium',
        subscription_expires_at: sixMonthsFromNow
      });

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

// Activate all pending subscriptions for a user (ADMIN ONLY - for fixing existing issues)
router.post('/activate-all-pending', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // SECURITY: Only allow admin users to activate pending subscriptions
    const callingUser = await User.findById(userId).select('role').lean();
    if (!callingUser || callingUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    // Admin specifies which user to activate for (not self-service)
    const targetUserId = req.body.targetUserId || userId;
    const userObjectId = mongoose.Types.ObjectId.isValid(targetUserId)
      ? new mongoose.Types.ObjectId(targetUserId)
      : null;

    if (!userObjectId) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    
    console.log(`🔄 [ADMIN] Activating all pending subscriptions for user: ${targetUserId} (by admin: ${userId})`);

    const pendingSubs = await Subscription.find({ user_id: userObjectId, status: 'pending' })
      .select('_id crypto_reference amount currency')
      .sort({ created_at: -1 })
      .lean();

    if (pendingSubs.length === 0) {
      return res.json({
        success: true,
        message: 'No pending subscriptions found',
        activatedCount: 0
      });
    }

    console.log(`📋 Found ${pendingSubs.length} pending subscriptions`);

    await Subscription.updateMany(
      { user_id: userObjectId, status: 'pending' },
      { status: 'active', activated_at: new Date() }
    );

    for (const sub of pendingSubs) {
      console.log(`✅ Activated subscription ${sub._id.toString()} (${sub.crypto_reference})`);
    }

    // Update user subscription status with tier and expiration (6-month subscription)
    try {
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

      await User.findByIdAndUpdate(userObjectId, {
        is_subscribed: true,
        subscription_tier: 'premium',
        subscription_expires_at: sixMonthsFromNow
      });
      console.log(`✅ User subscription status updated for: ${userId} (tier: premium, expires: 6 months)`);
    } catch (userUpdateError) {
      console.log(`⚠️  User update failed: ${userUpdateError.message}`);
    }

    console.log(`✅ Successfully activated ${pendingSubs.length} subscriptions for user: ${userId}`);

    res.json({
      success: true,
      message: `Successfully activated ${pendingSubs.length} pending subscriptions`,
      activatedCount: pendingSubs.length,
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

// Verify payment by reference (for frontend polling) - crypto blockchain check
router.post('/verify-payment-by-reference', authMiddleware, async (req, res) => {
  try {
    const { paymentReference } = req.body;
    const userId = req.user.userId;
    
    if (!paymentReference) {
      return res.status(400).json({ success: false, error: 'Payment reference is required' });
    }

    console.log(`🔄 Verifying crypto payment by reference: ${paymentReference}`);

    const payment = await Subscription.findOne({ 
      crypto_reference: paymentReference,
      user_id: mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null
    }).select('_id status user_id').lean();

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    const user = await User.findById(payment.user_id).select('is_subscribed').lean();
    const isSubscribed = Boolean(user?.is_subscribed);
    
    if (payment.status === 'active' && isSubscribed) {
      return res.json({
        success: true,
        message: 'Payment already verified and active',
        isSubscribed: true
      });
    }

    if (payment.status === 'pending') {
      // Verify on blockchain
      try {
        const verificationResult = await req.cryptoPaymentManager.checkPaymentStatus(paymentReference);
        
        if (verificationResult.success && verificationResult.status === 'confirmed') {
          await Subscription.findByIdAndUpdate(payment._id, {
            status: 'active',
            activated_at: new Date()
          });

          const sixMonthsFromNow = new Date();
          sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

          await User.findByIdAndUpdate(payment.user_id, {
            is_subscribed: true,
            subscription_tier: 'premium',
            subscription_expires_at: sixMonthsFromNow
          });

          console.log(`✅ Crypto payment verified for user: ${payment.user_id.toString()}`);
          
          return res.json({
            success: true,
            message: 'Payment verified successfully',
            isSubscribed: true
          });
        }

        return res.json({
          success: false,
          error: verificationResult.status === 'pending_confirmation'
            ? 'Payment detected, waiting for confirmations'
            : 'Payment not yet detected on blockchain',
          status: verificationResult.status || 'pending',
          isSubscribed: false
        });
      } catch (verifyError) {
        console.error('Blockchain verification error:', verifyError.message);
        return res.json({
          success: false,
          error: 'Payment verification failed',
          isSubscribed: false
        });
      }
    }

    res.json({
      success: false,
      error: 'Payment status is not pending',
      isSubscribed: false
    });
    
  } catch (error) {
    console.error('Verify payment by reference error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

// Get subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plansResult = await SubscriptionPlan
      .find({ is_active: true })
      .select('_id plan_name description price currency features is_active')
      .sort({ price: 1 })
      .lean();

    const plans = plansResult.map((plan) => ({
      id: plan._id.toString(),
      plan_name: plan.plan_name,
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      features: plan.features,
      is_active: plan.is_active
    }));

    res.json({
      success: true,
      plans
    });
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription plans'
    });
  }
});

// Crypto payment verification callback (replaces old Paystack callback)
router.get('/payment-callback', async (req, res) => {
  try {
    const { reference } = req.query;
    
    if (!reference) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/subscription/failed?error=no_reference`);
    }

    console.log(`🔄 Processing crypto payment callback for: ${reference}`);

    // Check blockchain verification
    const verificationResult = await req.cryptoPaymentManager.checkPaymentStatus(reference);
    
    if (verificationResult.success && verificationResult.status === 'confirmed') {
      const subscriptionDoc = await Subscription.findOne({ crypto_reference: reference });

      if (subscriptionDoc) {
        const userId = subscriptionDoc.user_id?.toString();

        subscriptionDoc.status = 'active';
        subscriptionDoc.activated_at = new Date();
        await subscriptionDoc.save();
        console.log(`✅ Subscription ${subscriptionDoc._id.toString()} activated via callback`);

        if (userId) {
          try {
            const sixMonthsFromNow = new Date();
            sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

            await User.findByIdAndUpdate(userId, { 
              is_subscribed: true, 
              subscription_tier: 'premium',
              subscription_expires_at: sixMonthsFromNow
            });
          } catch (userUpdateError) {
            console.log(`⚠️ User update failed: ${userUpdateError.message}`);
          }
        }

        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/subscription/success?verified=true`);
      }

      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/subscription/failed?error=not_found`);
    }

    // Payment not yet confirmed - redirect to pending page
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/subscription/pending?reference=${reference}`);
    
  } catch (error) {
    console.error('Payment callback error:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/subscription/failed?error=server_error`);
  }
});

module.exports = router;
