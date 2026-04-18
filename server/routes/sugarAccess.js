/**
 * Sugar Access Payment Routes
 * 
 * Handles standalone payments for eligible viewers to access Sugar Daddy/Mommy profiles.
 * This is separate from the regular subscription system.
 * 
 * Eligible viewers (clients/providers) must pay to:
 * - View Sugar Daddy profiles
 * - View Sugar Mommy profiles
 * - Access both
 * 
 * Access can be monthly or yearly based on selected billing cycle.
 * 
 * All payments use cryptocurrency via CryptoPaymentManager (fee-free).
 */

const express = require('express');
const mongoose = require('mongoose');
const { User, SugarAccessPayment } = require('../config/database');
const { getAccountType } = require('../utils/accountTypeUtils');
const { authMiddleware } = require('./auth');
const router = express.Router();
const SUPPORTED_SETTLEMENT_CRYPTOS = ['BTC', 'ETH', 'USDT', 'USDC'];
const ELIGIBLE_SUGAR_ACCESS_VIEWERS = new Set(['client', 'provider']);
const BILLING_CYCLES = ['monthly', 'yearly'];
const MONTHLY_PRICE_GHS = 300;
const YEARLY_MULTIPLIER = 10;

const buildCyclePricing = (monthlyPrice, currency = 'GHS') => ({
  monthly: {
    price: monthlyPrice,
    currency,
    duration_days: 30
  },
  yearly: {
    price: monthlyPrice * YEARLY_MULTIPLIER,
    currency,
    duration_days: 365
  }
});

// Sugar access pricing (standalone; same for eligible client/provider accounts)
const SUGAR_ACCESS_PRICING = {
  sugar_daddy: buildCyclePricing(MONTHLY_PRICE_GHS),
  sugar_mommy: buildCyclePricing(MONTHLY_PRICE_GHS),
  both: buildCyclePricing(MONTHLY_PRICE_GHS)
};

function resolveSugarAccessPricing(accessType, billingCycle = 'monthly') {
  const normalizedCycle = String(billingCycle || '').toLowerCase();
  const accessTypePricing = SUGAR_ACCESS_PRICING[accessType];
  const cyclePricing = accessTypePricing?.[normalizedCycle];

  if (!cyclePricing) {
    return null;
  }

  return {
    accessType,
    billingCycle: normalizedCycle,
    amount: Number(cyclePricing.price || 0),
    currency: cyclePricing.currency,
    durationDays: Number(cyclePricing.duration_days || 30)
  };
}

function buildActiveAccessRecords(accessRecords = []) {
  const activeAccess = {
    sugar_daddy: null,
    sugar_mommy: null
  };

  accessRecords.forEach((row) => {
    const baseDetails = {
      paymentId: row._id.toString(),
      expiresAt: row.accessExpiresAt,
      startedAt: row.accessStartsAt,
      billingCycle: row.billingCycle || 'monthly'
    };

    if (row.accessType === 'sugar_daddy' || row.accessType === 'both') {
      if (!activeAccess.sugar_daddy || new Date(row.accessExpiresAt) > new Date(activeAccess.sugar_daddy.expiresAt)) {
        activeAccess.sugar_daddy = baseDetails;
      }
    }

    if (row.accessType === 'sugar_mommy' || row.accessType === 'both') {
      if (!activeAccess.sugar_mommy || new Date(row.accessExpiresAt) > new Date(activeAccess.sugar_mommy.expiresAt)) {
        activeAccess.sugar_mommy = baseDetails;
      }
    }
  });

  return activeAccess;
}

/**
 * @route   GET /api/sugar-access/pricing
 * @desc    Get sugar access pricing information
 * @access  Public
 */
router.get('/pricing', (req, res) => {
  res.json({
    success: true,
    pricing: SUGAR_ACCESS_PRICING,
    eligibleAccountTypes: Array.from(ELIGIBLE_SUGAR_ACCESS_VIEWERS),
    billingCycles: BILLING_CYCLES,
    note: 'Sugar access is standalone and auto-activates after confirmed payment.'
  });
});

/**
 * @route   GET /api/sugar-access/status
 * @desc    Check current user's sugar access status
 * @access  Private (Eligible client/provider accounts)
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    // Get user's account type
    const user = await User.findById(userId)
      .select('profile_data profileData accountType account_type')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const accountType = getAccountType(user) || 'client';
    const eligibleForSugarAccess = ELIGIBLE_SUGAR_ACCESS_VIEWERS.has(accountType);
    
    if (!eligibleForSugarAccess) {
      return res.json({
        success: true,
        accountType,
        eligibleForSugarAccess,
        requiresPayment: false,
        hasSugarDaddyAccess: false,
        hasSugarMommyAccess: false,
        pricing: SUGAR_ACCESS_PRICING,
        message: 'Only client and provider accounts can purchase sugar access.'
      });
    }

    // Check for active sugar access payments
    const accessRecords = await SugarAccessPayment.find({
      providerId: userId,
      paymentStatus: 'completed',
      accessExpiresAt: { $gt: new Date() }
    }).sort({ accessExpiresAt: -1 }).lean();

    const activeAccess = buildActiveAccessRecords(accessRecords);

    res.json({
      success: true,
      accountType,
      eligibleForSugarAccess,
      requiresPayment: true,
      hasSugarDaddyAccess: !!activeAccess.sugar_daddy,
      hasSugarMommyAccess: !!activeAccess.sugar_mommy,
      accessDetails: activeAccess,
      pricing: SUGAR_ACCESS_PRICING,
      billingCycles: BILLING_CYCLES,
      autoApproval: true
    });

  } catch (error) {
    console.error('Check sugar access status error:', error);
    res.status(500).json({ success: false, error: 'Failed to check sugar access status',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/sugar-access/initialize
 * @desc    Initialize a sugar access payment via crypto
 * @access  Private (Eligible client/provider accounts)
 */
router.post('/initialize', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accessType, billingCycle = 'monthly', cryptoSymbol = 'USDT' } = req.body;
    const normalizedSymbol = String(cryptoSymbol || '').toUpperCase();
    const normalizedBillingCycle = String(billingCycle || '').toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    // Validate cryptoSymbol
    if (!SUPPORTED_SETTLEMENT_CRYPTOS.includes(normalizedSymbol)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid crypto symbol',
        validCryptos: SUPPORTED_SETTLEMENT_CRYPTOS
      });
    }

    // Validate access type
    if (!['sugar_daddy', 'sugar_mommy', 'both'].includes(accessType)) {
      return res.status(400).json({ success: false, error: 'Invalid access type',
        validTypes: ['sugar_daddy', 'sugar_mommy', 'both']
      });
    }

    if (!BILLING_CYCLES.includes(normalizedBillingCycle)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid billing cycle',
        validBillingCycles: BILLING_CYCLES
      });
    }

    // Get user's account type
    const user = await User.findById(userId)
      .select('profile_data profileData accountType account_type email username')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const accountType = getAccountType(user) || 'client';
    const eligibleForSugarAccess = ELIGIBLE_SUGAR_ACCESS_VIEWERS.has(accountType);
    
    if (!eligibleForSugarAccess) {
      return res.status(403).json({
        success: false,
        error: 'Only client and provider accounts can purchase sugar access'
      });
    }

    // Check if user already has active access for this type/capability
    const accessTypeCondition = accessType === 'both'
      ? { accessType: 'both' }
      : { $or: [{ accessType }, { accessType: 'both' }] };

    const existingAccess = await SugarAccessPayment.findOne({
      providerId: userId,
      ...accessTypeCondition,
      paymentStatus: 'completed',
      accessExpiresAt: { $gt: new Date() }
    }).select('_id').lean();

    if (existingAccess) {
      return res.status(400).json({ success: false, error: 'You already have active access for this type',
        existingAccess: true
      });
    }

    const pricing = resolveSugarAccessPricing(accessType, normalizedBillingCycle);
    if (!pricing) {
      return res.status(400).json({ success: false, error: 'Invalid pricing configuration request' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + pricing.durationDays);

    // Convert fiat to crypto using live rates
    const conversion = await req.currencyManager.fiatToCrypto(pricing.amount, pricing.currency, normalizedSymbol);

    // Create pending payment record
    const payment = await SugarAccessPayment.create({
      providerId: new mongoose.Types.ObjectId(userId),
      viewerAccountType: accountType,
      accessType,
      billingCycle: pricing.billingCycle,
      amount: pricing.amount,
      currency: pricing.currency,
      paymentStatus: 'pending',
      accessExpiresAt: expiresAt
    });

    const paymentId = payment._id.toString();
    const reference = `sugar_${accessType}_${paymentId}`;

    // Create crypto payment invoice
    const invoice = await req.cryptoPaymentManager.createPaymentInvoice({
      cryptoAmount: parseFloat(conversion.cryptoAmount.toFixed(8)),
      cryptoSymbol: normalizedSymbol,
      fiatAmount: pricing.amount,
      fiatCurrency: pricing.currency,
      userId,
      metadata: {
        type: 'sugar_access',
        accessType,
        billingCycle: pricing.billingCycle,
        viewerAccountType: accountType,
        paymentId,
        autoApproval: true
      }
    });

    // Store the crypto reference on the payment record
    payment.paymentReference = invoice.reference;
    await payment.save();

    console.log(`🪙 Sugar access crypto payment created: ${invoice.reference} - ${conversion.cryptoAmount} ${normalizedSymbol} for ${accessType}`);

    res.json({
      success: true,
      paymentId,
      accessType,
      billingCycle: pricing.billingCycle,
      amount: pricing.amount,
      currency: pricing.currency,
      expiresAt,
      durationDays: pricing.durationDays,
      autoApproval: true,
      paymentData: {
        reference: invoice.reference,
        address: invoice.address,
        cryptoAmount: conversion.cryptoAmount,
        cryptoSymbol: normalizedSymbol,
        network: invoice.network,
        qrData: invoice.qrData,
        expiresAt: invoice.expiresAt,
        rate: conversion.rate,
        rateSource: conversion.rateSource
      }
    });

  } catch (error) {
    console.error('Initialize sugar access payment error:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize payment',
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
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    if (!reference && !paymentId) {
      return res.status(400).json({ success: false, error: 'Payment reference or payment ID is required' });
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
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    if (payment.paymentStatus === 'completed') {
      return res.json({
        success: true,
        message: 'Payment already verified and access is active',
        accessType: payment.accessType,
        billingCycle: payment.billingCycle || 'monthly',
        expiresAt: payment.accessExpiresAt,
        autoApproval: true
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

    if (verified) {
      payment.paymentStatus = 'completed';
      payment.paymentReference = cryptoRef;
      payment.accessStartsAt = new Date();
      await payment.save();

      console.log(`✅ Sugar access verified: ${payment.accessType} for user ${userId}`);

      res.json({
        success: true,
        message: 'Payment verified successfully. Sugar access activated automatically.',
        accessType: payment.accessType,
        billingCycle: payment.billingCycle || 'monthly',
        expiresAt: payment.accessExpiresAt,
        autoApproval: true
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
    res.status(500).json({ success: false, error: 'Failed to verify payment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/sugar-access/history
 * @desc    Get sugar access payment history for eligible client/provider accounts
 * @access  Private
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const user = await User.findById(userId)
      .select('profile_data profileData accountType account_type')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const accountType = getAccountType(user) || 'client';
    if (!ELIGIBLE_SUGAR_ACCESS_VIEWERS.has(accountType)) {
      return res.status(403).json({
        success: false,
        error: 'This account type is not eligible for sugar access history'
      });
    }

    const payments = await SugarAccessPayment.find({ providerId: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      payments: payments.map((row) => ({
        id: row._id.toString(),
        viewer_account_type: row.viewerAccountType,
        access_type: row.accessType,
        billing_cycle: row.billingCycle || 'monthly',
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
    res.status(500).json({ success: false, error: 'Failed to get payment history',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
