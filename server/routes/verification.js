const express = require('express');
const { User, VerificationRequest } = require('../config/database');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const NotificationService = require('../services/NotificationService');

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

    const user = await User.findById(userId).select('verification_tier verification_data').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentTier = user.verification_tier || 1;
    const verificationData = user.verification_data || {};

    if (verificationTier <= currentTier) {
      return res.status(400).json({
        error: 'Cannot downgrade or stay at same verification tier'
      });
    }

    // Create verification request
    const verificationResult = await VerificationRequest.create({
      user_id: userId,
      requested_tier: verificationTier,
      document_type: documentType,
      document_number: documentNumber,
      document_images: documentImages,
      status: 'pending'
    });

    // Update user verification data
    await User.findByIdAndUpdate(userId, {
      $set: {
        'verification_data.pending_verification': {
          requestId: verificationResult._id.toString(),
          requestedTier: verificationTier,
          documentType: documentType,
          submittedAt: new Date().toISOString()
        },
        updated_at: new Date()
      }
    });

    // Emit real-time notification to user
    if (req.io) {
      req.io.to(`user_${userId}`).emit('verification_submitted', {
        requestId: verificationResult._id.toString(),
        requestedTier: verificationTier,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
      console.log(`📡 Verification submission notification sent to user: ${userId}`);
      
      // Save notification to database
      try {
        await NotificationService.createAndEmit(req.io, {
          userId,
          type: 'verification',
          title: 'Verification Documents Submitted',
          message: `Your Tier ${verificationTier} verification documents have been submitted and are pending review.`,
          data: { requestId: verificationResult._id.toString(), requestedTier: verificationTier }
        });
      } catch (notifErr) {
        console.error('Failed to save verification notification:', notifErr);
      }
    }

    res.json({
      message: 'Verification documents submitted successfully',
      requestId: verificationResult._id.toString(),
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
    await User.findByIdAndUpdate(userId, {
      $set: {
        'verification_data.phone_verified': {
          phoneNumber: phoneNumber,
          verifiedAt: new Date().toISOString(),
          status: 'verified'
        },
        updated_at: new Date()
      }
    });

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
    await User.findByIdAndUpdate(userId, {
      $set: {
        'verification_data.email_verified': {
          email: email,
          verifiedAt: new Date().toISOString(),
          status: 'verified'
        },
        updated_at: new Date()
      }
    });

    // Emit real-time notification to user
    if (req.io) {
      req.io.to(`user_${userId}`).emit('email_verified', {
        email: email,
        status: 'verified',
        timestamp: new Date().toISOString()
      });
      console.log(`📡 Email verification notification sent to user: ${userId}`);
      
      // Save notification to database
      try {
        await NotificationService.createAndEmit(req.io, {
          userId,
          type: 'verification',
          title: 'Email Verified',
          message: `Your email ${email} has been successfully verified!`,
          data: { email, status: 'verified' }
        });
      } catch (notifErr) {
        console.error('Failed to save email verification notification:', notifErr);
      }
    }

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
    await User.findByIdAndUpdate(userId, {
      $set: {
        [`verification_data.social_verified.${platform}`]: {
          username: username,
          verifiedAt: new Date().toISOString(),
          status: 'verified'
        },
        updated_at: new Date()
      }
    });

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

    const user = await User.findById(userId)
      .select('verification_tier verification_data reputation_score trust_score')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const verificationData = user.verification_data || {};

    // Calculate verification progress
    const verificationProgress = calculateVerificationProgress(verificationData, user.verification_tier);

    res.json({
      currentTier: user.verification_tier || 1,
      reputationScore: user.reputation_score || 0,
      trustScore: user.trust_score || 0,
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
  body('requestedTier').optional().isInt({ min: 1, max: 4 }),
  body('verificationTier').optional().isInt({ min: 1, max: 4 }),
  body('reason').optional().isLength({ min: 10, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { requestedTier, verificationTier, reason } = req.body;
    const targetTier = requestedTier || verificationTier;
    const userId = req.user.userId;

    if (!targetTier) {
      return res.status(400).json({ error: 'requestedTier or verificationTier is required' });
    }

    // Check current tier
    const user = await User.findById(userId).select('verification_tier').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentTier = user.verification_tier || 1;

    if (targetTier <= currentTier) {
      return res.status(400).json({
        error: 'Cannot request same or lower tier'
      });
    }

    // Check if upgrade request already exists
    const existingRequest = await VerificationRequest.findOne({
      user_id: userId,
      status: 'pending'
    }).lean();

    if (existingRequest) {
      return res.status(400).json({
        error: 'Upgrade request already pending'
      });
    }

    // Create upgrade request
    const upgradeResult = await VerificationRequest.create({
      user_id: userId,
      requested_tier: targetTier,
      reason: reason || 'Tier upgrade request',
      status: 'pending'
    });

    res.json({
      message: 'Upgrade request submitted successfully',
      requestId: upgradeResult._id.toString(),
      requestedTier: targetTier,
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
