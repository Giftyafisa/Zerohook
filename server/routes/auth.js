const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { body, validationResult } = require('express-validator');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = new RateLimiterMemory({
  points: 5, // Number of requests
  duration: 900, // Per 15 minutes (900 seconds)
});

const rateLimitMiddleware = async (req, res, next) => {
  try {
    await authLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({ error: 'Too many authentication attempts, please try again later.' });
  }
};

const JWT_SECRET = process.env.JWT_SECRET || 'hkup_secret_key_change_in_production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', rateLimitMiddleware, [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, email, password, phone, referralCode } = req.body;

    // Fraud detection analysis
    const fraudAnalysis = await req.fraudDetection.analyzeFraudRisk(null, 'registration', {
      username, email, phone
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (fraudAnalysis.shouldBlock) {
      return res.status(403).json({
        error: 'Registration blocked due to security concerns',
        riskFactors: fraudAnalysis.riskFactors
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'User already exists with this email or username'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await query(`
      INSERT INTO users (username, email, password_hash, phone, verification_tier, profile_data)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, verification_tier, reputation_score, trust_score, created_at
    `, [
      username,
      email,
      passwordHash,
      phone || null,
      1, // Default to basic verification tier
      JSON.stringify({
        registration_ip: req.ip,
        registration_user_agent: req.get('User-Agent'),
        referral_code: referralCode || null
      })
    ]);

    const user = userResult.rows[0];

    // Record trust event for new registration
    await req.trustEngine.recordTrustEvent(
      user.id,
      'registration',
      {
        method: 'email_password',
        fraud_score: fraudAnalysis.riskScore,
        verification_tier: 1
      },
      fraudAnalysis.requiresVerification ? -5 : 5 // Penalty if suspicious
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        verificationTier: user.verification_tier
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    // Return user data (excluding sensitive info)
    res.status(201).json({
      message: 'Registration successful',
      token,
             user: {
         id: user.id,
         username: user.username,
         email: user.email,
         verificationTier: user.verification_tier,
         reputationScore: user.reputation_score,
         trustScore: user.trust_score,
         createdAt: user.created_at,
         is_subscribed: false,
         subscription_tier: null,
         subscription_expires_at: null
       },
      fraudAnalysis: {
        riskLevel: fraudAnalysis.riskLevel,
        requiresVerification: fraudAnalysis.requiresVerification
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', rateLimitMiddleware, [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Get user from database
    const userResult = await query(`
      SELECT id, username, email, password_hash, verification_tier, 
             reputation_score, trust_score, status, last_active,
             is_subscribed, subscription_tier, subscription_expires_at,
             profile_data, created_at
      FROM users 
      WHERE email = $1
    `, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const user = userResult.rows[0];

    // Check if account is suspended
    if (user.status === 'suspended') {
      return res.status(403).json({
        error: 'Account suspended. Please contact support.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Fraud detection for login attempt
    const fraudAnalysis = await req.fraudDetection.analyzeFraudRisk(
      user.id,
      'login',
      { email },
      {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    if (fraudAnalysis.shouldBlock) {
      return res.status(403).json({
        error: 'Login blocked due to security concerns',
        riskFactors: fraudAnalysis.riskFactors
      });
    }

    // Update last active timestamp
    await query(
      'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        verificationTier: user.verification_tier
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    // Record trust event for successful login
    await req.trustEngine.recordTrustEvent(
      user.id,
      'login',
      {
        ip: req.ip,
        user_agent: req.get('User-Agent'),
        fraud_score: fraudAnalysis.riskScore
      },
      0 // Neutral trust impact for regular login
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        verificationTier: user.verification_tier,
        reputationScore: user.reputation_score,
        trustScore: user.trust_score,
        status: user.status,
        is_subscribed: user.is_subscribed,
        subscription_tier: user.subscription_tier,
        subscription_expires_at: user.subscription_expires_at,
        profile_data: user.profile_data || {},
        created_at: user.created_at
      },
      security: {
        riskLevel: fraudAnalysis.riskLevel,
        requiresAdditionalAuth: fraudAnalysis.requiresVerification
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/auth/verify-tier
 * @desc    Upgrade user verification tier
 * @access  Private
 */
router.post('/verify-tier', authMiddleware, [
  body('tier').isInt({ min: 1, max: 4 }),
  body('verificationData').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { tier, verificationData } = req.body;
    const userId = req.user.userId;

    // Check current verification tier
    const userResult = await query(
      'SELECT verification_tier FROM users WHERE id = $1',
      [userId]
    );

    const currentTier = userResult.rows[0].verification_tier;
    
    if (tier <= currentTier) {
      return res.status(400).json({
        error: 'Cannot downgrade or stay at same verification tier'
      });
    }

    // Perform identity verification
    const verificationResult = await req.trustEngine.verifyIdentity(
      userId, 
      tier, 
      verificationData
    );

    if (!verificationResult.success) {
      return res.status(400).json({
        error: 'Verification failed',
        details: verificationResult.results
      });
    }

    res.json({
      message: 'Verification tier upgraded successfully',
      newTier: tier,
      verificationResults: verificationResult.results
    });

  } catch (error) {
    console.error('Tier verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get fresh user data
    const userResult = await query(`
      SELECT id, username, verification_tier, is_subscribed, subscription_tier, subscription_expires_at, profile_data FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Generate new token
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        verificationTier: user.verification_tier
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    res.json({
      message: 'Token refreshed successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        verificationTier: user.verification_tier,
        is_subscribed: user.is_subscribed,
        subscription_tier: user.subscription_tier,
        subscription_expires_at: user.subscription_expires_at,
        profile_data: user.profile_data || {}
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token invalidation)
 * @access  Private
 */
router.post('/logout', authMiddleware, (req, res) => {
  // In a more sophisticated setup, you might maintain a blacklist of tokens
  // For now, we rely on client-side token removal
  res.json({ message: 'Logged out successfully' });
});

/**
 * @route   POST /api/auth/validate-token
 * @desc    Validate if a stored token is still valid (public endpoint)
 * @access  Public
 */
router.post('/validate-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        valid: false, 
        error: 'No token provided' 
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Verify user still exists
      const userResult = await query(
        'SELECT id, username, verification_tier, status, is_subscribed, subscription_tier, subscription_expires_at, profile_data FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return res.json({ 
          valid: false, 
          error: 'User not found' 
        });
      }

      const user = userResult.rows[0];
      
      if (user.status === 'suspended') {
        return res.json({ 
          valid: false, 
          error: 'Account suspended' 
        });
      }

      // Token is valid and user exists
      res.json({
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          verificationTier: user.verification_tier,
          is_subscribed: user.is_subscribed,
          subscription_tier: user.subscription_tier,
          subscription_expires_at: user.subscription_expires_at,
          profile_data: user.profile_data || {}
        }
      });

    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.json({ 
          valid: false, 
          error: 'Token expired' 
        });
      }
      
      return res.json({ 
        valid: false, 
        error: 'Invalid token' 
      });
    }

  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({
      valid: false,
      error: 'Token validation failed'
    });
  }
});

// Auth middleware function
async function authMiddleware(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists
    const userResult = await query(
      'SELECT id, username, verification_tier, status, is_subscribed, subscription_tier, subscription_expires_at, profile_data FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Add subscription data to user object
    req.user = {
      ...decoded,
      is_subscribed: user.is_subscribed,
      subscription_tier: user.subscription_tier,
      subscription_expires_at: user.subscription_expires_at
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { router, authMiddleware };