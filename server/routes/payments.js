const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const { Transaction } = require('../config/database');
const NotificationService = require('../services/NotificationService');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const router = express.Router();
const SUPPORTED_SETTLEMENT_CRYPTOS = ['BTC', 'ETH', 'USDT', 'USDC'];

// Per-route rate limiter: 10 payment creations per 15 min per IP
const paymentLimiter = new RateLimiterMemory({ points: 10, duration: 900 });
const paymentRateLimit = async (req, res, next) => {
  try { await paymentLimiter.consume(req.ip); next(); }
  catch { res.status(429).json({ success: false, error: 'Too many payment requests, please try again later.' }); }
};

/**
 * Zerohook Payments - Crypto Only (Fee-Free Direct Blockchain)
 * 
 * All payments use cryptocurrency via CryptoPaymentManager.
 * Live rates via CurrencyManager (CoinGecko + Frankfurter).
 * No Paystack, no Stripe, no Coinbase Commerce.
 */

// ============ PAYMENT CREATION ============

/**
 * @route   POST /api/payments/create-payment-intent
 * @desc    Create a crypto payment invoice with live rate conversion
 * @access  Private
 */
router.post('/create-payment-intent', authMiddleware, paymentRateLimit, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency').optional().isString().withMessage('Currency must be a string'),
  body('cryptoSymbol').optional().isIn(SUPPORTED_SETTLEMENT_CRYPTOS).withMessage('Invalid crypto symbol'),
  body('serviceId').optional().isString().matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid service ID'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const { amount, currency, cryptoSymbol = 'USDT', serviceId, description } = req.body;
    const userId = req.user.userId;

    // Get user's country for local currency
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    const country = req.countryManager.getCountryByCode(countryCode);
    const localCurrency = currency?.toUpperCase() || country?.currency || 'NGN';

    // Convert fiat amount to crypto using live rates
    const conversion = await req.currencyManager.fiatToCrypto(amount, localCurrency, cryptoSymbol);

    // Create crypto payment invoice
    const invoice = await req.cryptoPaymentManager.createPaymentInvoice({
      cryptoAmount: parseFloat(conversion.cryptoAmount.toFixed(8)),
      cryptoSymbol,
      fiatAmount: amount,
      fiatCurrency: localCurrency,
      transactionId: null, // Will be set after DB record created
      userId,
      metadata: { serviceId, description, countryCode }
    });

    // Validate ObjectId format before conversion
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID format' });
    }
    if (serviceId && !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ success: false, error: 'Invalid service ID format' });
    }

    // Create transaction record in MongoDB
    const transaction = await Transaction.create({
      user_id: mongoose.Types.ObjectId.createFromHexString(userId),
      service_id: serviceId ? mongoose.Types.ObjectId.createFromHexString(serviceId) : null,
      amount: amount,
      currency: localCurrency,
      payment_method: 'crypto',
      reference: invoice.reference,
      status: 'pending',
      country_code: countryCode,
      type: 'payment',
      metadata: {
        cryptoSymbol,
        cryptoAmount: conversion.cryptoAmount,
        cryptoAddress: invoice.address,
        rate: conversion.rate,
        rateSource: conversion.rateSource,
        paymentMethod: 'crypto',
        description: description || 'Payment'
      }
    });

    console.log(`🪙 Crypto payment created: ${invoice.reference} - ${conversion.cryptoAmount} ${cryptoSymbol} (${localCurrency} ${amount})`);

    res.json({
      success: true,
      transactionId: transaction._id.toString(),
      paymentIntent: {
        reference: invoice.reference,
        address: invoice.address,
        cryptoAmount: conversion.cryptoAmount,
        cryptoSymbol,
        fiatAmount: amount,
        fiatCurrency: localCurrency,
        network: invoice.network,
        qrData: invoice.qrData,
        expiresAt: invoice.expiresAt,
        rate: conversion.rate,
        rateSource: conversion.rateSource
      },
      country: country,
      message: `Send ${req.currencyManager.formatCryptoAmount(conversion.cryptoAmount, cryptoSymbol)} ${cryptoSymbol} to the address provided`
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ success: false, error: 'Failed to create payment intent' });
  }
});

/**
 * @route   POST /api/payments/confirm
 * @desc    Check/confirm a crypto payment by verifying blockchain
 * @access  Private
 */
router.post('/confirm', authMiddleware, paymentRateLimit, [
  body('reference').isString().withMessage('Payment reference is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }

    const { reference } = req.body;
    const userId = req.user.userId;

    // Check payment status on blockchain
    const status = await req.cryptoPaymentManager.checkPaymentStatus(reference);

    if (!status.success) {
      return res.status(400).json({ success: false, error: status.error });
    }

    // If confirmed, update transaction in DB
    if (status.status === 'confirmed') {
      const transaction = await Transaction.findOneAndUpdate(
        { reference, user_id: mongoose.Types.ObjectId.createFromHexString(userId) },
        {
          $set: {
            status: 'completed',
            confirmed_at: new Date(),
            'metadata.blockchain_verification': status.verification
          }
        },
        { new: true }
      );

      // Emit real-time payment confirmation
      if (req.io && transaction) {
        req.io.to(`user_${userId}`).emit('payment_confirmed', {
          transactionId: transaction._id.toString(),
          amount: transaction.amount,
          currency: transaction.currency,
          status: 'confirmed',
          timestamp: new Date().toISOString()
        });

        await NotificationService.createAndEmit(req.io, {
          userId,
          type: 'payment',
          title: 'Payment Confirmed',
          message: `${transaction.currency}${transaction.amount} has been confirmed and credited.`,
          data: {
            transactionId: transaction._id.toString(),
            reference: transaction.reference,
            type: transaction.type,
            status: 'confirmed'
          }
        });
      }
    }

    res.json({
      success: true,
      status: status.status,
      reference,
      verification: status.verification,
      message: status.status === 'confirmed' ? 'Payment confirmed on blockchain' :
               status.status === 'pending_confirmation' ? 'Payment detected, waiting for confirmations' :
               'Payment not yet detected'
    });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ success: false, error: 'Failed to confirm payment' });
  }
});

// ============ TRANSACTION HISTORY ============

/**
 * @route   GET /api/payments/transactions
 * @desc    Get user's transaction history
 * @access  Private
 */
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status, type } = req.query;
    
    const userObjectId = mongoose.Types.ObjectId.createFromHexString(userId);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const matchQuery = {
      $or: [
        { user_id: userObjectId },
        { client_id: userObjectId },
        { provider_id: userObjectId }
      ]
    };
    
    if (status) matchQuery.status = status;
    if (type) matchQuery.type = type;
    
    const total = await Transaction.countDocuments(matchQuery);
    
    const transactions = await Transaction.find(matchQuery)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const formattedTransactions = transactions.map(tx => {
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
        paymentMethod: tx.payment_method,
        cryptoSymbol: tx.metadata?.cryptoSymbol || null,
        cryptoAmount: tx.metadata?.cryptoAmount || null
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
    res.status(500).json({ success: false, error: 'Failed to fetch transactions',
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

// ============ PAYMENT METHODS & RATES ============

/**
 * @route   GET /api/payments/methods
 * @desc    Get available payment methods (crypto only)
 * @access  Private
 */
router.get('/methods', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    const paymentMethods = req.countryManager.getCountryPaymentMethods(countryCode);
    
    res.json({
      success: true,
      userCountry: userCountry.country,
      paymentMethods,
      supportedCryptos: req.cryptoPaymentManager
        .getSupportedCryptocurrencies()
        .filter((crypto) => SUPPORTED_SETTLEMENT_CRYPTOS.includes(crypto.symbol)),
      message: 'Crypto payments available globally - no fees'
    });

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payment methods' });
  }
});

/**
 * @route   GET /api/payments/rates
 * @desc    Get live crypto rates in user's local currency
 * @access  Private
 */
router.get('/rates', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fiatCurrency } = req.query;

    // Get user's local currency
    const userCountry = await req.countryManager.getUserCountry(userId);
    const localCurrency = fiatCurrency?.toUpperCase() || 
                          (userCountry.success && userCountry.country ? userCountry.country.currency : 'NGN');

    const rates = await req.currencyManager.getAllCryptoRatesInFiat(localCurrency);

    res.json({
      success: true,
      ...rates
    });

  } catch (error) {
    console.error('Get rates error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rates' });
  }
});

/**
 * @route   GET /api/payments/currencies
 * @desc    Get supported currencies and exchange rates
 * @access  Private
 */
router.get('/currencies', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    const country = req.countryManager.getCountryByCode(countryCode);
    
    const rates = await req.currencyManager.getAllCryptoRatesInFiat(country?.currency || 'NGN');
    
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
      supportedCryptos: req.currencyManager.getSupportedCryptos(),
      exchangeRates: rates
    });

  } catch (error) {
    console.error('Get currencies error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch currencies' });
  }
});

/**
 * @route   POST /api/payments/convert
 * @desc    Convert between fiat and crypto (live rate quote)
 * @access  Private
 */
router.post('/convert', authMiddleware, [
  body('amount').isFloat({ min: 0 }).withMessage('Amount required'),
  body('from').isString().withMessage('From currency required'),
  body('to').isString().withMessage('To currency required')
], async (req, res) => {
  try {
    const { amount, from, to } = req.body;
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    let result;
    if (req.currencyManager.isSupportedCrypto(fromUpper) && req.currencyManager.isSupportedFiat(toUpper)) {
      result = await req.currencyManager.cryptoToFiat(amount, fromUpper, toUpper);
    } else if (req.currencyManager.isSupportedFiat(fromUpper) && req.currencyManager.isSupportedCrypto(toUpper)) {
      result = await req.currencyManager.fiatToCrypto(amount, fromUpper, toUpper);
    } else if (req.currencyManager.isSupportedFiat(fromUpper) && req.currencyManager.isSupportedFiat(toUpper)) {
      result = await req.currencyManager.fiatToFiat(amount, fromUpper, toUpper);
    } else {
      return res.status(400).json({ success: false, error: `Unsupported conversion: ${from} → ${to}` });
    }

    res.json({ success: true, conversion: result });
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ success: false, error: 'Failed to convert' });
  }
});

// ============ WALLET & BALANCE ============

/**
 * @route   GET /api/payments/balance
 * @desc    Get user's wallet balance
 * @access  Private
 */
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    let earnings = 0;
    let pendingEarnings = 0;
    let totalSpent = 0;
    let completedTransactions = 0;
    let pendingTransactions = 0;
    let currency = 'USD';
    
    const userObjectId = mongoose.Types.ObjectId.createFromHexString(userId);
    
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
        totalSpent,
        completedTransactions,
        pendingTransactions
      }
    });
    
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ success: false, error: 'Failed to get balance' });
  }
});

/**
 * @route   GET /api/payments/wallet
 * @desc    Get wallet info (mobile app compatibility)
 * @access  Private
 */
router.get('/wallet', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    let balance = 0;
    let escrowHeld = 0;
    let pendingWithdrawal = 0;
    let totalEarnings = 0;
    let currency = 'USD';
    let currencySymbol = '$';
    
    try {
      const userCountry = await req.countryManager?.getUserCountry(userId);
      if (userCountry?.success && userCountry?.country) {
        currency = userCountry.country.currency || 'USD';
        currencySymbol = userCountry.country.currencySymbol || '$';
      }
    } catch (e) {
      // Use default currency
    }
    
    try {
      const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);

      // Single $facet pipeline replaces 6 separate aggregation round-trips
      const [walletData] = await Transaction.aggregate([
        {
          $match: {
            $or: [
              { user_id: userObjId },
              { client_id: userObjId },
              { provider_id: userObjId }
            ]
          }
        },
        {
          $facet: {
            deposits: [
              { $match: { user_id: userObjId, type: { $in: ['deposit', 'wallet_topup'] }, status: { $in: ['completed', 'confirmed'] } } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ],
            withdrawn: [
              { $match: { user_id: userObjId, type: 'withdrawal', status: { $in: ['completed', 'confirmed'] } } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ],
            escrowAsClient: [
              { $match: { client_id: userObjId, type: 'escrow_hold', status: { $in: ['pending', 'held', 'escrow_held', 'in_progress', 'pin_entered'] } } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ],
            escrowReleased: [
              { $match: { user_id: userObjId, type: 'escrow_release', status: { $in: ['completed', 'confirmed'] } } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ],
            earnings: [
              { $match: { provider_id: userObjId, status: { $in: ['completed', 'released'] } } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ],
            pendingWithdrawals: [
              { $match: { user_id: userObjId, type: 'withdrawal', status: 'pending' } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ]
          }
        }
      ]);
      
      const deposits = walletData.deposits[0]?.total || 0;
      const withdrawn = walletData.withdrawn[0]?.total || 0;
      const escrowHeldAsClient = walletData.escrowAsClient[0]?.total || 0;
      const escrowReleased = walletData.escrowReleased[0]?.total || 0;
      
      balance = deposits + escrowReleased - withdrawn - escrowHeldAsClient;
      totalEarnings = (walletData.earnings[0]?.total || 0) + escrowReleased;
      escrowHeld = escrowHeldAsClient;
      pendingWithdrawal = walletData.pendingWithdrawals[0]?.total || 0;
      
    } catch (dbError) {
      console.log('Wallet query failed, using defaults:', dbError.message);
    }
    
    res.json({
      success: true,
      wallet: {
        balance, escrowHeld, pendingWithdrawal, totalEarnings,
        currency, currencySymbol
      },
      balance, escrowHeld, pendingWithdrawal, totalEarnings,
      currency, currencySymbol
    });
    
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ success: false, error: 'Failed to get wallet info' });
  }
});

// ============ DEPOSIT & WITHDRAW (Crypto) ============

/**
 * @route   POST /api/payments/deposit
 * @desc    Create crypto deposit invoice for wallet top-up
 * @access  Private
 */
router.post('/deposit', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, cryptoSymbol = 'USDT' } = req.body;
    const normalizedSymbol = String(cryptoSymbol || '').toUpperCase();

    if (!SUPPORTED_SETTLEMENT_CRYPTOS.includes(normalizedSymbol)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported crypto. Allowed: ${SUPPORTED_SETTLEMENT_CRYPTOS.join(', ')}`
      });
    }

    // Get user's country for local currency
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    const country = req.countryManager.getCountryByCode(countryCode);
    const currency = country ? country.currency : 'NGN';
    const currencySymbol = country ? country.currencySymbol : '₦';

    // Validate minimum amounts
    const minAmounts = { NGN: 100, GHS: 1, KES: 50, ZAR: 10, UGX: 500, TZS: 500, RWF: 100, BWP: 5, ZMW: 10, MWK: 500, USD: 1 };
    const minAmount = minAmounts[currency] || 100;
    
    if (!amount || amount < minAmount) {
      return res.status(400).json({ success: false, error: `Minimum deposit is ${currencySymbol}${minAmount}`,
        minAmount, currency, currencySymbol
      });
    }

    // Maximum deposit limit for safety
    const maxAmounts = { NGN: 50000000, GHS: 500000, KES: 5000000, ZAR: 500000, UGX: 50000000, TZS: 50000000, RWF: 5000000, BWP: 50000, ZMW: 500000, MWK: 50000000, USD: 50000 };
    const maxAmount = maxAmounts[currency] || 50000000;
    if (amount > maxAmount) {
      return res.status(400).json({ success: false, error: `Maximum deposit is ${currencySymbol}${maxAmount.toLocaleString()}` });
    }

    // Sanitize amount - ensure it's a valid positive number
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    // Convert fiat to crypto
    const conversion = await req.currencyManager.fiatToCrypto(amount, currency, normalizedSymbol);

    // Create crypto invoice
    const invoice = await req.cryptoPaymentManager.createPaymentInvoice({
      cryptoAmount: parseFloat(conversion.cryptoAmount.toFixed(8)),
      cryptoSymbol: normalizedSymbol,
      fiatAmount: amount,
      fiatCurrency: currency,
      userId,
      metadata: { type: 'deposit', countryCode }
    });

    // Create transaction record
    await Transaction.create({
      user_id: mongoose.Types.ObjectId.createFromHexString(userId),
      amount: amount,
      currency: currency,
      payment_method: 'crypto',
      reference: invoice.reference,
      status: 'pending',
      country_code: countryCode,
      type: 'deposit',
      metadata: {
        type: 'deposit',
        cryptoSymbol: normalizedSymbol,
        cryptoAmount: conversion.cryptoAmount,
        cryptoAddress: invoice.address,
        rate: conversion.rate,
        description: `Wallet deposit - ${currencySymbol}${amount.toLocaleString()}`
      }
    });

    console.log(`💰 Crypto deposit created: ${invoice.reference} - ${conversion.cryptoAmount} ${normalizedSymbol} (${currencySymbol}${amount})`);

    res.json({
      success: true,
      reference: invoice.reference,
      address: invoice.address,
      walletAddress: invoice.address,
      cryptoAmount: conversion.cryptoAmount,
      cryptoSymbol: normalizedSymbol,
      fiatAmount: amount,
      network: invoice.network,
      qrData: invoice.qrData,
      expiresAt: invoice.expiresAt,
      currency, currencySymbol,
      country: countryCode,
      rate: conversion.rate
    });

  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ success: false, error: 'Failed to process deposit' });
  }
});

/**
 * @route   POST /api/payments/withdraw
 * @desc    Request crypto withdrawal to external wallet
 * @access  Private
 */
router.post('/withdraw', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, cryptoSymbol = 'USDT', walletAddress, destinationAddress, network } = req.body;
    const destAddr = walletAddress || destinationAddress; // Accept both field names
    const normalizedSymbol = String(cryptoSymbol || '').toUpperCase();

    if (!SUPPORTED_SETTLEMENT_CRYPTOS.includes(normalizedSymbol)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported crypto. Allowed: ${SUPPORTED_SETTLEMENT_CRYPTOS.join(', ')}`
      });
    }

    // Get user's country for currency
    const userCountry = await req.countryManager.getUserCountry(userId);
    const countryCode = userCountry.success && userCountry.country ? userCountry.country.code : 'NG';
    const country = req.countryManager.getCountryByCode(countryCode);
    const currency = country ? country.currency : 'NGN';
    const currencySymbol = country ? country.currencySymbol : '₦';

    // Validate
    if (!amount || !destAddr) {
      return res.status(400).json({ success: false, error: 'Amount and wallet address are required' });
    }

    const minAmounts = { NGN: 1000, GHS: 10, KES: 100, ZAR: 50, UGX: 5000, TZS: 5000, RWF: 1000, BWP: 20, ZMW: 50, MWK: 5000, USD: 5 };
    const minAmount = minAmounts[currency] || 1000;
    
    if (amount < minAmount) {
      return res.status(400).json({ success: false, error: `Minimum withdrawal is ${currencySymbol}${minAmount}`,
        minAmount, currency
      });
    }

    // Sanitize amount
    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    // Basic wallet address sanitization
    if (destAddr.length > 200 || /[<>'"&]/.test(destAddr)) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address format' });
    }

    // Check available balance
    const userObjectId = mongoose.Types.ObjectId.createFromHexString(userId);
    
    const depositResult = await Transaction.aggregate([
      { $match: { user_id: userObjectId, type: { $in: ['deposit', 'wallet_topup'] }, status: { $in: ['completed', 'confirmed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const escrowReleasedResult = await Transaction.aggregate([
      { $match: { user_id: userObjectId, type: 'escrow_release', status: { $in: ['completed', 'confirmed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const withdrawnResult = await Transaction.aggregate([
      { $match: { user_id: userObjectId, type: 'withdrawal', status: { $in: ['completed', 'pending'] } } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);
    
    const escrowHeldResult = await Transaction.aggregate([
      { $match: { client_id: userObjectId, type: 'escrow_hold', status: { $in: ['pending', 'held', 'pin_entered'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const availableBalance = (depositResult[0]?.total || 0) + (escrowReleasedResult[0]?.total || 0) 
                           - (withdrawnResult[0]?.total || 0) - (escrowHeldResult[0]?.total || 0);
    
    if (amount > availableBalance) {
      return res.status(400).json({ success: false, error: `Insufficient balance. Available: ${currencySymbol}${availableBalance.toLocaleString()}`,
        availableBalance, requestedAmount: amount
      });
    }

    // Convert to crypto amount
    const conversion = await req.currencyManager.fiatToCrypto(amount, currency, normalizedSymbol);

    // Create pending withdrawal record (store positive amount; type='withdrawal' indicates direction)
    const reference = `WD_${Date.now()}_${userId.substring(0, 8)}`;
    await Transaction.create({
      user_id: userObjectId,
      amount: amount,
      currency: currency,
      payment_method: 'crypto',
      reference: reference,
      status: 'pending',
      country_code: countryCode,
      type: 'withdrawal',
      metadata: { 
        type: 'withdrawal',
        cryptoSymbol: normalizedSymbol,
        cryptoAmount: conversion.cryptoAmount,
        walletAddress: destAddr,
        destinationAddress: destAddr,
        network: network || normalizedSymbol,
        rate: conversion.rate,
        description: `Withdrawal - ${currencySymbol}${amount.toLocaleString()}`
      }
    });

    console.log(`📤 Crypto withdrawal requested: ${reference} - ${conversion.cryptoAmount} ${normalizedSymbol} to ${destAddr}`);

    res.json({
      success: true,
      message: `Withdrawal of ${currencySymbol}${amount.toLocaleString()} (${req.currencyManager.formatCryptoAmount(conversion.cryptoAmount, normalizedSymbol)} ${normalizedSymbol}) requested`,
      reference,
      cryptoAmount: conversion.cryptoAmount,
      cryptoSymbol: normalizedSymbol,
      walletAddress: destAddr,
      status: 'pending',
      currency, currencySymbol,
      note: 'Withdrawal will be processed within 24 hours after admin review'
    });

  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ success: false, error: 'Failed to process withdrawal' });
  }
});

/**
 * @route   POST /api/payments/verify-inline
 * @desc    Verify a crypto payment by reference (backward compatibility)
 * @access  Private
 */
router.post('/verify-inline', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.body;
    const userId = req.user.userId;

    if (!reference) {
      return res.status(400).json({ success: false, error: 'Payment reference is required' });
    }

    // Check if already verified
    const existingTransaction = await Transaction.findOne({ 
      reference, 
      user_id: mongoose.Types.ObjectId.createFromHexString(userId) 
    });

    if (existingTransaction && existingTransaction.status === 'completed') {
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

    // Verify on blockchain
    const status = await req.cryptoPaymentManager.checkPaymentStatus(reference);
    
    if (status.success && status.status === 'confirmed') {
      const transaction = await Transaction.findOneAndUpdate(
        { reference, user_id: mongoose.Types.ObjectId.createFromHexString(userId) },
        { $set: { status: 'completed', confirmed_at: new Date(), 'metadata.blockchain_verification': status.verification } },
        { new: true }
      );

      if (req.io && transaction) {
        req.io.to(`user_${userId}`).emit('payment_verified', {
          reference,
          status: 'confirmed',
          amount: transaction.amount,
          currency: transaction.currency,
          type: transaction.type,
          timestamp: new Date().toISOString()
        });

        await NotificationService.createAndEmit(req.io, {
          userId,
          type: 'payment',
          title: 'Payment Verified',
          message: `${transaction.currency}${transaction.amount} payment was verified successfully.`,
          data: {
            transactionId: transaction._id.toString(),
            reference,
            type: transaction.type,
            status: 'confirmed'
          }
        });
      }

      return res.json({
        success: true,
        status: 'confirmed',
        amount: transaction?.amount,
        currency: transaction?.currency
      });
    }

    res.json({
      success: false,
      status: status.status || 'pending',
      error: status.error || null,
      message: status.status === 'expired'
        ? (status.error || 'Payment invoice has expired')
        : status.status === 'pending_confirmation'
          ? 'Payment detected, waiting for network confirmations'
          : 'Payment not yet confirmed on blockchain'
    });

  } catch (error) {
    console.error('Verify inline payment error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

/**
 * @route   GET /api/payments/supported-cryptos
 * @desc    Get list of supported cryptocurrencies
 * @access  Public
 */
router.get('/supported-cryptos', (req, res) => {
  try {
    const cryptos = req.cryptoPaymentManager
      ? req.cryptoPaymentManager.getSupportedCryptocurrencies()
      : [
          { symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', logo: '₿' },
          { symbol: 'ETH', name: 'Ethereum', network: 'Ethereum', logo: 'Ξ' },
          { symbol: 'USDT', name: 'Tether', network: 'Ethereum (ERC-20)', logo: '₮' },
          { symbol: 'USDC', name: 'USD Coin', network: 'Ethereum (ERC-20)', logo: '💵' },
          { symbol: 'BNB', name: 'BNB', network: 'BSC', logo: '🟡' },
          { symbol: 'SOL', name: 'Solana', network: 'Solana', logo: '◎' },
          { symbol: 'LTC', name: 'Litecoin', network: 'Litecoin', logo: 'Ł' }
        ];

    res.json({ success: true, cryptos });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get supported cryptos' });
  }
});

module.exports = router;
