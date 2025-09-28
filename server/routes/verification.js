const express = require('express');
const { query } = require('../config/database');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

/**
 * @route   POST /api/verification/submit-documents
 * @desc    Submit verification documents
 * @access  Private
 */
router.post('/submit-documents', authMiddleware, [
  body('documentType').isIn(['passport', 'national_id', 'drivers_license', 'utility_bill']),
  body('documentNumber').isLength({ min: 1, max: 100 }),
  body('documentImages').isArray({ min: 1, max: 3 }),
  body('verificationTier').isInt({ min: 1, max: 4 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { documentType, documentNumber, documentImages, verificationTier } = req.body;
    const userId = req.user.userId;

    // Check current verification tier
    const userResult = await query(`
      SELECT verification_tier, verification_data FROM users WHERE id = $1
    `, [userId]);

    const currentTier = userResult.rows[0].verification_tier;
    const verificationData = userResult.rows[0].verification_data || {};

    if (verificationTier <= currentTier) {
      return res.status(400).json({
        error: 'Cannot downgrade or stay at same verification tier'
      });
    }

    // Create verification request
    const verificationResult = await query(`
      INSERT INTO verification_requests (
        user_id, requested_tier, document_type, document_number,
        document_images, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING id
    `, [
      userId, verificationTier, documentType, documentNumber,
      JSON.stringify(documentImages), 'pending'
    ]);

    // Update user verification data
    await query(`
      UPDATE users 
      SET verification_data = jsonb_set(
        verification_data, 
        '{pending_verification}', 
        $1
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [
      JSON.stringify({
        requestId: verificationResult.rows[0].id,
        requestedTier: verificationTier,
        documentType: documentType,
        submittedAt: new Date().toISOString()
      }),
      userId
    ]);

    res.json({
      message: 'Verification documents submitted successfully',
      requestId: verificationResult.rows[0].id,
      status: 'pending'
    });

  } catch (error) {
    console.error('Submit documents error:', error);
    res.status(500).json({ error: 'Failed to submit verification documents' });
  }
});

/**
 * @route   POST /api/verification/verify-phone
 * @desc    Verify phone number with OTP
 * @access  Private
 */
router.post('/verify-phone', authMiddleware, [
  body('phoneNumber').isMobilePhone(),
  body('otp').isLength({ min: 4, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { phoneNumber, otp } = req.body;
    const userId = req.user.userId;

    // Verify OTP (in production, integrate with SMS service)
    // For now, we'll use a simple verification
    const isValidOTP = await verifyOTP(phoneNumber, otp);

    if (!isValidOTP) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Update user phone verification
    await query(`
      UPDATE users 
      SET verification_data = jsonb_set(
        verification_data, 
        '{phone_verified}', 
        $1
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [
      JSON.stringify({
        phoneNumber: phoneNumber,
        verifiedAt: new Date().toISOString(),
        status: 'verified'
      }),
      userId
    ]);

    res.json({
      message: 'Phone number verified successfully',
      phoneNumber: phoneNumber,
      status: 'verified'
    });

  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({ error: 'Failed to verify phone number' });
  }
});

/**
 * @route   POST /api/verification/verify-email
 * @desc    Verify email address with OTP
 * @access  Private
 */
router.post('/verify-email', authMiddleware, [
  body('email').isEmail(),
  body('otp').isLength({ min: 4, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, otp } = req.body;
    const userId = req.user.userId;

    // Verify OTP (in production, integrate with email service)
    const isValidOTP = await verifyEmailOTP(email, otp);

    if (!isValidOTP) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Update user email verification
    await query(`
      UPDATE users 
      SET verification_data = jsonb_set(
        verification_data, 
        '{email_verified}', 
        $1
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [
      JSON.stringify({
        email: email,
        verifiedAt: new Date().toISOString(),
        status: 'verified'
      }),
      userId
    ]);

    res.json({
      message: 'Email verified successfully',
      email: email,
      status: 'verified'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

/**
 * @route   POST /api/verification/social-verification
 * @desc    Verify social media accounts
 * @access  Private
 */
router.post('/social-verification', authMiddleware, [
  body('platform').isIn(['facebook', 'twitter', 'linkedin', 'instagram']),
  body('username').isLength({ min: 1, max: 100 }),
  body('verificationUrl').isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { platform, username, verificationUrl } = req.body;
    const userId = req.user.userId;

    // Verify social media account (in production, use platform APIs)
    const isVerified = await verifySocialAccount(platform, username, verificationUrl);

    if (!isVerified) {
      return res.status(400).json({ error: 'Social media verification failed' });
    }

    // Update user social verification
    await query(`
      UPDATE users 
      SET verification_data = jsonb_set(
        verification_data, 
        '{social_verified}',
        COALESCE(verification_data->'social_verified', '{}'::jsonb) || $1
      ), updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [
      JSON.stringify({
        [platform]: {
          username: username,
          verifiedAt: new Date().toISOString(),
          status: 'verified'
        }
      }),
      userId
    ]);

    res.json({
      message: 'Social media account verified successfully',
      platform: platform,
      username: username,
      status: 'verified'
    });

  } catch (error) {
    console.error('Social verification error:', error);
    res.status(500).json({ error: 'Failed to verify social media account' });
  }
});

/**
 * @route   GET /api/verification/status
 * @desc    Get user verification status
 * @access  Private
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const userResult = await query(`
      SELECT verification_tier, verification_data, reputation_score, trust_score
      FROM users WHERE id = $1
    `, [userId]);

    const user = userResult.rows[0];
    const verificationData = user.verification_data || {};

    // Calculate verification progress
    const verificationProgress = calculateVerificationProgress(verificationData, user.verification_tier);

    res.json({
      currentTier: user.verification_tier,
      reputationScore: user.reputation_score,
      trustScore: user.trust_score,
      verificationProgress: verificationProgress,
      verificationData: verificationData
    });

  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

/**
 * @route   POST /api/verification/request-upgrade
 * @desc    Request verification tier upgrade
 * @access  Private
 */
router.post('/request-upgrade', authMiddleware, [
  body('requestedTier').isInt({ min: 1, max: 4 }),
  body('reason').isLength({ min: 10, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { requestedTier, reason } = req.body;
    const userId = req.user.userId;

    // Check current tier
    const userResult = await query(`
      SELECT verification_tier FROM users WHERE id = $1
    `, [userId]);

    const currentTier = userResult.rows[0].verification_tier;

    if (requestedTier <= currentTier) {
      return res.status(400).json({
        error: 'Cannot request same or lower tier'
      });
    }

    // Check if upgrade request already exists
    const existingRequest = await query(`
      SELECT id FROM verification_requests 
      WHERE user_id = $1 AND status = 'pending'
    `, [userId]);

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({
        error: 'Upgrade request already pending'
      });
    }

    // Create upgrade request
    const upgradeResult = await query(`
      INSERT INTO verification_requests (
        user_id, requested_tier, reason, status, created_at
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING id
    `, [userId, requestedTier, reason, 'pending']);

    res.json({
      message: 'Upgrade request submitted successfully',
      requestId: upgradeResult.rows[0].id,
      requestedTier: requestedTier,
      status: 'pending'
    });

  } catch (error) {
    console.error('Request upgrade error:', error);
    res.status(500).json({ error: 'Failed to submit upgrade request' });
  }
});

// Helper functions
async function verifyOTP(phoneNumber, otp) {
  // In production, integrate with SMS service
  // For now, return true for testing
  return true;
}

async function verifyEmailOTP(email, otp) {
  // In production, integrate with email service
  // For now, return true for testing
  return true;
}

async function verifySocialAccount(platform, username, verificationUrl) {
  // In production, use platform APIs for verification
  // For now, return true for testing
  return true;
}

function calculateVerificationProgress(verificationData, currentTier) {
  const progress = {
    documents: verificationData.pending_verification ? 100 : 0,
    phone: verificationData.phone_verified ? 100 : 0,
    email: verificationData.email_verified ? 100 : 0,
    social: 0
  };

  // Calculate social media verification progress
  if (verificationData.social_verified) {
    const socialPlatforms = Object.keys(verificationData.social_verified);
    progress.social = (socialPlatforms.length / 4) * 100; // 4 platforms max
  }

  return progress;
}

module.exports = router;
