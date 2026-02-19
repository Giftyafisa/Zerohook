/**
 * Sugar Access Payment Routes
 * 
 * Handles payments for providers to access Sugar Daddy/Mommy profiles
 * This is separate from the regular subscription system.
 * 
 * Providers must pay to:
 * - View Sugar Daddy profiles
 * - View Sugar Mommy profiles
 * - Access both (discounted bundle)
 * 
 * Access is granted for 1 year from payment date
 * 
 * All payments use cryptocurrency via CryptoPaymentManager (fee-free).
 */

const express = require('express');
const mongoose = require('mongoose');
const { User, SugarAccessPayment } = require('../config/database');
const { authMiddleware } = require('./auth');
const router = express.Router();

// Sugar access pricing (in NGN)
const SUGAR_ACCESS_PRICING = {
  sugar_daddy: {
    price: 50000, // ₦50,000 for Sugar Daddy access
    currency: 'NGN',
    duration_days: 365 // 1 year access
  },
  sugar_mommy: {
    price: 50000, // ₦50,000 for Sugar Mommy access
    currency: 'NGN',
    duration_days: 365 // 1 year access
  },
  both: {
    price: 80000, // ₦80,000 for both (20% discount)
    currency: 'NGN',
    duration_days: 365 // 1 year access
  }
};

/**
 * @route   GET /api/sugar-access/pricing
 * @desc    Get sugar access pricing information
 * @access  Public
 */
router.get('/pricing', (req, res) => {
  res.json({
    success: true,
    pricing: SUGAR_ACCESS_PRICING,
    note: 'Access is valid for 1 year from payment date'
  });
});

/**
 * @route   GET /api/sugar-access/status
 * @desc    Check provider's current sugar access status
 * @access  Private (Providers only)
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Get user's account type
    const user = await User.findById(userId).select('profile_data').lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accountType = user.profile_data?.accountType;
    
    // Only providers need to purchase sugar access
    if (accountType !== 'provider') {
      return res.json({
        success: true,
        accountType,
        requiresPayment: false,
        message: 'Your account type does not require sugar access payment'
      });
    }

    // Check for active sugar access payments
    const accessRecords = await SugarAccessPayment.find({
      providerId: userId,
      paymentStatus: 'completed',
      accessExpiresAt: { $gt: new Date() }
    }).sort({ accessExpiresAt: -1 }).lean();

    const activeAccess = {
      sugar_daddy: null,
      sugar_mommy: null
    };

    accessRecords.forEach(row => {
      if (row.accessType === 'sugar_daddy' || row.accessType === 'both') {
        if (!activeAccess.sugar_daddy || new Date(row.accessExpiresAt) > new Date(activeAccess.sugar_daddy.expiresAt)) {
          activeAccess.sugar_daddy = {
            paymentId: row._id.toString(),
            expiresAt: row.accessExpiresAt,
            startedAt: row.accessStartsAt
          };
        }
      }
      if (row.accessType === 'sugar_mommy' || row.accessType === 'both') {
        if (!activeAccess.sugar_mommy || new Date(row.accessExpiresAt) > new Date(activeAccess.sugar_mommy.expiresAt)) {
          activeAccess.sugar_mommy = {
            paymentId: row._id.toString(),
            expiresAt: row.accessExpiresAt,
            startedAt: row.accessStartsAt
          };
        }
      }
    });

    res.json({
      success: true,
      accountType,
      requiresPayment: true,
      hasSugarDaddyAccess: !!activeAccess.sugar_daddy,
      hasSugarMommyAccess: !!activeAccess.sugar_mommy,
      accessDetails: activeAccess,
      pricing: SUGAR_ACCESS_PRICING
    });

  } catch (error) {
    console.error('Check sugar access status error:', error);
    res.status(500).json({
      error: 'Failed to check sugar access status',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/sugar-access/initialize
 * @desc    Initialize a sugar access payment via crypto
 * @access  Private (Providers only)
 */
router.post('/initialize', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accessType, cryptoSymbol = 'USDT' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Validate cryptoSymbol
    const validCryptos = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'LTC'];
    if (!validCryptos.includes(cryptoSymbol)) {
      return res.status(400).json({ error: 'Invalid crypto symbol', validCryptos });
    }

    // Validate access type
    if (!['sugar_daddy', 'sugar_mommy', 'both'].includes(accessType)) {
      return res.status(400).json({
        error: 'Invalid access type',
        validTypes: ['sugar_daddy', 'sugar_mommy', 'both']
      });
    }

    // Get user's account type
    const user = await User.findById(userId).select('profile_data email username').lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accountType = user.profile_data?.accountType;
    
    // Only providers can purchase sugar access
    if (accountType !== 'provider') {
      return res.status(403).json({ error: 'Only providers can purchase sugar access' });
    }

    // Check if user already has active access for this type
    const existingAccess = await SugarAccessPayment.findOne({
      providerId: userId,
      $or: [{ accessType }, { accessType: 'both' }],
      paymentStatus: 'completed',
      accessExpiresAt: { $gt: new Date() }
    }).select('_id').lean();

    if (existingAccess && accessType !== 'both') {
      return res.status(400).json({
        error: 'You already have active access for this type',
        existingAccess: true
      });
    }

    // Get pricing
    const pricing = SUGAR_ACCESS_PRICING[accessType];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + pricing.duration_days);

    // Convert fiat to crypto using live rates
    const conversion = await req.currencyManager.fiatToCrypto(pricing.price, pricing.currency, cryptoSymbol);

    // Create pending payment record
    const payment = await SugarAccessPayment.create({
      providerId: new mongoose.Types.ObjectId(userId),
      accessType,
      amount: pricing.price,
      currency: pricing.currency,
      paymentStatus: 'pending',
      accessExpiresAt: expiresAt
    });

    const paymentId = payment._id.toString();
    const reference = `sugar_${accessType}_${paymentId}`;

    // Create crypto payment invoice
    const invoice = await req.cryptoPaymentManager.createPaymentInvoice({
      cryptoAmount: parseFloat(conversion.cryptoAmount.toFixed(8)),
      cryptoSymbol,
      fiatAmount: pricing.price,
      fiatCurrency: pricing.currency,
      userId,
      metadata: {
        type: 'sugar_access',
        accessType,
        paymentId
      }
    });

    // Store the crypto reference on the payment record
    payment.paymentReference = invoice.reference;
    await payment.save();

    console.log(`🪙 Sugar access crypto payment created: ${invoice.reference} - ${conversion.cryptoAmount} ${cryptoSymbol} for ${accessType}`);

    res.json({
      success: true,
      paymentId,
      accessType,
      amount: pricing.price,
      currency: pricing.currency,
      expiresAt,
      durationDays: pricing.duration_days,
      paymentData: {
        reference: invoice.reference,
        address: invoice.address,
        cryptoAmount: conversion.cryptoAmount,
        cryptoSymbol,
        network: invoice.network,
        qrData: invoice.qrData,
        expiresAt: invoice.expiresAt,
        rate: conversion.rate,
        rateSource: conversion.rateSource
      }
    });

  } catch (error) {
    console.error('Initialize sugar access payment error:', error);
    res.status(500).json({
      error: 'Failed to initialize payment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/sugar-access/verify
 * @desc    Verify a sugar access crypto payment on blockchain
 * @access  Private
 */
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reference, paymentId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!reference && !paymentId) {
      return res.status(400).json({ error: 'Payment reference or payment ID is required' });
    }

    // Find the payment record
    let payment;
    if (paymentId) {
      payment = await SugarAccessPayment.findOne({ _id: paymentId, providerId: userId });
    } else if (reference) {
      // Try finding by stored reference first
      payment = await SugarAccessPayment.findOne({ paymentReference: reference, providerId: userId });
      
      if (!payment) {
        // Fallback: extract payment ID from reference (format: sugar_type_uuid)
        const parts = reference.split('_');
        const extractedId = parts[parts.length - 1];
        if (mongoose.Types.ObjectId.isValid(extractedId)) {
          payment = await SugarAccessPayment.findOne({ _id: extractedId, providerId: userId });
        }
      }
    }

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.paymentStatus === 'completed') {
      return res.json({
        success: true,
        message: 'Payment already verified',
        accessType: payment.accessType,
        expiresAt: payment.accessExpiresAt
      });
    }

    // Verify on blockchain via CryptoPaymentManager
    const cryptoRef = payment.paymentReference || reference;
    let verified = false;

    if (cryptoRef) {
      try {
        const verification = await req.cryptoPaymentManager.checkPaymentStatus(cryptoRef);
        verified = verification.success && verification.status === 'confirmed';
        
        if (!verified && verification.status === 'pending_confirmation') {
          return res.json({
            success: false,
            error: 'Payment detected, waiting for blockchain confirmations',
            status: 'pending_confirmation'
          });
        }
      } catch (verifyError) {
        console.error('Blockchain verification error:', verifyError);
      }
    }

    // For testing/development, allow manual verification
    if (!verified && process.env.NODE_ENV === 'development') {
      console.log('⚠️ Development mode: Auto-verifying sugar access payment');
      verified = true;
    }

    if (verified) {
      payment.paymentStatus = 'completed';
      payment.paymentReference = cryptoRef;
      payment.accessStartsAt = new Date();
      await payment.save();

      console.log(`✅ Sugar access verified: ${payment.accessType} for user ${userId}`);

      res.json({
        success: true,
        message: 'Payment verified successfully',
        accessType: payment.accessType,
        expiresAt: payment.accessExpiresAt
      });
    } else {
      res.json({
        success: false,
        error: 'Payment not yet confirmed on blockchain',
        status: 'pending'
      });
    }

  } catch (error) {
    console.error('Verify sugar access payment error:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/sugar-access/history
 * @desc    Get provider's sugar access payment history
 * @access  Private (Providers only)
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const payments = await SugarAccessPayment.find({ providerId: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      payments: payments.map((row) => ({
        id: row._id.toString(),
        access_type: row.accessType,
        amount: row.amount,
        currency: row.currency,
        payment_status: row.paymentStatus,
        payment_reference: row.paymentReference,
        access_starts_at: row.accessStartsAt,
        access_expires_at: row.accessExpiresAt,
        created_at: row.createdAt
      }))
    });

  } catch (error) {
    console.error('Get sugar access history error:', error);
    res.status(500).json({
      error: 'Failed to get payment history',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
