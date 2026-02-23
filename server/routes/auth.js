const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, FraudLog, RefreshToken } = require('../config/database');
const { body, validationResult } = require('express-validator');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const router = express.Router();

// Rate limiting for auth endpoints - dual key: IP + identifier
const authLimiterByIp = new RateLimiterMemory({
  points: 10, // 10 attempts per IP
  duration: 900, // Per 15 minutes
});
const authLimiterByIdentifier = new RateLimiterMemory({
  points: 5, // 5 attempts per email/username
  duration: 900, // Per 15 minutes
});

const rateLimitMiddleware = async (req, res, next) => {
  try {
    // Always limit by IP
    await authLimiterByIp.consume(req.ip);
    // Also limit by email/username if provided (prevents credential stuffing)
    const identifier = req.body?.email || req.body?.username;
    if (identifier) {
      await authLimiterByIdentifier.consume(identifier.toLowerCase());
    }
    next();
  } catch (rejRes) {
    res.status(429).json({ success: false, error: 'Too many authentication attempts, please try again later.' });
  }
};

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.trim().length < 32) {
  throw new Error('JWT_SECRET is missing or too weak. Set a strong secret (min 32 chars).');
}
const JWT_EXPIRE = process.env.JWT_EXPIRE || '15m'; // Short-lived access token (was 7d)
const REFRESH_TOKEN_EXPIRE_DAYS = 30; // Refresh token lives 30 days

/**
 * Hash a refresh token for storage (SHA-256).
 * We store only the hash in the DB; the raw token goes to the client.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically secure refresh token and persist its hash.
 * Returns the raw token (sent to client), while only the SHA-256 hash is stored.
 */
async function generateRefreshToken(userId, family, req) {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId,
    token: hashedToken,
    family: family || crypto.randomBytes(20).toString('hex'),
    expiresAt,
    userAgent: req?.get?.('User-Agent') || '',
    ipAddress: req?.ip || ''
  });

  return rawToken;
}

/**
 * Generate a short-lived JWT access token.
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username,
      verificationTier: user.verification_tier,
      isAdmin: user.is_admin === true
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
}

/**
 * Set refresh token as an HttpOnly cookie (web clients) while also
 * returning it in the response body (mobile clients need it).
 */
function setRefreshTokenCookie(res, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,           // HTTPS only in production
    sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin production
    maxAge: REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth'               // Only sent to auth endpoints
  });
}

/**
 * Generate a unique username from firstName and lastName
 */
const generateUsername = async (firstName, lastName) => {
  // Truncate base upfront to leave room for counter suffix (max 4 digits)
  const raw = `${firstName || 'user'}${lastName ? '_' + lastName : ''}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const base = raw.substring(0, 26);
  let username = base;
  let counter = 1;
  
  while (true) {
    const existing = await User.findOne({ username });
    if (!existing) break;
    username = `${base}${counter}`;
    counter++;
    if (counter > 9999) {
      // Fallback: append random suffix
      username = `${base}${Date.now().toString(36).slice(-4)}`;
      break;
    }
  }
  
  return username; // Already ≤30 chars (26 base + 4 counter)
};

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', rateLimitMiddleware, [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number'),
  body('phone')
    .optional(),
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be 1-50 characters'),
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be 1-50 characters'),
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'non_binary', 'prefer_not_to_say'])
    .withMessage('Invalid gender option'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  body('accountType')
    .optional()
    .isIn(['client', 'provider', 'sugar_daddy', 'sugar_mommy'])
    .withMessage('Invalid account type')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Registration validation errors:', errors.array());
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password, phone, referralCode, firstName, lastName, accountType, gender, dateOfBirth, faceVerificationConsent } = req.body;
    let { username } = req.body;
    
    // Generate username if not provided
    if (!username) {
      username = await generateUsername(firstName, lastName);
    }

    // Validate age (must be 18+) if dateOfBirth provided
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        return res.status(400).json({ success: false, error: 'You must be at least 18 years old to register'
        });
      }
    }

    // Fraud detection analysis
    const fraudAnalysis = await req.fraudDetection.analyzeFraudRisk(null, 'registration', {
      username, email, phone
    }, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (fraudAnalysis.shouldBlock) {
      return res.status(403).json({ success: false, error: 'Registration blocked due to security concerns',
        riskFactors: fraudAnalysis.riskFactors
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User already exists with this email or username'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user with profile data including all new fields
    // Determine if this is a sugar account (VVIP)
    const isSugarAccount = accountType === 'sugar_daddy' || accountType === 'sugar_mommy';
    
    // ============================================
    // CRITICAL: Detect country/currency from phone number + IP fallback
    // ============================================
    let detectedCountry = null;
    let detectedCurrency = 'USD'; // Default to USD (neutral)
    let detectedCountryCode = null;
    let detectedLat = null;
    let detectedLng = null;
    
    // Country code → currency mapping (shared between phone + IP detection)
    const countryCodeToCurrency = {
      'NG': { currency: 'NGN', name: 'Nigeria' },
      'GH': { currency: 'GHS', name: 'Ghana' },
      'KE': { currency: 'KES', name: 'Kenya' },
      'ZA': { currency: 'ZAR', name: 'South Africa' },
      'UG': { currency: 'UGX', name: 'Uganda' },
      'TZ': { currency: 'TZS', name: 'Tanzania' },
      'RW': { currency: 'RWF', name: 'Rwanda' },
      'BW': { currency: 'BWP', name: 'Botswana' },
      'ZM': { currency: 'ZMW', name: 'Zambia' },
      'MW': { currency: 'MWK', name: 'Malawi' },
    };

    if (phone) {
      // Phone code to country mapping
      const phoneCodeMap = {
        '+234': 'NG', '+233': 'GH', '+254': 'KE', '+27': 'ZA',
        '+256': 'UG', '+255': 'TZ', '+250': 'RW', '+267': 'BW',
        '+260': 'ZM', '+265': 'MW',
      };
      
      const cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
      for (const [code, countryCodeStr] of Object.entries(phoneCodeMap)) {
        if (cleanPhone.startsWith(code)) {
          detectedCountryCode = countryCodeStr;
          const info = countryCodeToCurrency[countryCodeStr];
          detectedCountry = info.name;
          detectedCurrency = info.currency;
          console.log(`🌍 Country detected from phone ${cleanPhone}: ${info.name} (${info.currency})`);
          break;
        }
      }
    }

    // IP-BASED GEOLOCATION FALLBACK — fills gaps when phone detection fails
    if (!detectedCountry && req.locationTrackingService) {
      try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
        const ipLocation = await req.locationTrackingService.processIPLocation(ip);
        if (ipLocation && ipLocation.country) {
          const ipCountryCode = ipLocation.countryCode?.toUpperCase();
          const currencyInfo = ipCountryCode ? countryCodeToCurrency[ipCountryCode] : null;
          detectedCountry = ipLocation.country;
          detectedCountryCode = ipCountryCode || null;
          detectedCurrency = currencyInfo?.currency || 'USD';
          detectedLat = ipLocation.lat || null;
          detectedLng = ipLocation.lng || null;
          console.log(`🌍 Country detected from IP ${ip}: ${ipLocation.country} (${detectedCurrency})`);
        }
      } catch (ipErr) {
        console.warn('⚠️ IP geolocation failed during registration:', ipErr.message);
      }
    }
    
    // If still no country, default to Nigeria (primary market)
    if (!detectedCountry) {
      detectedCountry = 'Nigeria';
      detectedCountryCode = 'NG';
      detectedCurrency = 'NGN';
    }
    
    const profileData = {
      firstName: firstName || '',
      lastName: lastName || '',
      accountType: accountType || 'client',
      gender: gender || null,
      dateOfBirth: dateOfBirth || null,
      // Country and currency detected from phone number + IP geolocation
      country: detectedCountry,
      countryCode: detectedCountryCode,
      currency: detectedCurrency,
      location: {
        country: detectedCountry,
        countryCode: detectedCountryCode,
        // Store coordinates from IP geolocation if available
        ...(detectedLat && detectedLng ? {
          coordinates: { lat: detectedLat, lng: detectedLng },
          // GeoJSON Point for MongoDB 2dsphere index (Uber-style proximity queries)
          geoPoint: { type: 'Point', coordinates: [detectedLng, detectedLat] }
        } : {})
      },
      faceVerification: {
        verified: false,
        verifiedAt: null,
        verificationMethod: null,
        consentGiven: faceVerificationConsent || false,
        consentGivenAt: faceVerificationConsent ? new Date().toISOString() : null
      },
      // Sugar account specific settings
      ...(isSugarAccount && {
        sugarSettings: {
          visibleToProviders: false, // Private by default
          preferredAgeRange: { min: 18, max: 30 }, // Young providers by default
          preferredGender: accountType === 'sugar_daddy' ? 'female' : 'male' // Opposite sex by default
        }
      }),
      registration_ip: req.ip,
      registration_user_agent: req.get('User-Agent'),
      referral_code: referralCode || null
    };

    const user = await User.create({
      username,
      email,
      password_hash: passwordHash,
      phone: phone || null,
      verification_tier: 1, // Default to basic verification tier
      profile_data: profileData
    });

    // Record trust event for new registration
    await req.trustEngine.recordTrustEvent(
      user._id,
      'registration',
      {
        method: 'email_password',
        fraud_score: fraudAnalysis.riskScore,
        verification_tier: 1
      },
      fraudAnalysis.requiresVerification ? -5 : 5 // Penalty if suspicious
    );

    // Generate JWT access token + refresh token
    const token = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user._id, null, req);
    setRefreshTokenCookie(res, refreshToken);

    // Return user data (excluding sensitive info)
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        verificationTier: user.verification_tier,
        reputationScore: user.reputation_score,
        trustScore: user.trust_score,
        createdAt: user.created_at,
        profile_data: user.profile_data,
        is_subscribed: false,
        subscription_tier: null,
        subscription_expires_at: null
      },
      fraudAnalysis: {
        requiresVerification: fraudAnalysis.requiresVerification
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed',
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
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
  body('username').optional({ values: 'falsy' }).isString().trim().notEmpty(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    // Filter out email validation errors if username is provided
    const filteredErrors = errors.array().filter(err => {
      if (err.path === 'email' && req.body.username) return false;
      if (err.path === 'username' && req.body.email) return false;
      return true;
    });
    
    if (filteredErrors.length > 0) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: filteredErrors
      });
    }

    // Support both email and username login
    const loginIdentifier = req.body.email || req.body.username;
    const { password } = req.body;
    
    if (!loginIdentifier) {
      return res.status(400).json({ success: false, error: 'Email or username is required'
      });
    }

    // Try database authentication
    let user;
    try {
      // Check if loginIdentifier is an email (contains @) or username
      const isEmail = loginIdentifier.includes('@');
      const searchField = isEmail ? { email: loginIdentifier } : { username: loginIdentifier };
      user = await User.findOne(searchField);
    } catch (dbError) {
      console.log('⚠️ Database unavailable during authentication');
      return res.status(503).json({ success: false, error: 'Database temporarily unavailable',
        message: 'Please try again later.'
      });
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Check if account is suspended
    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'Account suspended. Please contact support.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials'
      });
    }

    // Fraud detection for login attempt
    const fraudAnalysis = await req.fraudDetection.analyzeFraudRisk(
      user._id,
      'login',
      { identifier: loginIdentifier },
      {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    if (fraudAnalysis.shouldBlock) {
      return res.status(403).json({ success: false, error: 'Login blocked due to security concerns'
      });
    }

    // Update last active timestamp
    await User.findByIdAndUpdate(user._id, { last_active: new Date() });

    // Generate JWT access token + refresh token
    const token = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user._id, null, req);
    setRefreshTokenCookie(res, refreshToken);

    // Record trust event for successful login
    await req.trustEngine.recordTrustEvent(
      user._id,
      'login',
      {
        ip: req.ip,
        user_agent: req.get('User-Agent'),
        fraud_score: fraudAnalysis.riskScore
      },
      0 // Neutral trust impact for regular login
    );

    // Check subscription expiry before returning status
    let isSubscribed = user.is_subscribed;
    let subscriptionTier = user.subscription_tier;
    if (isSubscribed && user.subscription_expires_at && new Date(user.subscription_expires_at) <= new Date()) {
      isSubscribed = false;
      subscriptionTier = 'free';
      // Fire-and-forget DB update
      User.findByIdAndUpdate(user._id, { is_subscribed: false, subscription_tier: 'free' }).catch(e => console.error('Sub expiry update error:', e));
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        verificationTier: user.verification_tier,
        reputationScore: user.reputation_score,
        trustScore: user.trust_score,
        status: user.status,
        is_subscribed: isSubscribed,
        subscription_tier: subscriptionTier,
        subscription_expires_at: user.subscription_expires_at,
        profile_data: user.profile_data || {},
        created_at: user.created_at
      },
      security: {
        requiresAdditionalAuth: fraudAnalysis.requiresVerification
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed',
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
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { tier, verificationData } = req.body;
    const userId = req.user.userId;

    // Check current verification tier
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const currentTier = userDoc.verification_tier;
    
    if (tier <= currentTier) {
      return res.status(400).json({ success: false, error: 'Cannot downgrade or stay at same verification tier'
      });
    }

    // Perform identity verification
    const verificationResult = await req.trustEngine.verifyIdentity(
      userId, 
      tier, 
      verificationData
    );

    if (!verificationResult.success) {
      return res.status(400).json({ success: false, error: 'Verification failed',
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
    res.status(500).json({ success: false, error: 'Verification failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Rotate refresh token and issue new access + refresh tokens
 * @access  Public (uses refresh token, not access token)
 */
router.post('/refresh', async (req, res) => {
  try {
    // Accept refresh token from cookie (web) or body (mobile)
    const incomingToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingToken) {
      return res.status(400).json({ success: false, error: 'Refresh token is required' });
    }

    // Hash the incoming token to match against stored hash
    const hashedIncoming = hashToken(incomingToken);

    // Find the refresh token in DB by hash
    const storedToken = await RefreshToken.findOne({ token: hashedIncoming });

    if (!storedToken) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }

    // Check if token was already revoked (reuse detection)
    if (storedToken.revoked) {
      // Token reuse detected — revoke entire family (possible theft)
      await RefreshToken.updateMany(
        { family: storedToken.family },
        { $set: { revoked: true } }
      );
      console.warn(`⚠️ Refresh token reuse detected for user ${storedToken.userId}, family ${storedToken.family} — all tokens revoked`);
      return res.status(401).json({ success: false, error: 'Token reuse detected. Please log in again.' });
    }

    // Check expiry
    if (storedToken.expiresAt < new Date()) {
      return res.status(401).json({ success: false, error: 'Refresh token expired' });
    }

    // Get fresh user data
    const user = await User.findById(storedToken.userId);
    if (!user || user.status === 'suspended' || user.status === 'deleted') {
      return res.status(401).json({ success: false, error: 'User not found or account deactivated' });
    }

    // Rotate: atomically revoke old token and create new one in the same family
    // This prevents concurrent refresh calls from minting multiple valid descendants
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newHashedRefreshToken = hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

    // Atomic CAS: only revoke if still not revoked (prevents race condition)
    const revokeResult = await RefreshToken.findOneAndUpdate(
      { _id: storedToken._id, revoked: false },
      { $set: { revoked: true, replacedBy: newHashedRefreshToken } },
      { new: true }
    );
    if (!revokeResult) {
      // Another concurrent request already revoked this token
      return res.status(401).json({ success: false, error: 'Token already consumed. Please log in again.' });
    }

    // Create new refresh token in DB (store hash, not raw)
    await RefreshToken.create({
      userId: user._id,
      token: newHashedRefreshToken,
      family: storedToken.family,
      expiresAt,
      userAgent: req.get('User-Agent') || '',
      ipAddress: req.ip || ''
    });

    // Generate new access token
    const token = generateAccessToken(user);
    setRefreshTokenCookie(res, newRawRefreshToken);

    // Check subscription expiry before returning status
    let isSubRefresh = user.is_subscribed;
    let subTierRefresh = user.subscription_tier;
    if (isSubRefresh && user.subscription_expires_at && new Date(user.subscription_expires_at) <= new Date()) {
      isSubRefresh = false;
      subTierRefresh = 'free';
      User.findByIdAndUpdate(user._id, { is_subscribed: false, subscription_tier: 'free' }).catch(e => console.error('Sub expiry update error:', e));
    }

    res.json({
      message: 'Token refreshed successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        verificationTier: user.verification_tier,
        is_subscribed: isSubRefresh,
        subscription_tier: subTierRefresh,
        subscription_expires_at: user.subscription_expires_at,
        profile_data: user.profile_data || {}
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ success: false, error: 'Token refresh failed' });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and revoke all refresh tokens for this user
 * @access  Private
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // Revoke all refresh tokens for this user
    const userId = req.user.userId;
    await RefreshToken.updateMany(
      { userId, revoked: false },
      { $set: { revoked: true } }
    );
    // Clear the httpOnly cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });
    // Invalidate auth cache
    invalidateCachedUser(userId);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ success: true, message: 'Logged out successfully' });
  }
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
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      
      // Verify user still exists
      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.json({ 
          valid: false, 
          error: 'User not found' 
        });
      }
      
      if (user.status === 'suspended') {
        return res.json({ 
          valid: false, 
          error: 'Account suspended' 
        });
      }

      // Check subscription expiry before returning status
      let isSubValidate = user.is_subscribed;
      let subTierValidate = user.subscription_tier;
      if (isSubValidate && user.subscription_expires_at && new Date(user.subscription_expires_at) <= new Date()) {
        isSubValidate = false;
        subTierValidate = 'free';
        User.findByIdAndUpdate(user._id, { is_subscribed: false, subscription_tier: 'free' }).catch(e => console.error('Sub expiry update error:', e));
      }

      // Token is valid and user exists
      res.json({
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          verificationTier: user.verification_tier,
          is_subscribed: isSubValidate,
          subscription_tier: subTierValidate,
          subscription_expires_at: user.subscription_expires_at,
          profile_data: user.profile_data || {},
          is_admin: user.is_admin === true,
          role: user.role || 'user'
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

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user (mobile app compatibility)
 * @access  Private
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Check subscription expiry before returning status
    let isSubMe = user.is_subscribed;
    let subTierMe = user.subscription_tier;
    if (isSubMe && user.subscription_expires_at && new Date(user.subscription_expires_at) <= new Date()) {
      isSubMe = false;
      subTierMe = 'free';
      User.findByIdAndUpdate(user._id, { is_subscribed: false, subscription_tier: 'free' }).catch(e => console.error('Sub expiry update error:', e));
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        verificationTier: user.verification_tier,
        reputationScore: user.reputation_score,
        trustScore: user.trust_score,
        is_subscribed: isSubMe,
        subscription_tier: subTierMe,
        subscription_expires_at: user.subscription_expires_at,
        profile_data: user.profile_data || {},
        status: user.status,
        createdAt: user.created_at,
        lastActive: user.last_active,
        is_admin: user.is_admin === true,
        role: user.role || 'user'
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user data',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Auth user cache - short-lived to reduce DB lookups
const AUTH_CACHE_TTL = 60 * 1000; // 60 seconds
const AUTH_CACHE_MAX = 1000;
const authUserCache = new Map();

function getCachedUser(userId) {
  const entry = authUserCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > AUTH_CACHE_TTL) {
    authUserCache.delete(userId);
    return null;
  }
  return entry.user;
}

function setCachedUser(userId, user) {
  // FIFO eviction if cache is full
  if (authUserCache.size >= AUTH_CACHE_MAX) {
    const firstKey = authUserCache.keys().next().value;
    authUserCache.delete(firstKey);
  }
  authUserCache.set(userId, { user, timestamp: Date.now() });
}

function invalidateCachedUser(userId) {
  authUserCache.delete(userId);
}

// Auth middleware function
async function authMiddleware(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    
    // Check cache first
    let user = getCachedUser(decoded.userId);
    if (!user) {
      // Verify user still exists using MongoDB
      user = await User.findById(decoded.userId).select(
        'username verification_tier status is_subscribed subscription_tier subscription_expires_at profile_data'
      ).lean();
      
      if (user) {
        setCachedUser(decoded.userId, user);
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'Account suspended' });
    }

    if (user.status === 'deleted') {
      return res.status(403).json({ success: false, error: 'Account has been deleted' });
    }

    // Check subscription expiry in middleware
    let mwIsSubscribed = user.is_subscribed;
    let mwSubTier = user.subscription_tier;
    if (mwIsSubscribed && user.subscription_expires_at && new Date(user.subscription_expires_at) <= new Date()) {
      mwIsSubscribed = false;
      mwSubTier = 'free';
      // Fire-and-forget DB cleanup
      User.findByIdAndUpdate(decoded.userId, { is_subscribed: false, subscription_tier: 'free' }).catch(e => console.error('MW sub expiry update:', e));
      // Invalidate cache so next request gets fresh data
      invalidateCachedUser(decoded.userId);
    }

    // Add subscription data to user object
    req.user = {
      ...decoded,
      is_subscribed: mwIsSubscribed,
      subscription_tier: mwSubTier,
      subscription_expires_at: user.subscription_expires_at
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

/**
 * Optional auth middleware — enriches req.user if a valid Bearer token is
 * present, otherwise proceeds as unauthenticated (req.user = null).
 * Use for public routes that show extra data to logged-in users.
 */
async function optionalAuthMiddleware(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    let user = getCachedUser(decoded.userId);
    if (!user) {
      user = await User.findById(decoded.userId).select(
        'username verification_tier status is_subscribed subscription_tier subscription_expires_at profile_data'
      ).lean();
      if (user) setCachedUser(decoded.userId, user);
    }

    if (!user || user.status === 'suspended' || user.status === 'deleted') {
      req.user = null;
      return next();
    }

    // Check subscription expiry in optional auth middleware
    let optIsSubscribed = user.is_subscribed;
    let optSubTier = user.subscription_tier;
    if (optIsSubscribed && user.subscription_expires_at && new Date(user.subscription_expires_at) <= new Date()) {
      optIsSubscribed = false;
      optSubTier = 'free';
      User.findByIdAndUpdate(decoded.userId, { is_subscribed: false, subscription_tier: 'free' }).catch(() => {});
    }

    req.user = {
      ...decoded,
      is_subscribed: optIsSubscribed,
      subscription_tier: optSubTier,
      subscription_expires_at: user.subscription_expires_at
    };
    next();
  } catch (_) {
    // Invalid / expired token → treat as unauthenticated
    req.user = null;
    next();
  }
}

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete user account (soft-delete: sets status to 'deleted')
 * @access  Private
 */
router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Soft-delete: mark account as deleted rather than destroying data
    user.status = 'deleted';
    user.email = `deleted_${userId}_${user.email}`; // Free up the email
    user.deletedAt = new Date();
    await user.save();

    // Revoke ALL refresh tokens so deleted user can't refresh sessions
    await RefreshToken.updateMany(
      { userId: user._id, revoked: false },
      { $set: { revoked: true } }
    );

    // Clear the httpOnly refresh cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });

    // Invalidate cache
    invalidateCachedUser(userId);

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = { router, authMiddleware, optionalAuthMiddleware };