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
 */

const express = require('express');
const { query } = require('../config/database');
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

    // Get user's account type
    const userResult = await query(`
      SELECT profile_data->>'accountType' as account_type
      FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accountType = userResult.rows[0].account_type;
    
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
    const accessResult = await query(`
      SELECT 
        id,
        access_type,
        amount,
        currency,
        payment_status,
        access_starts_at,
        access_expires_at,
        created_at
      FROM sugar_access_payments
      WHERE provider_id = $1 
        AND payment_status = 'completed'
        AND access_expires_at > CURRENT_TIMESTAMP
      ORDER BY access_expires_at DESC
    `, [userId]);

    const activeAccess = {
      sugar_daddy: null,
      sugar_mommy: null
    };

    accessResult.rows.forEach(row => {
      if (row.access_type === 'sugar_daddy' || row.access_type === 'both') {
        if (!activeAccess.sugar_daddy || new Date(row.access_expires_at) > new Date(activeAccess.sugar_daddy.expiresAt)) {
          activeAccess.sugar_daddy = {
            paymentId: row.id,
            expiresAt: row.access_expires_at,
            startedAt: row.access_starts_at
          };
        }
      }
      if (row.access_type === 'sugar_mommy' || row.access_type === 'both') {
        if (!activeAccess.sugar_mommy || new Date(row.access_expires_at) > new Date(activeAccess.sugar_mommy.expiresAt)) {
          activeAccess.sugar_mommy = {
            paymentId: row.id,
            expiresAt: row.access_expires_at,
            startedAt: row.access_starts_at
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
 * @desc    Initialize a sugar access payment
 * @access  Private (Providers only)
 */
router.post('/initialize', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accessType } = req.body;

    // Validate access type
    if (!['sugar_daddy', 'sugar_mommy', 'both'].includes(accessType)) {
      return res.status(400).json({
        error: 'Invalid access type',
        validTypes: ['sugar_daddy', 'sugar_mommy', 'both']
      });
    }

    // Get user's account type and email
    const userResult = await query(`
      SELECT 
        profile_data->>'accountType' as account_type,
        email,
        username
      FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { account_type: accountType, email, username } = userResult.rows[0];
    
    // Only providers can purchase sugar access
    if (accountType !== 'provider') {
      return res.status(403).json({
        error: 'Only providers can purchase sugar access'
      });
    }

    // Check if user already has active access for this type
    const existingAccess = await query(`
      SELECT id FROM sugar_access_payments
      WHERE provider_id = $1 
        AND (access_type = $2 OR access_type = 'both')
        AND payment_status = 'completed'
        AND access_expires_at > CURRENT_TIMESTAMP
    `, [userId, accessType]);

    if (existingAccess.rows.length > 0 && accessType !== 'both') {
      return res.status(400).json({
        error: 'You already have active access for this type',
        existingAccess: true
      });
    }

    // Get pricing
    const pricing = SUGAR_ACCESS_PRICING[accessType];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + pricing.duration_days);

    // Create pending payment record
    const paymentResult = await query(`
      INSERT INTO sugar_access_payments (
        provider_id, access_type, amount, currency, 
        payment_status, access_expires_at
      )
      VALUES ($1, $2, $3, $4, 'pending', $5)
      RETURNING id
    `, [userId, accessType, pricing.price, pricing.currency, expiresAt]);

    const paymentId = paymentResult.rows[0].id;

    // Initialize Paystack payment (if PaystackManager is available)
    let paystackResponse = null;
    if (req.paystackManager) {
      try {
        paystackResponse = await req.paystackManager.initializePayment({
          email,
          amount: pricing.price * 100, // Paystack expects amount in kobo
          reference: `sugar_${accessType}_${paymentId}`,
          callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sugar-access/callback`,
          metadata: {
            type: 'sugar_access',
            access_type: accessType,
            payment_id: paymentId,
            user_id: userId
          }
        });
      } catch (paystackError) {
        console.error('Paystack initialization error:', paystackError);
      }
    }

    res.json({
      success: true,
      paymentId,
      accessType,
      amount: pricing.price,
      currency: pricing.currency,
      expiresAt,
      durationDays: pricing.duration_days,
      paystack: paystackResponse,
      // Fallback for manual verification
      reference: `sugar_${accessType}_${paymentId}`
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
 * @desc    Verify a sugar access payment (after Paystack callback)
 * @access  Private
 */
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reference, paymentId } = req.body;

    if (!reference && !paymentId) {
      return res.status(400).json({
        error: 'Payment reference or payment ID is required'
      });
    }

    // Find the payment record
    let payment;
    if (paymentId) {
      const result = await query(`
        SELECT * FROM sugar_access_payments
        WHERE id = $1 AND provider_id = $2
      `, [paymentId, userId]);
      payment = result.rows[0];
    } else if (reference) {
      // Extract payment ID from reference (format: sugar_type_uuid)
      const parts = reference.split('_');
      const extractedId = parts[parts.length - 1];
      const result = await query(`
        SELECT * FROM sugar_access_payments
        WHERE id = $1 AND provider_id = $2
      `, [extractedId, userId]);
      payment = result.rows[0];
    }

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.payment_status === 'completed') {
      return res.json({
        success: true,
        message: 'Payment already verified',
        payment
      });
    }

    // Verify with Paystack if available
    let verified = false;
    if (req.paystackManager && reference) {
      try {
        const verification = await req.paystackManager.verifyPayment(reference);
        verified = verification.status === 'success';
      } catch (verifyError) {
        console.error('Paystack verification error:', verifyError);
      }
    }

    // For testing/development, allow manual verification
    if (!verified && process.env.NODE_ENV === 'development') {
      console.log('⚠️ Development mode: Auto-verifying payment');
      verified = true;
    }

    if (verified) {
      // Update payment status
      await query(`
        UPDATE sugar_access_payments
        SET payment_status = 'completed',
            payment_reference = $1,
            access_starts_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [reference, payment.id]);

      res.json({
        success: true,
        message: 'Payment verified successfully',
        accessType: payment.access_type,
        expiresAt: payment.access_expires_at
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Payment verification failed'
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

    const result = await query(`
      SELECT 
        id,
        access_type,
        amount,
        currency,
        payment_status,
        payment_reference,
        access_starts_at,
        access_expires_at,
        created_at
      FROM sugar_access_payments
      WHERE provider_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json({
      success: true,
      payments: result.rows
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
